<?php

namespace App\Http\Controllers\Api;

use App\Models\Payment;
use App\Models\Invoice;
use App\Models\Client;
use App\Models\Currency;
use App\Models\ClientCurrencyAccount;
use App\Models\PersonalExpense;
use App\Models\Supplier;
use App\Models\ProductReturn;
use App\Models\ContainerSale;
use App\Models\ContainerSalePayment;
use App\Services\AccountBalanceService;
use App\Support\GnfRate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;

class PaymentController extends BaseController
{
    private function requestTenantId(Request $request): ?int
    {
        $user = Auth::user();

        if ($user && $user->hasRole('SUPER_ADMIN')) {
            return $request->tenant_id ?? $request->get('tenant_id') ?? $user->tenant_id;
        }

        return $user?->tenant_id;
    }

    public function index(Request $request)
    {
        try {
            $user     = Auth::user();
            $tenantId = $user->tenant_id ?? $request->get('tenant_id');

            if (!$tenantId && !$user->hasRole('SUPER_ADMIN')) {
                return $this->sendError('Tenant ID required', [], 400);
            }

            $query = Payment::with(['tenant', 'client', 'paidByClient:id,name', 'invoice']);

            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }

            if ($request->has('search') && $request->search !== '') {
                $search = $request->get('search');
                $query->where(function ($q) use ($search) {
                    $q->where('receipt_number', 'like', "%{$search}%")
                      ->orWhere('reference', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%")
                      ->orWhereHas('client', fn ($c) => $c->where('name', 'like', "%{$search}%"));
                });
            }

            if ($request->has('type') && $request->type !== '')        $query->where('type', $request->type);
            if ($request->has('method') && $request->method !== '')    $query->where('method', $request->method);
            if ($request->has('currency') && $request->currency !== '') $query->where('currency', $request->currency);
            if ($request->has('status') && $request->status !== '')    $query->where('status', $request->status);
            if ($request->has('client_id') && $request->client_id)     $query->where('client_id', $request->client_id);
            if ($request->has('invoice_id') && $request->invoice_id)   $query->where('invoice_id', $request->invoice_id);

            if ($request->has('date_from')) $query->whereDate('payment_date', '>=', $request->date_from);
            if ($request->has('date_to'))   $query->whereDate('payment_date', '<=', $request->date_to);
            if ($request->has('amount_min')) $query->where('amount', '>=', $request->amount_min);
            if ($request->has('amount_max')) $query->where('amount', '<=', $request->amount_max);

            $allowed  = ['payment_date', 'amount', 'type', 'method', 'created_at', 'receipt_number'];
            $sortBy   = in_array($request->get('sort_by'), $allowed) ? $request->get('sort_by') : 'payment_date';
            $sortOrder = in_array($request->get('sort_order'), ['asc', 'desc']) ? $request->get('sort_order') : 'desc';
            $query->orderBy($sortBy, $sortOrder);

            $payments = $query->paginate($request->get('per_page', 15));

            return $this->sendResponse($payments, 'Payments retrieved successfully');

        } catch (\Exception $e) {
            \Log::error('PaymentController@index: ' . $e->getMessage());
            return $this->sendError('Error retrieving payments', [], 500);
        }
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'type'         => 'required|in:CLIENT,SUPPLIER,DEPOT,RETRAIT',
            'method'       => 'required|in:ORANGE_MONEY,WAVE,MTN_MONEY,VIREMENT,CHEQUE,ESPECES',
            'amount'       => 'required|numeric|min:0.01',
            'currency'     => 'nullable|string|max:10',
            'target_currency'   => 'nullable|string|max:10',
            'target_account_id' => 'nullable|exists:client_currency_accounts,id',
            'exchange_rate'=> 'nullable|numeric|min:0.0001',
            'amount_gnf'   => 'nullable|numeric|min:0.01',
            'proof'        => 'nullable|string|max:255',
            'reference'    => 'nullable|string|max:255',
            'description'  => 'nullable|string|max:1000',
            'status'       => 'nullable|in:PENDING,COMPLETED,FAILED,CANCELLED',
            'payment_date'      => 'required|date',
            'client_id'         => 'nullable|exists:clients,id',
            'paid_by_client_id' => 'nullable|exists:clients,id|different:client_id',
            'invoice_id'        => 'nullable|exists:invoices,id',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $user     = Auth::user();
        $tenantId = $this->requestTenantId($request);

        if (!$tenantId) {
            return $this->sendError('Tenant ID required', [], 400);
        }

        $scopeError = $this->validatePaymentScope($request, $tenantId);
        if ($scopeError) {
            return $scopeError;
        }

        DB::beginTransaction();
        try {
            $currency = strtoupper($request->currency ?? 'GNF');

            // ── Routage vers compte-devise client + conversion eventuelle ──
            $routing = $this->routePaymentToAccount($request, $tenantId, $currency, (float) $request->amount);
            if (!empty($routing['error'])) {
                DB::rollBack();
                return $this->sendError($routing['error'], ['exchange_rate' => [$routing['error']]], 422);
            }
            $exchangeRate = $routing['exchange_rate'];
            $amountGnf    = $routing['amount_gnf'];

            $payment = Payment::create([
                'tenant_id'         => $tenantId,
                'client_id'         => $request->client_id,
                'paid_by_client_id' => $request->paid_by_client_id,
                'invoice_id'        => $request->invoice_id,
                'receipt_number'    => $this->generateReceiptNumber($tenantId),
                'type'              => $request->type,
                'method'            => $request->method,
                'amount'            => $request->amount,
                'currency'          => $currency,
                'target_currency'   => $routing['target_currency'],
                'target_account_id' => $routing['target_account_id'],
                'exchange_rate'     => $exchangeRate,
                'amount_gnf'        => $amountGnf,
                'converted_amount'  => $routing['converted_amount'],
                'conversion_rate'   => $routing['conversion_rate'],
                'proof'             => $request->proof,
                'reference'         => $request->reference,
                'description'       => $request->description,
                'status'            => $request->status ?? 'COMPLETED',
                'payment_date'      => $request->payment_date,
            ]);

            // Le solde du compte-devise est recalcule automatiquement (AccountBalanceService).

            // Update invoice paid_amount if linked
            if ($request->invoice_id) {
                Invoice::where('tenant_id', $tenantId)->findOrFail($request->invoice_id)->recalculatePaidAmount();
            }

            DB::commit();

            return $this->sendResponse(
                $payment->load(['client', 'invoice', 'targetAccount']),
                'Payment created successfully',
                201
            );

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('PaymentController@store: ' . $e->getMessage());
            return $this->sendError('Error creating payment', ['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Versement multi-devise en une seule operation.
     * Cree N Payments (un par entree) avec le meme payment_group_id pour les regrouper.
     *
     * Payload :
     * {
     *   client_id, paid_by_client_id?, payment_date, method, type, reference?, description?, status?,
     *   entries: [
     *     { amount, currency, target_account_id?, target_currency?, exchange_rate? },
     *     ...
     *   ]
     * }
     */
    public function storeBatch(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'type'              => 'required|in:CLIENT,SUPPLIER,DEPOT,RETRAIT',
            'method'            => 'required|in:ORANGE_MONEY,WAVE,MTN_MONEY,VIREMENT,CHEQUE,ESPECES',
            'payment_date'      => 'required|date',
            'client_id'         => 'nullable|exists:clients,id',
            'paid_by_client_id' => 'nullable|exists:clients,id|different:client_id',
            'invoice_id'        => 'nullable|exists:invoices,id',
            'reference'         => 'nullable|string|max:255',
            'description'       => 'nullable|string|max:1000',
            'status'            => 'nullable|in:PENDING,COMPLETED,FAILED,CANCELLED',
            'entries'                          => 'required|array|min:1',
            'entries.*.amount'                 => 'required|numeric|min:0.01',
            'entries.*.currency'               => 'required|string|max:10',
            'entries.*.target_currency'        => 'nullable|string|max:10',
            'entries.*.target_account_id'      => 'nullable|exists:client_currency_accounts,id',
            'entries.*.exchange_rate'          => 'nullable|numeric|min:0.0001',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $tenantId = $this->requestTenantId($request);

        if (!$tenantId) {
            return $this->sendError('Tenant ID required', [], 400);
        }

        $scopeError = $this->validatePaymentScope($request, $tenantId);
        if ($scopeError) {
            return $scopeError;
        }

        DB::beginTransaction();
        try {
            $groupId  = (string) \Illuminate\Support\Str::uuid();
            $created  = [];

            foreach ($request->entries as $entry) {
                $currency = strtoupper($entry['currency']);
                $entryRequest = new Request(array_merge($request->except('entries'), $entry));
                $entryScopeError = $this->validatePaymentScope($entryRequest, $tenantId);
                if ($entryScopeError) {
                    DB::rollBack();
                    return $entryScopeError;
                }
                $routing = $this->routePaymentToAccount($entryRequest, $tenantId, $currency, (float) $entry['amount']);
                if (!empty($routing['error'])) {
                    DB::rollBack();
                    return $this->sendError($routing['error'], ['entries' => [$routing['error']]], 422);
                }
                $exchangeRate = $routing['exchange_rate'];
                $amountGnf    = $routing['amount_gnf'];

                $payment = Payment::create([
                    'tenant_id'         => $tenantId,
                    'client_id'         => $request->client_id,
                    'paid_by_client_id' => $request->paid_by_client_id,
                    'invoice_id'        => $request->invoice_id,
                    'receipt_number'    => $this->generateReceiptNumber($tenantId),
                    'payment_group_id'  => $groupId,
                    'type'              => $request->type,
                    'method'            => $request->method,
                    'amount'            => $entry['amount'],
                    'currency'          => $currency,
                    'target_currency'   => $routing['target_currency'],
                    'target_account_id' => $routing['target_account_id'],
                    'exchange_rate'     => $exchangeRate,
                    'amount_gnf'        => $amountGnf,
                    'converted_amount'  => $routing['converted_amount'],
                    'conversion_rate'   => $routing['conversion_rate'],
                    'reference'         => $request->reference,
                    'description'       => $request->description,
                    'status'            => $request->status ?? 'COMPLETED',
                    'payment_date'      => $request->payment_date,
                ]);

                $created[] = $payment->load(['client:id,name', 'targetAccount']);
            }

            if ($request->invoice_id) {
                Invoice::where('tenant_id', $tenantId)->findOrFail($request->invoice_id)->recalculatePaidAmount();
            }

            DB::commit();
            return $this->sendResponse([
                'payment_group_id' => $groupId,
                'payments'         => $created,
            ], 'Batch payment created successfully', 201);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('PaymentController@storeBatch: ' . $e->getMessage());
            return $this->sendError('Error creating batch payment', ['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Resout le compte cible + montant converti pour un paiement client.
     *
     * Cas :
     *   - target_account_id fourni : on l'utilise tel quel (le client a choisi)
     *   - target_currency fourni : on resout / cree le compte
     *   - sinon : compte de la devise de paiement (GNF par defaut)
     *
     * La conversion utilise l'exchange_rate fourni :
     *   - Paiement GNF -> compte USD : converted = amount / exchange_rate
     *   - Paiement USD -> compte GNF : converted = amount * exchange_rate
     *   - Meme devise : converted = amount, conversion_rate = 1
     */
    private function routePaymentToAccount(
        Request $request,
        int $tenantId,
        string $paymentCurrency,
        float $amount,
        ?float $fallbackGnfRate = null
    ): array {
        $provided = $request->filled('exchange_rate') ? (float) $request->exchange_rate : null;

        // Compte cible : uniquement pour un versement client
        $targetAccount = null;
        if ($request->type === 'CLIENT' && $request->client_id) {
            $client = Client::where('tenant_id', $tenantId)->find($request->client_id);
            if ($client) {
                if ($request->filled('target_account_id')) {
                    $targetAccount = ClientCurrencyAccount::where('tenant_id', $tenantId)
                        ->where('client_id', $client->id)
                        ->find($request->target_account_id);
                }
                if (!$targetAccount) {
                    $targetAccount = $client->getAccount(strtoupper($request->target_currency ?: $paymentCurrency));
                }
            }
        }
        $targetCurrency = $targetAccount ? strtoupper($targetAccount->currency) : $paymentCurrency;

        // Deux taux distincts, a ne pas confondre :
        //  - $gnfRate       : devise recue -> GNF (equivalent GNF du versement) ;
        //  - $targetGnfRate : devise du compte impute -> GNF (conversion).
        // Le taux saisi decrit la devise etrangere de l'operation : celle du
        // versement, ou celle du compte quand on verse des GNF sur un compte USD.
        $gnfRate = GnfRate::resolve(
            $tenantId,
            $paymentCurrency,
            $paymentCurrency !== 'GNF' ? ($provided ?? $fallbackGnfRate) : null
        );
        if ($gnfRate === null) {
            return ['error' => GnfRate::missingMessage($paymentCurrency)];
        }
        $targetGnfRate = $targetCurrency === $paymentCurrency
            ? $gnfRate
            : GnfRate::resolve($tenantId, $targetCurrency, $paymentCurrency === 'GNF' ? ($provided ?? $fallbackGnfRate) : null);
        if ($targetGnfRate === null) {
            return ['error' => GnfRate::missingMessage($targetCurrency)];
        }

        $amountGnf = $paymentCurrency === 'GNF' ? round($amount, 2) : round($amount * $gnfRate, 2);

        if (!$targetAccount) {
            return [
                'error'             => null,
                'target_currency'   => null,
                'target_account_id' => null,
                'converted_amount'  => null,
                'conversion_rate'   => null,
                'exchange_rate'     => $gnfRate,
                'amount_gnf'        => $amountGnf,
            ];
        }

        if ($paymentCurrency === $targetCurrency) {
            $convertedAmount = round($amount, 2);
            $conversionRate  = 1.0;
        } else {
            // Passage par le GNF : montant -> GNF -> devise du compte
            $convertedAmount = round($amount * $gnfRate / $targetGnfRate, 2);
            $conversionRate  = $paymentCurrency === 'GNF'
                ? $targetGnfRate
                : ($targetCurrency === 'GNF' ? $gnfRate : round($gnfRate / $targetGnfRate, 6));
        }

        return [
            'error'             => null,
            'target_currency'   => $targetCurrency,
            'target_account_id' => $targetAccount->id,
            'converted_amount'  => $convertedAmount,
            'conversion_rate'   => $conversionRate,
            // Taux affiche sur le recu : celui de la devise etrangere de l'operation
            'exchange_rate'     => $paymentCurrency === 'GNF' ? $targetGnfRate : $gnfRate,
            'amount_gnf'        => $amountGnf,
        ];
    }

    private function validatePaymentScope(Request $request, int $tenantId, ?Payment $payment = null)
    {
        $clientId = $request->input('client_id') ?? $payment?->client_id;
        $paidByClientId = $request->input('paid_by_client_id') ?? $payment?->paid_by_client_id;
        $invoiceId = $request->input('invoice_id');
        $targetAccountId = $request->input('target_account_id');

        if ($clientId && !Client::where('tenant_id', $tenantId)->whereKey($clientId)->exists()) {
            return $this->sendError('Client introuvable pour ce tenant.', [
                'client_id' => ['Le client sélectionné n’appartient pas au tenant courant.'],
            ], 422);
        }

        if ($paidByClientId && !Client::where('tenant_id', $tenantId)->whereKey($paidByClientId)->exists()) {
            return $this->sendError('Client payeur introuvable pour ce tenant.', [
                'paid_by_client_id' => ['Le client payeur sélectionné n’appartient pas au tenant courant.'],
            ], 422);
        }

        if ($invoiceId) {
            $invoice = Invoice::where('tenant_id', $tenantId)->find($invoiceId);
            if (!$invoice) {
                return $this->sendError('Facture introuvable pour ce tenant.', [
                    'invoice_id' => ['La facture sélectionnée n’appartient pas au tenant courant.'],
                ], 422);
            }

            if ($clientId && (int) $invoice->client_id !== (int) $clientId) {
                return $this->sendError('La facture ne correspond pas au client sélectionné.', [
                    'invoice_id' => ['Cette facture appartient à un autre client.'],
                ], 422);
            }
        }

        if ($targetAccountId) {
            $accountQuery = ClientCurrencyAccount::where('tenant_id', $tenantId)->whereKey($targetAccountId);
            if ($clientId) {
                $accountQuery->where('client_id', $clientId);
            }

            if (!$accountQuery->exists()) {
                return $this->sendError('Compte devise introuvable pour ce tenant.', [
                    'target_account_id' => ['Le compte devise sélectionné n’appartient pas au client/tenant courant.'],
                ], 422);
            }
        }

        return null;
    }

    public function show($id)
    {
        $payment = Payment::with(['tenant', 'client', 'paidByClient:id,name', 'invoice'])->find($id);

        if (!$payment) {
            return $this->sendError('Payment not found', [], 404);
        }

        $user = Auth::user();
        if (!$user->hasRole('SUPER_ADMIN') && $payment->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        return $this->sendResponse($payment, 'Payment retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $payment = Payment::find($id);

        if (!$payment) {
            return $this->sendError('Payment not found', [], 404);
        }

        $user = Auth::user();
        if (!$user->hasRole('SUPER_ADMIN') && $payment->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $validator = Validator::make($request->all(), [
            'type'         => 'sometimes|in:CLIENT,SUPPLIER,DEPOT,RETRAIT',
            'method'       => 'sometimes|in:ORANGE_MONEY,WAVE,MTN_MONEY,VIREMENT,CHEQUE,ESPECES',
            'amount'       => 'sometimes|numeric|min:0.01',
            'currency'     => 'nullable|string|max:10',
            'target_currency'   => 'nullable|string|max:10',
            'target_account_id' => 'nullable|exists:client_currency_accounts,id',
            'exchange_rate'=> 'nullable|numeric|min:0.0001',
            'amount_gnf'   => 'nullable|numeric|min:0.01',
            'proof'        => 'nullable|string|max:255',
            'reference'    => 'nullable|string|max:255',
            'description'  => 'nullable|string|max:1000',
            'status'       => 'nullable|in:PENDING,COMPLETED,FAILED,CANCELLED',
            'payment_date' => 'sometimes|date',
            'client_id'    => 'nullable|exists:clients,id',
            'paid_by_client_id' => 'nullable|exists:clients,id|different:client_id',
            'invoice_id'   => 'nullable|exists:invoices,id',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $scopeError = $this->validatePaymentScope($request, (int) $payment->tenant_id, $payment);
        if ($scopeError) {
            return $scopeError;
        }

        $oldInvoiceId = $payment->invoice_id;

        DB::beginTransaction();
        try {
            $currency = strtoupper($request->currency ?? $payment->currency ?? 'GNF');
            $targetCurrency = strtoupper($request->target_currency ?: ($payment->target_currency ?: $currency));

            $requestedTargetAccountId = $request->filled('target_account_id')
                ? $request->input('target_account_id')
                : ($targetCurrency === strtoupper($payment->target_currency ?: '') ? $payment->target_account_id : null);
            $routingRequest = $request->duplicate();
            $routingRequest->merge([
                'type' => $request->input('type', $payment->type),
                'client_id' => $request->input('client_id', $payment->client_id),
                'target_currency' => $targetCurrency,
                'target_account_id' => $requestedTargetAccountId,
            ]);
            // Sans nouveau taux saisi, on garde celui du versement s'il est exploitable
            $routing = $this->routePaymentToAccount(
                $routingRequest,
                (int) $payment->tenant_id,
                $currency,
                (float) ($request->amount ?? $payment->amount),
                $currency === strtoupper((string) $payment->currency) && (float) $payment->exchange_rate > 1
                    ? (float) $payment->exchange_rate
                    : null
            );
            if (!empty($routing['error'])) {
                DB::rollBack();
                return $this->sendError($routing['error'], ['exchange_rate' => [$routing['error']]], 422);
            }
            $exchangeRate = $routing['exchange_rate'];
            $amountGnf    = $routing['amount_gnf'];

            $payload = $request->only([
                'type', 'method', 'amount', 'currency', 'proof',
                'reference', 'description', 'status', 'payment_date',
                'client_id', 'paid_by_client_id', 'invoice_id',
            ]);
            $payload['currency'] = $currency;
            $payload['exchange_rate'] = $exchangeRate;
            $payload['amount_gnf'] = $amountGnf;
            $payload['target_currency'] = $routing['target_currency'];
            $payload['target_account_id'] = $routing['target_account_id'];
            $payload['converted_amount'] = $routing['converted_amount'];
            $payload['conversion_rate'] = $routing['conversion_rate'];

            $payment->update($payload);

            // Recalculate old and new invoice if changed
            if ($oldInvoiceId && $oldInvoiceId !== $payment->invoice_id) {
                Invoice::find($oldInvoiceId)?->recalculatePaidAmount();
            }
            if ($payment->invoice_id) {
                Invoice::find($payment->invoice_id)?->recalculatePaidAmount();
            }

            DB::commit();
            return $this->sendResponse($payment->load(['client', 'invoice']), 'Payment updated successfully');

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('PaymentController@update: ' . $e->getMessage());
            return $this->sendError('Error updating payment', [], 500);
        }
    }

    public function destroy($id)
    {
        $payment = Payment::find($id);

        if (!$payment) {
            return $this->sendError('Payment not found', [], 404);
        }

        $user = Auth::user();
        if (!$user->hasRole('SUPER_ADMIN') && $payment->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $invoiceId = $payment->invoice_id;

        DB::transaction(function () use ($payment, $invoiceId) {
            $payment->delete();
            if ($invoiceId) {
                Invoice::find($invoiceId)?->recalculatePaidAmount();
            }
        });

        return $this->sendResponse([], 'Payment deleted successfully');
    }

    /**
     * Return receipt data for a payment (used for PDF generation on frontend).
     */
    public function getReceipt($id)
    {
        $payment = Payment::with(['tenant', 'client', 'paidByClient:id,name', 'invoice'])->find($id);

        if (!$payment) {
            return $this->sendError('Payment not found', [], 404);
        }

        $user = Auth::user();
        if (!$user->hasRole('SUPER_ADMIN') && $payment->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $tenant = $payment->tenant;

        $receipt = [
            'receipt_number'  => $payment->receipt_number,
            'payment_date'    => $payment->payment_date->format('d/m/Y'),
            'amount'          => $payment->amount,
            'currency'        => $payment->currency,
            'exchange_rate'   => $payment->exchange_rate,
            'amount_gnf'      => $payment->amount_gnf,
            'method'          => $payment->method,
            'type'            => $payment->type,
            'reference'       => $payment->reference,
            'description'     => $payment->description,
            'status'          => $payment->status,
            'client'          => $payment->client ? [
                'id'    => $payment->client->id,
                'name'  => $payment->client->name,
                'phone' => $payment->client->phone1,
            ] : null,
            'invoice'         => $payment->invoice ? [
                'id'                => $payment->invoice->id,
                'invoice_number'    => $payment->invoice->invoice_number,
                'total_amount'      => $payment->invoice->total_amount,
                'paid_amount'       => $payment->invoice->paid_amount,
                'remaining_balance' => $payment->invoice->remaining_balance,
                'status'            => $payment->invoice->status,
            ] : null,
            'organisation'    => [
                'name' => $tenant->name ?? '',
            ],
            'generated_at'    => now()->format('d/m/Y H:i'),
        ];

        return $this->sendResponse($receipt, 'Receipt generated successfully');
    }

    /**
     * Client balance: total invoiced, paid, remaining.
     */
    public function getClientBalance(Request $request, $clientId)
    {
        $user = Auth::user();

        if ($user->hasRole('SUPER_ADMIN')) {
            $client = Client::find($clientId);
        } else {
            $client = Client::where('id', $clientId)
                ->where('tenant_id', $user->tenant_id)
                ->first();
        }

        if (!$client) {
            return $this->sendError('Client not found', [], 404);
        }

        $tenantId = $client->tenant_id;

        $invoices = Invoice::where('client_id', $clientId)
            ->where('tenant_id', $tenantId)
            ->get();

        $linkedPayments = Payment::where('client_id', $clientId)
            ->where('tenant_id', $tenantId)
            ->where('status', 'COMPLETED')
            ->whereNotNull('invoice_id')
            ->get();

        $unappliedPayments = Payment::where('client_id', $clientId)
            ->where('tenant_id', $tenantId)
            ->where('status', 'COMPLETED')
            ->whereNull('invoice_id')
            ->where('type', 'CLIENT')
            ->get();

        $totalInvoiced  = $invoices->sum(fn ($invoice) => $this->invoiceTotalGnf($invoice));
        // Paiements imputes a une facture. Le total encaisse (total_paid) y ajoute
        // les versements non imputes, sinon l'index et la fiche client affichent
        // deux montants differents sous le meme libelle "Total paye".
        $paidOnInvoices = (float) $linkedPayments->sum(fn ($payment) => $payment->amount_gnf);
        $returnCredits  = ProductReturn::where('client_id', $clientId)
            ->where('tenant_id', $tenantId)
            ->whereNull('invoice_id')
            ->where('status', 'APPROVED')
            ->whereNull('client_advance_id')
            ->get()
            ->sum(fn (ProductReturn $return) => $this->productReturnCreditGnf($return));
        $availableCredit = (float) $unappliedPayments->sum(fn ($payment) => $payment->amount_gnf);
        $container      = $this->containerTotalsGnf((int) $clientId, $tenantId);
        $totalInvoiced += $container['sold'];
        $totalPaid      = $paidOnInvoices + $availableCredit + $container['paid'];
        $totalRemaining = max(0, $totalInvoiced - $totalPaid - (float) $returnCredits);
        $balancesByCurrency = $this->clientBalancesByCurrency($clientId, $tenantId);

        $payments = Payment::where('client_id', $clientId)
            ->where('tenant_id', $tenantId)
            ->where('status', 'COMPLETED')
            ->orderBy('payment_date', 'desc')
            ->get();

        return $this->sendResponse([
            'client'          => ['id' => $client->id, 'name' => $client->name, 'phone' => $client->phone1],
            'total_invoiced'  => $totalInvoiced,
            'total_paid'      => $totalPaid,
            'paid_on_invoices' => $paidOnInvoices,
            'total_remaining' => $totalRemaining,
            'available_credit_gnf' => $availableCredit,
            'total_return_credits' => (float) $returnCredits,
            'balances_by_currency' => $balancesByCurrency,
            'invoices'        => $invoices->map(fn ($i) => [
                'id'                => $i->id,
                'invoice_number'    => $i->invoice_number,
                'total_amount'      => $i->total_amount,
                'paid_amount'       => $i->paid_amount,
                'remaining_balance' => $i->remaining_balance,
                'total_amount_gnf'  => $this->invoiceTotalGnf($i),
                'paid_amount_gnf'   => $this->invoicePaidGnf($i),
                'remaining_balance_gnf' => max(0, $this->invoiceTotalGnf($i) - $this->invoicePaidGnf($i)),
                'status'            => $i->status,
                'due_date'          => $i->due_date?->format('d/m/Y'),
            ]),
            'recent_payments' => $payments->take(10)->map(fn ($p) => [
                'id'             => $p->id,
                'receipt_number' => $p->receipt_number,
                'amount'         => $p->amount,
                'amount_gnf'     => (float) ($p->amount_gnf ?? $p->amount),
                'currency'       => $p->currency,
                'exchange_rate'  => (float) ($p->exchange_rate ?? 1),
                'method'         => $p->method,
                'payment_date'   => $p->payment_date->format('d/m/Y'),
                'invoice_id'     => $p->invoice_id,
            ]),
        ], 'Client balance retrieved successfully');
    }

    /**
     * Dashboard: balances for all clients of the tenant.
     */
    public function getClientsBalances(Request $request)
    {
        $user     = Auth::user();
        $tenantId = $this->requestTenantId($request);

        if (!$tenantId && !$user->hasRole('SUPER_ADMIN')) {
            return $this->sendError('Tenant ID required', [], 400);
        }

        $invoices = Invoice::with('client')
            ->when($tenantId, fn ($query) => $query->where('tenant_id', $tenantId))
            ->get()
            ->groupBy('client_id');

        // Chargement groupe : 4 requetes pour tous les clients, au lieu de 5 par client
        $scoped = fn ($query) => $query->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId));
        $none = collect();
        $paymentsByClient = $scoped(Payment::query())->where('status', 'COMPLETED')->where('type', 'CLIENT')
            ->get()->groupBy('client_id');
        $returnsByClient = $scoped(ProductReturn::query())->whereNull('invoice_id')->where('status', 'APPROVED')
            ->whereNull('client_advance_id')->get()->groupBy('client_id');
        $soldByClient = $scoped(ContainerSale::query())->where('status', '!=', 'ANNULE')
            ->selectRaw('client_id, COALESCE(SUM(sale_price_gnf), 0) as total')->groupBy('client_id')->pluck('total', 'client_id');
        $containerPaidByClient = $scoped(ContainerSalePayment::query())
            ->where(fn ($q) => $q->whereNull('payment_type')->orWhere('payment_type', '!=', 'AVANCE'))
            ->selectRaw('client_id, COALESCE(SUM(amount_gnf), 0) as total')->groupBy('client_id')->pluck('total', 'client_id');

        $balances = $invoices->map(function ($clientInvoices) use ($paymentsByClient, $returnsByClient, $soldByClient, $containerPaidByClient, $none) {
            $client = $clientInvoices->first()->client;
            $clientId = $client?->id;
            // Montant propre des factures : le solde anterieur reporte n'est pas recompte
            $totalInvoiced = $clientInvoices->sum(function ($invoice) {
                $own = AccountBalanceService::invoiceOwnAmount($invoice);
                $rate = strtoupper((string) ($invoice->currency ?? 'GNF')) === 'GNF' ? 1.0 : (float) ($invoice->exchange_rate ?: 0);
                return $own * $rate;
            });
            $clientPayments = $paymentsByClient->get($clientId, $none);
            $paidOnInvoices = (float) $clientPayments->whereNotNull('invoice_id')->sum(fn ($payment) => $payment->amount_gnf);
            $availableCredit = (float) $clientPayments->whereNull('invoice_id')->sum(fn ($payment) => $payment->amount_gnf);
            $returnCredits = (float) $returnsByClient->get($clientId, $none)
                ->sum(fn (ProductReturn $return) => $this->productReturnCreditGnf($return));
            $container = [
                'sold' => (float) ($soldByClient[$clientId] ?? 0),
                'paid' => (float) ($containerPaidByClient[$clientId] ?? 0),
            ];
            $totalInvoiced += $container['sold'];
            $totalPaid = $paidOnInvoices + $availableCredit + $container['paid'];

            return [
                'client_id'       => $client?->id,
                'client_name'     => $client?->name ?? 'Inconnu',
                'client_phone'    => $client?->phone1,
                'total_invoiced'  => $totalInvoiced,
                'total_paid'      => $totalPaid,
                'paid_on_invoices' => $paidOnInvoices,
                'available_credit_gnf' => $availableCredit,
                'total_remaining' => max(0, $totalInvoiced - $totalPaid - $returnCredits),
                'invoice_count'   => $clientInvoices->count(),
            ];
        })->values()->sortByDesc('total_remaining')->values();

        return $this->sendResponse($balances, 'Clients balances retrieved successfully');
    }

    /**
     * Optimised finance dashboard: all KPIs in 5 queries instead of 18+.
     */
    public function financeDashboard(Request $request)
    {
        try {
            $user        = Auth::user();
            $isSuperAdmin = $user->hasRole('SUPER_ADMIN');
            $tenantId    = $isSuperAdmin
                ? ($request->get('tenant_id') ?? $user->tenant_id)
                : $user->tenant_id;

            if (!$tenantId && !$isSuperAdmin) {
                return $this->sendError('Tenant ID required', [], 400);
            }

            // ── 1. Payment KPIs + breakdown (1 query) ───────────────────────
            $startOfMonth = Carbon::now()->startOfMonth()->toDateString();
            $endOfMonth   = Carbon::now()->endOfMonth()->toDateString();

            $pStats = Payment::where('status', 'COMPLETED')
                ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
                ->selectRaw("
                    COUNT(*) as total_payments,
                    COALESCE(SUM(amount_gnf), 0) as total_amount,
                    COALESCE(AVG(amount_gnf), 0) as average_payment,
                    COALESCE(SUM(CASE WHEN payment_date BETWEEN ? AND ? THEN amount_gnf ELSE 0 END), 0) as monthly_amount,
                    COALESCE(SUM(CASE WHEN type = 'CLIENT'   THEN amount_gnf ELSE 0 END), 0) as type_client,
                    COALESCE(SUM(CASE WHEN type = 'SUPPLIER' THEN amount_gnf ELSE 0 END), 0) as type_supplier,
                    COALESCE(SUM(CASE WHEN type = 'DEPOT'    THEN amount_gnf ELSE 0 END), 0) as type_depot,
                    COALESCE(SUM(CASE WHEN type = 'RETRAIT'  THEN amount_gnf ELSE 0 END), 0) as type_retrait,
                    COALESCE(SUM(CASE WHEN method = 'ESPECES'       THEN amount_gnf ELSE 0 END), 0) as m_especes,
                    COALESCE(SUM(CASE WHEN method = 'ORANGE_MONEY'  THEN amount_gnf ELSE 0 END), 0) as m_orange,
                    COALESCE(SUM(CASE WHEN method = 'WAVE'          THEN amount_gnf ELSE 0 END), 0) as m_wave,
                    COALESCE(SUM(CASE WHEN method = 'MTN_MONEY'     THEN amount_gnf ELSE 0 END), 0) as m_mtn,
                    COALESCE(SUM(CASE WHEN method = 'VIREMENT'      THEN amount_gnf ELSE 0 END), 0) as m_virement,
                    COALESCE(SUM(CASE WHEN method = 'CHEQUE'        THEN amount_gnf ELSE 0 END), 0) as m_cheque
                ", [$startOfMonth, $endOfMonth])
                ->first();

            // ── 2. Invoice KPIs (1 query) ────────────────────────────────────
            $iStats = Invoice::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
                ->selectRaw("
                    COUNT(*) as total,
                    COALESCE(SUM(CASE WHEN status = 'PAYE'    THEN 1 ELSE 0 END), 0) as paye,
                    COALESCE(SUM(CASE WHEN status = 'PARTIEL' THEN 1 ELSE 0 END), 0) as partiel,
                    COALESCE(SUM(CASE WHEN status = 'IMPAYE'  THEN 1 ELSE 0 END), 0) as impaye,
                    COALESCE(SUM(total_amount - paid_amount), 0) as total_remaining
                ")
                ->first();

            // ── 3. Currency count (1 query) ──────────────────────────────────
            $currencyCount = Currency::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))->count();

            // ── 4. Recent payments — limited columns, only client name (1 query) ──
            $recentPayments = Payment::select(['id', 'receipt_number', 'reference', 'type', 'method', 'amount', 'currency', 'status', 'payment_date', 'client_id'])
                ->with(['client:id,name,phone1'])
                ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
                ->orderBy('payment_date', 'desc')
                ->limit(5)
                ->get();

            // ── 5. Recent invoices — limited columns, only client name (1 query) ─
            $recentInvoices = Invoice::select(['id', 'invoice_number', 'total_amount', 'paid_amount', 'status', 'due_date', 'client_id', 'created_at'])
                ->with(['client:id,name'])
                ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
                ->orderBy('created_at', 'desc')
                ->limit(5)
                ->get();

            $recentExpenses = PersonalExpense::select(['id', 'title', 'amount', 'currency', 'expense_date', 'status', 'category_id'])
                ->with(['category:id,name'])
                ->where('tenant_id', $tenantId)
                ->orderBy('expense_date', 'desc')
                ->limit(5)
                ->get();

            $supplierRelations = Payment::selectRaw('
                    supplier_id,
                    COUNT(*) as payment_count,
                    COALESCE(SUM(amount_gnf), 0) as total_paid,
                    MAX(payment_date) as last_payment_date
                ')
                ->with(['supplier:id,name,phone1'])
                ->where('tenant_id', $tenantId)
                ->where('status', 'COMPLETED')
                ->where('type', 'SUPPLIER')
                ->groupBy('supplier_id')
                ->orderByDesc('total_paid')
                ->limit(5)
                ->get()
                ->map(fn ($item) => [
                    'supplier_id'       => $item->supplier_id,
                    'supplier_name'     => $item->supplier?->name ?? 'Fournisseur',
                    'supplier_phone'    => $item->supplier?->phone1,
                    'payment_count'     => (int) $item->payment_count,
                    'total_paid'        => (float) $item->total_paid,
                    'last_payment_date' => $item->last_payment_date,
                ]);

            $supplierPayments = Payment::select(['id', 'receipt_number', 'reference', 'amount', 'currency', 'payment_date', 'supplier_id', 'method'])
                ->with(['supplier:id,name,phone1'])
                ->where('tenant_id', $tenantId)
                ->where('status', 'COMPLETED')
                ->where('type', 'SUPPLIER')
                ->orderBy('payment_date', 'desc')
                ->limit(10)
                ->get();

            $incomeTotal = (float) Payment::where('tenant_id', $tenantId)
                ->where('status', 'COMPLETED')
                ->whereIn('type', ['CLIENT', 'DEPOT'])
                ->sum('amount_gnf');
            $supplierOutTotal = (float) Payment::where('tenant_id', $tenantId)
                ->where('status', 'COMPLETED')
                ->where('type', 'SUPPLIER')
                ->sum('amount_gnf');
            $bankWithdrawals = (float) Payment::where('tenant_id', $tenantId)
                ->where('status', 'COMPLETED')
                ->where('type', 'RETRAIT')
                ->sum('amount_gnf');
            $expenseTotal = (float) PersonalExpense::where('tenant_id', $tenantId)
                ->where('status', '!=', 'CANCELLED')
                ->sum('amount_gnf');
            $productReturnRefunds = (float) ProductReturn::where('tenant_id', $tenantId)
                ->where('status', 'APPROVED')
                ->where('refund_amount', '>', 0)
                ->whereNull('refund_payment_id')
                ->sum('total_amount_gnf');
            $outgoingTotal = $supplierOutTotal + $bankWithdrawals + $expenseTotal + $productReturnRefunds;

            return $this->sendResponse([
                'payments' => [
                    'total_payments'  => (int) ($pStats->total_payments  ?? 0),
                    'total_amount'    => (float) ($pStats->total_amount   ?? 0),
                    'monthly_amount'  => (float) ($pStats->monthly_amount ?? 0),
                    'average_payment' => (float) ($pStats->average_payment ?? 0),
                    'by_type' => [
                        'CLIENT'   => (float) ($pStats->type_client   ?? 0),
                        'SUPPLIER' => (float) ($pStats->type_supplier ?? 0),
                        'DEPOT'    => (float) ($pStats->type_depot    ?? 0),
                        'RETRAIT'  => (float) ($pStats->type_retrait  ?? 0),
                    ],
                    'by_method' => [
                        'ESPECES'      => (float) ($pStats->m_especes  ?? 0),
                        'ORANGE_MONEY' => (float) ($pStats->m_orange   ?? 0),
                        'WAVE'         => (float) ($pStats->m_wave     ?? 0),
                        'MTN_MONEY'    => (float) ($pStats->m_mtn      ?? 0),
                    'VIREMENT'     => (float) ($pStats->m_virement ?? 0),
                    'CHEQUE'       => (float) ($pStats->m_cheque   ?? 0),
                    ],
                ],
                'cashflow' => [
                    'income_total'      => $incomeTotal,
                    'supplier_out_total' => $supplierOutTotal,
                    'bank_withdrawals'   => $bankWithdrawals,
                    'expense_total'      => $expenseTotal,
                    'product_return_refunds' => $productReturnRefunds,
                    'outgoing_total'     => $outgoingTotal,
                    'net_cashflow'       => $incomeTotal - $outgoingTotal,
                ],
                'invoices' => [
                    'total'           => (int)   ($iStats->total           ?? 0),
                    'paye'            => (int)   ($iStats->paye            ?? 0),
                    'partiel'         => (int)   ($iStats->partiel         ?? 0),
                    'impaye'          => (int)   ($iStats->impaye          ?? 0),
                    'total_remaining' => (float) ($iStats->total_remaining ?? 0),
                ],
                'currencies_count'  => $currencyCount,
                'recent_payments'   => $recentPayments,
                'recent_invoices'   => $recentInvoices,
                'recent_expenses'   => $recentExpenses,
                'supplier_relations' => $supplierRelations,
                'recent_supplier_payments' => $supplierPayments,
            ], 'Finance dashboard retrieved successfully');

        } catch (\Exception $e) {
            \Log::error('PaymentController@financeDashboard: ' . $e->getMessage());
            return $this->sendError('Error retrieving finance dashboard', [], 500);
        }
    }

    /**
     * Marges bénéficiaires (factures + ventes conteneurs) sur une période.
     * Query params : from=YYYY-MM-DD, to=YYYY-MM-DD (obligatoires côté UI).
     */
    public function marginsReport(Request $request)
    {
        try {
            $user     = Auth::user();
            $tenantId = $user->hasRole('SUPER_ADMIN')
                ? ($request->tenant_id ?? $user->tenant_id)
                : $user->tenant_id;
            if (!$tenantId) return $this->sendError('Tenant ID required', [], 400);

            $from = $request->get('from');
            $to   = $request->get('to');

            // ── Factures ────────────────────────────────────────────────
            $invoicesQuery = Invoice::with([
                'client:id,name,phone1',
                'items.product:id,name,purchase_price,carton_purchase_price,units_per_carton',
            ])->where('tenant_id', $tenantId);
            if ($from) $invoicesQuery->whereDate('created_at', '>=', $from);
            if ($to)   $invoicesQuery->whereDate('created_at', '<=', $to);
            $invoices = $invoicesQuery->orderByDesc('created_at')->get();

            $invoiceRows = [];
            $invRevGnf = 0.0; $invCostGnf = 0.0;
            foreach ($invoices as $inv) {
                $revenue = 0.0; $cost = 0.0;
                foreach ($inv->items as $it) {
                    if ($it->is_sample) continue;
                    $unitCost = $this->unitCostForItem($it);
                    $cost     += $unitCost * (float) $it->quantity;
                    $revenue  += (float) $it->line_total;
                }
                $rate = (float) ($inv->exchange_rate ?: 1);
                $revGnf  = ($inv->currency === 'GNF') ? $revenue : $revenue * $rate;
                // Les prix d'achat des produits sont en GNF, quelle que soit la devise de la facture
                $costGnf = $cost;
                $marginGnf = $revGnf - $costGnf;
                $pct = $revGnf > 0 ? round(($marginGnf / $revGnf) * 100, 2) : null;
                $invRevGnf  += $revGnf;
                $invCostGnf += $costGnf;
                $invoiceRows[] = [
                    'id'             => $inv->id,
                    'invoice_number' => $inv->invoice_number,
                    'date'           => $inv->created_at?->format('Y-m-d'),
                    'client_name'    => $inv->client?->name,
                    'currency'       => $inv->currency,
                    'revenue'        => round($revenue, 2),
                    'cost'           => round($cost, 2),
                    'revenue_gnf'    => round($revGnf, 2),
                    'cost_gnf'       => round($costGnf, 2),
                    'margin_gnf'     => round($marginGnf, 2),
                    'margin_pct'     => $pct,
                ];
            }
            $invMarginGnf = $invRevGnf - $invCostGnf;

            // ── Ventes conteneurs (par arrivage) ────────────────────────
            $containerSaleRows = \DB::table('container_sales')
                ->join('container_arrivals', 'container_sales.container_arrival_id', '=', 'container_arrivals.id')
                ->join('containers', 'container_arrivals.container_id', '=', 'containers.id')
                ->leftJoin('product_categories', 'container_arrivals.product_category_id', '=', 'product_categories.id')
                ->leftJoin('suppliers', 'container_arrivals.supplier_id', '=', 'suppliers.id')
                ->whereNull('container_sales.deleted_at')
                ->where('container_sales.tenant_id', $tenantId)
                ->when($from, fn ($q) => $q->whereDate('container_sales.sale_date', '>=', $from))
                ->when($to,   fn ($q) => $q->whereDate('container_sales.sale_date', '<=', $to))
                ->selectRaw('
                    container_sales.id as sale_id,
                    container_sales.container_arrival_id as arrival_id,
                    containers.container_number,
                    container_arrivals.arrival_date,
                    container_arrivals.total_quantity as total_quantity,
                    container_arrivals.purchase_price as arrival_purchase_price,
                    container_arrivals.purchase_price_gnf as arrival_purchase_price_gnf,
                    container_arrivals.currency as arrival_currency,
                    container_arrivals.exchange_rate as arrival_rate,
                    product_categories.name as product_category,
                    suppliers.name as supplier_name,
                    container_sales.quantity_sold,
                    container_sales.sale_price,
                    container_sales.currency as sale_currency,
                    container_sales.exchange_rate as sale_rate,
                    container_sales.sale_price_gnf
                ')
                ->get();

            $ctnRevGnf = 0.0; $ctnCostGnf = 0.0;
            $containers = [];
            foreach ($containerSaleRows->groupBy('arrival_id') as $arrivalId => $sales) {
                $first = $sales->first();
                $totalQuantity = max((float) $first->total_quantity, 0.0);
                $arrivalCurrency = strtoupper((string) ($first->arrival_currency ?? 'GNF'));
                $arrivalRate = (float) ($first->arrival_rate ?: 1);
                $arrivalPurchaseNative = (float) $first->arrival_purchase_price;
                $arrivalPurchaseGnf = $first->arrival_purchase_price_gnf !== null
                    ? (float) $first->arrival_purchase_price_gnf
                    : ($arrivalCurrency === 'GNF' ? $arrivalPurchaseNative : $arrivalPurchaseNative * $arrivalRate);

                $quantitySold = 0.0;
                $revenueByCurrency = [];
                $costNative = 0.0;
                $revGnf = 0.0;
                $costGnf = 0.0;

                foreach ($sales as $sale) {
                    $quantity = (float) $sale->quantity_sold;
                    $saleCurrency = strtoupper((string) ($sale->sale_currency ?? 'GNF'));
                    $saleRate = (float) ($sale->sale_rate ?: 1);
                    $saleRevenueNative = (float) $sale->sale_price;
                    $saleRevenueGnf = $sale->sale_price_gnf !== null
                        ? (float) $sale->sale_price_gnf
                        : ($saleCurrency === 'GNF' ? $saleRevenueNative : $saleRevenueNative * $saleRate);

                    $saleCostNative = $totalQuantity > 0
                        ? ($quantity * $arrivalPurchaseNative) / $totalQuantity
                        : 0.0;
                    $saleCostGnf = $totalQuantity > 0
                        ? ($quantity * $arrivalPurchaseGnf) / $totalQuantity
                        : 0.0;

                    $quantitySold += $quantity;
                    $revenueByCurrency[$saleCurrency] = ($revenueByCurrency[$saleCurrency] ?? 0) + $saleRevenueNative;
                    $costNative += $saleCostNative;
                    $revGnf += $saleRevenueGnf;
                    $costGnf += $saleCostGnf;
                }

                $marginGnf = $revGnf - $costGnf;
                $pct = $revGnf > 0 ? round(($marginGnf / $revGnf) * 100, 2) : null;
                $ctnRevGnf  += $revGnf;
                $ctnCostGnf += $costGnf;
                $containers[] = [
                    'arrival_id'        => (int) $arrivalId,
                    'container_number'  => $first->container_number,
                    'arrival_date'      => $first->arrival_date,
                    'product_category'  => $first->product_category,
                    'supplier_name'     => $first->supplier_name,
                    'currency'          => $arrivalCurrency,
                    'quantity_sold'     => round($quantitySold, 2),
                    'revenue'           => round(array_sum($revenueByCurrency), 2),
                    'cost'              => round($costNative, 2),
                    'revenue_by_currency' => collect($revenueByCurrency)
                        ->map(fn ($amount, $currency) => [
                            'currency' => $currency,
                            'amount' => round((float) $amount, 2),
                        ])
                        ->values()
                        ->all(),
                    'cost_currency'     => $arrivalCurrency,
                    'revenue_gnf'       => round($revGnf, 2),
                    'cost_gnf'          => round($costGnf, 2),
                    'margin_gnf'        => round($marginGnf, 2),
                    'margin_pct'        => $pct,
                ];
            }
            $ctnMarginGnf = $ctnRevGnf - $ctnCostGnf;

            $totalRevGnf    = $invRevGnf + $ctnRevGnf;
            $totalCostGnf   = $invCostGnf + $ctnCostGnf;
            $totalMarginGnf = $totalRevGnf - $totalCostGnf;
            $globalPct = $totalRevGnf > 0 ? round(($totalMarginGnf / $totalRevGnf) * 100, 2) : null;

            return $this->sendResponse([
                'summary' => [
                    'from'                => $from,
                    'to'                  => $to,
                    'total_revenue_gnf'   => round($totalRevGnf, 2),
                    'total_cost_gnf'      => round($totalCostGnf, 2),
                    'total_margin_gnf'    => round($totalMarginGnf, 2),
                    'margin_pct'          => $globalPct,
                    'invoices'            => [
                        'count'      => count($invoiceRows),
                        'revenue'    => round($invRevGnf, 2),
                        'cost'       => round($invCostGnf, 2),
                        'margin'     => round($invMarginGnf, 2),
                        'margin_pct' => $invRevGnf > 0 ? round(($invMarginGnf / $invRevGnf) * 100, 2) : null,
                    ],
                    'containers'          => [
                        'count'      => count($containers),
                        'revenue'    => round($ctnRevGnf, 2),
                        'cost'       => round($ctnCostGnf, 2),
                        'margin'     => round($ctnMarginGnf, 2),
                        'margin_pct' => $ctnRevGnf > 0 ? round(($ctnMarginGnf / $ctnRevGnf) * 100, 2) : null,
                    ],
                ],
                'invoices'   => $invoiceRows,
                'containers' => $containers,
            ], 'Marges calculées avec succès');
        } catch (\Exception $e) {
            \Log::error('PaymentController@marginsReport: ' . $e->getMessage());
            return $this->sendError('Erreur lors du calcul des marges', ['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Cout unitaire d'une ligne selon son sale_type.
     *
     * Doit rester identique a InvoiceController::unitCost() : les deux servent
     * a valoriser les memes lignes de facture. Cette version ignorait
     * DEMI_CARTON et DOUZAINE et renvoyait le prix unitaire, ce qui sous-evaluait
     * le cout (jusqu'a 12 fois pour une douzaine) et gonflait donc la marge.
     */

    /**
     * Reste global a recouvrer, exprime en GNF.
     *
     * Doit rester coherent avec getClientBalance()/getFinancialOverview() :
     * les trois repondent a la meme question "combien nous doit-on encore ?".
     */
    private function outstandingReceivableGnf(int $tenantId): float
    {
        $amountCol = Schema::hasColumn('invoices', 'total_amount_gnf') ? 'total_amount_gnf' : 'total_amount';

        $invoiced = (float) (Invoice::where('tenant_id', $tenantId)
            ->selectRaw("SUM(COALESCE({$amountCol}, total_amount) - COALESCE(paid_amount, 0)) as remaining")
            ->value('remaining') ?? 0);

        $unapplied = (float) Payment::where('tenant_id', $tenantId)
            ->where('status', 'COMPLETED')
            ->where('type', 'CLIENT')
            ->whereNull('invoice_id')
            ->sum('amount_gnf');

        return max(0, round($invoiced - $unapplied, 2));
    }

    /**
     * Ventes conteneurs d'un client, en GNF : montant vendu et montant encaisse.
     *
     * Les fiches clients ignoraient ces ventes alors que l'index (getFinancialOverview)
     * les comptait : pour un meme client, les deux ecrans affichaient des dettes
     * differentes. Les modeles utilisent SoftDeletes, donc une vente supprimee avec
     * son arrivage sort automatiquement du calcul.
     */
    private function containerTotalsGnf(int $clientId, ?int $tenantId): array
    {
        $sold = (float) ContainerSale::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->where('client_id', $clientId)
            ->sum('sale_price_gnf');

        $paid = (float) ContainerSalePayment::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->where('client_id', $clientId)
            ->where(fn ($q) => $q->whereNull('payment_type')->orWhere('payment_type', '!=', 'AVANCE'))
            ->sum('amount_gnf');

        return ['sold' => $sold, 'paid' => $paid];
    }

    private function unitCostForItem($item): float
    {
        $p = $item->product ?? null;
        if (!$p) return 0.0;

        $unitsPerCarton = max(1, (int) ($p->units_per_carton ?: 1));
        $unitCost       = (float) ($p->purchase_price ?? 0);
        $cartonCost     = (float) ($p->carton_purchase_price ?: ($unitCost * $unitsPerCarton));

        switch ($item->sale_type) {
            case 'CARTON':      return $cartonCost;
            case 'DEMI_CARTON': return $cartonCost / 2;
            case 'DOUZAINE':    return $unitCost * 12;
            default:            return $unitCost;
        }
    }

    public function getStatistics(Request $request)
    {
        try {
            $user     = Auth::user();
            $tenantId = $user->tenant_id ?? $request->get('tenant_id');

            if (!$tenantId && !$user->hasRole('SUPER_ADMIN')) {
                return $this->sendError('Tenant ID required', [], 400);
            }

            $base = Payment::where('tenant_id', $tenantId)->where('status', 'COMPLETED');
            if ($request->has('date_from')) $base->whereDate('payment_date', '>=', $request->date_from);
            if ($request->has('date_to'))   $base->whereDate('payment_date', '<=', $request->date_to);

            // Une requete groupee par axe, au lieu d'une requete par type et par mode (17 -> 4)
            $sumGnf   = 'COALESCE(SUM(COALESCE(amount_gnf, amount)), 0)';
            $totals   = (clone $base)->selectRaw("COUNT(*) as n, {$sumGnf} as total")->first();
            $byType   = (clone $base)->selectRaw("type, {$sumGnf} as total")->groupBy('type')->pluck('total', 'type');
            $byMethod = (clone $base)->selectRaw("method, {$sumGnf} as total")->groupBy('method')->pluck('total', 'method');
            $byCurrency = (clone $base)->where('type', 'CLIENT')
                ->selectRaw('currency, COUNT(*) as n, COALESCE(SUM(amount), 0) as total')->groupBy('currency')->get();
            $invoiceCounts = Invoice::where('tenant_id', $tenantId)
                ->selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status');
            $count = (int) ($totals->n ?? 0);
            $pick  = fn ($map, array $keys) => collect($keys)->mapWithKeys(fn ($k) => [$k => (float) ($map[$k] ?? 0)])->all();

            $stats = [
                'total_payments'  => $count,
                'total_amount'    => (float) ($totals->total ?? 0),
                'average_payment' => $count > 0 ? (float) $totals->total / $count : 0,
                'by_type'         => $pick($byType, ['CLIENT', 'SUPPLIER', 'DEPOT', 'RETRAIT']),
                'by_method'       => $pick($byMethod, ['ORANGE_MONEY', 'WAVE', 'MTN_MONEY', 'VIREMENT', 'CHEQUE', 'ESPECES']),
                // Encaissements clients par devise recue (GNF et USD ne s'additionnent pas)
                'client_by_currency' => $byCurrency->map(fn ($row) => [
                    'currency' => strtoupper($row->currency ?: 'GNF'),
                    'count'    => (int) $row->n,
                    'total'    => (float) $row->total,
                ])->values(),
                'monthly_trend'   => $this->getMonthlyTrend($tenantId, $request),
                'invoices_summary' => [
                    'total'   => (int) $invoiceCounts->sum(),
                    'paye'    => (int) ($invoiceCounts['PAYE'] ?? 0),
                    'partiel' => (int) ($invoiceCounts['PARTIEL'] ?? 0),
                    'impaye'  => (int) ($invoiceCounts['IMPAYE'] ?? 0),
                    // Reste a recouvrer, aligne sur les fiches clients :
                    //  - en GNF (sommer des montants de devises differentes fausserait le total)
                    //  - diminue des versements clients non encore imputes a une facture,
                    //    car cet argent est deja encaisse.
                    'total_remaining' => $this->outstandingReceivableGnf($tenantId),
                ],
            ];

            return $this->sendResponse($stats, 'Payment statistics retrieved successfully');

        } catch (\Exception $e) {
            \Log::error('PaymentController@getStatistics: ' . $e->getMessage());
            return $this->sendError('Error retrieving statistics', [], 500);
        }
    }

    public function getByDateRange(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'date_from' => 'required|date',
            'date_to'   => 'required|date|after_or_equal:date_from',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $user     = Auth::user();
        $tenantId = $this->requestTenantId($request);

        $payments = Payment::with(['client', 'invoice'])
            ->when($tenantId, fn ($query) => $query->where('tenant_id', $tenantId))
            ->whereBetween('payment_date', [$request->date_from, $request->date_to])
            ->orderBy('payment_date', 'desc')
            ->get();

        return $this->sendResponse($payments, 'Payments retrieved successfully');
    }

    public function bulkDelete(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'payment_ids'   => 'required|array',
            'payment_ids.*' => 'exists:payments,id',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $user     = Auth::user();
        $tenantId = $this->requestTenantId($request);

        $query = Payment::whereIn('id', $request->payment_ids);
        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        // Collect invoice IDs before delete
        $invoiceIds = $query->pluck('invoice_id')->filter()->unique();
        $owners     = (clone $query)->whereNotNull('client_id')->get(['client_id', 'tenant_id'])->unique('client_id');

        $deleted = DB::transaction(function () use ($query, $invoiceIds, $owners) {
            $deleted = $query->delete();

            foreach ($invoiceIds as $invId) {
                Invoice::find($invId)?->recalculatePaidAmount();
            }
            // Suppression par requete : aucun evenement Eloquent, on resynchronise a la main
            foreach ($owners as $owner) {
                AccountBalanceService::syncClient((int) $owner->client_id, (int) $owner->tenant_id);
            }
            return $deleted;
        });

        return $this->sendResponse(['deleted_count' => $deleted], 'Payments deleted successfully');
    }

    public function export(Request $request)
    {
        $user     = Auth::user();
        $tenantId = $this->requestTenantId($request);

        $query = Payment::with(['client', 'invoice'])
            ->when($tenantId, fn ($builder) => $builder->where('tenant_id', $tenantId));

        if ($request->has('type') && $request->type !== '')    $query->where('type', $request->type);
        if ($request->has('method') && $request->method !== '') $query->where('method', $request->method);
        if ($request->has('date_from')) $query->whereDate('payment_date', '>=', $request->date_from);
        if ($request->has('date_to'))   $query->whereDate('payment_date', '<=', $request->date_to);

        $payments = $query->orderBy('payment_date', 'desc')->get();

        return $this->sendResponse($payments, 'Payments exported successfully');
    }

    /**
     * Numero de recu unique : dernier numero attribue + 1, recus supprimes
     * compris. Compter les recus actifs redonnait un numero deja utilise des
     * qu'un versement etait supprime.
     */
    private function generateReceiptNumber(int $tenantId): string
    {
        $year   = now()->year;
        $prefix = sprintf('REC-%d-%d-', $tenantId, $year);

        // Verrou du tenant : deux versements simultanes ne prennent pas le meme numero
        DB::table('tenants')->where('id', $tenantId)->lockForUpdate()->first();

        $last = Payment::withTrashed()
            ->where('tenant_id', $tenantId)
            ->where('receipt_number', 'like', $prefix . '%')
            ->pluck('receipt_number')
            ->map(fn ($number) => (int) substr($number, strlen($prefix)))
            ->max() ?? 0;

        return $prefix . str_pad((string) ($last + 1), 4, '0', STR_PAD_LEFT);
    }

    private function invoiceTotalGnf(Invoice $invoice): float
    {
        return (float) ($invoice->total_amount_gnf ?: $invoice->total_amount);
    }

    private function invoicePaidGnf(Invoice $invoice): float
    {
        return (float) $invoice->payments()
            ->where('status', 'COMPLETED')
            ->get()
            ->sum(fn ($payment) => $payment->amount_gnf);
    }

    private function productReturnCreditGnf(ProductReturn $return): float
    {
        if ($return->total_amount_gnf !== null) {
            return (float) $return->total_amount_gnf;
        }

        $currency = strtoupper((string) ($return->currency ?? 'GNF'));
        $amount = (float) $return->client_credit_amount;
        $rate = (float) ($return->exchange_rate ?: 1);

        return $currency === 'GNF' ? $amount : round($amount * $rate, 2);
    }

    private function clientBalancesByCurrency(int $clientId, int $tenantId): array
    {
        $balances = [];
        $ensure = function (string $currency) use (&$balances): void {
            $currency = strtoupper($currency ?: 'GNF');
            if (!isset($balances[$currency])) {
                $balances[$currency] = [
                    'currency' => $currency,
                    'total_invoiced' => 0.0,
                    'total_paid' => 0.0,
                    'available_credit' => 0.0,
                    'return_credits' => 0.0,
                    'total_remaining' => 0.0,
                ];
            }
        };

        Invoice::where('client_id', $clientId)
            ->where('tenant_id', $tenantId)
            ->get()
            ->each(function (Invoice $invoice) use (&$balances, $ensure) {
                $currency = strtoupper((string) ($invoice->currency ?? 'GNF'));
                $ensure($currency);
                // Montant propre : le solde anterieur reporte est deja porte par les factures precedentes
                $balances[$currency]['total_invoiced'] += AccountBalanceService::invoiceOwnAmount($invoice);
                $balances[$currency]['total_paid'] += (float) $invoice->paid_amount;
            });

        Payment::where('client_id', $clientId)
            ->where('tenant_id', $tenantId)
            ->where('status', 'COMPLETED')
            ->whereNull('invoice_id')
            ->where('type', 'CLIENT')
            ->get()
            ->each(function (Payment $payment) use (&$balances, $ensure) {
                $currency = strtoupper((string) ($payment->target_currency ?: $payment->currency ?: 'GNF'));
                $ensure($currency);
                $credit = $payment->converted_amount !== null
                    ? (float) $payment->converted_amount
                    : (float) $payment->amount;
                $balances[$currency]['available_credit'] += $credit;
            });

        ProductReturn::where('client_id', $clientId)
            ->where('tenant_id', $tenantId)
            ->whereNull('invoice_id')
            ->where('status', 'APPROVED')
            ->whereNull('client_advance_id')
            ->get()
            ->each(function (ProductReturn $return) use (&$balances, $ensure) {
                $currency = strtoupper((string) ($return->currency ?? 'GNF'));
                $ensure($currency);
                $balances[$currency]['return_credits'] += (float) $return->client_credit_amount;
            });

        // Reste a payer et avance : situation reelle du compte dans chaque devise
        // (factures, ventes conteneurs, versements, avances, retours, interets).
        $accounts = AccountBalanceService::clientTotals($clientId, $tenantId);
        foreach (array_keys($accounts) as $currency) {
            $ensure($currency);
        }

        foreach ($balances as $currency => &$balance) {
            $net = (float) ($accounts[$currency]['balance'] ?? 0);
            $balance['total_invoiced'] = round((float) $balance['total_invoiced'], 2);
            $balance['total_paid'] = round((float) $balance['total_paid'], 2);
            $balance['available_credit'] = round((float) $balance['available_credit'], 2);
            $balance['return_credits'] = round((float) $balance['return_credits'], 2);
            $balance['total_debit'] = (float) ($accounts[$currency]['debit'] ?? 0);
            $balance['total_credit'] = (float) ($accounts[$currency]['credit'] ?? 0);
            $balance['total_remaining'] = max(0, round($net, 2));
            $balance['credit_balance'] = max(0, round(-$net, 2));
        }
        unset($balance);

        return array_values($balances);
    }

    private function getMonthlyTrend($tenantId, $request)
    {
        $from = $request->get('date_from', Carbon::now()->subMonths(11)->startOfMonth());
        $to   = $request->get('date_to', Carbon::now()->endOfMonth());

        return Payment::selectRaw('YEAR(payment_date) as year, MONTH(payment_date) as month, SUM(amount_gnf) as total_amount, COUNT(*) as total_count')
            ->where('tenant_id', $tenantId)
            ->where('status', 'COMPLETED')
            ->whereBetween('payment_date', [$from, $to])
            ->groupBy('year', 'month')
            ->orderBy('year')
            ->orderBy('month')
            ->get()
            ->map(fn ($i) => [
                'period' => $i->year . '-' . str_pad($i->month, 2, '0', STR_PAD_LEFT),
                'amount' => $i->total_amount,
                'count'  => $i->total_count,
            ]);
    }
}
