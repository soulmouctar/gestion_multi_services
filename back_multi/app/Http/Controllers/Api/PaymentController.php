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
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
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
            $currency     = strtoupper($request->currency ?? 'GNF');
            $targetCurrency = strtoupper($request->target_currency ?: $currency);
            if ($targetCurrency !== $currency && !$request->filled('exchange_rate')) {
                DB::rollBack();
                return $this->sendError('Taux de change requis pour convertir le paiement.', [
                    'exchange_rate' => ['Le taux de change est requis lorsque la devise reçue diffère de la devise imputée.'],
                ], 422);
            }
            $exchangeRate = $this->resolveExchangeRate($request, $tenantId, $currency);
            $amountGnf    = $this->resolveAmountGnf($request, $currency, $exchangeRate);

            // ── Routage vers compte-devise client + conversion eventuelle ──
            $routing = $this->routePaymentToAccount(
                $request, $tenantId, $currency, (float) $request->amount, $exchangeRate
            );

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

            // Mise a jour du solde du compte-devise client (credit = reduction de dette)
            if ($routing['target_account_id']) {
                $account = ClientCurrencyAccount::where('tenant_id', $tenantId)->find($routing['target_account_id']);
                if ($account) {
                    $account->applyCredit((float) $routing['converted_amount']);
                }
            }

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
                $currency     = strtoupper($entry['currency']);
                $targetCurrency = strtoupper($entry['target_currency'] ?? $currency);
                if ($targetCurrency !== $currency && empty($entry['exchange_rate'])) {
                    DB::rollBack();
                    return $this->sendError('Taux de change requis pour convertir le paiement.', [
                        'entries' => ['Chaque ligne convertie doit avoir un taux de change.'],
                    ], 422);
                }
                $entryRequest = new Request(array_merge($request->except('entries'), $entry));
                $entryScopeError = $this->validatePaymentScope($entryRequest, $tenantId);
                if ($entryScopeError) {
                    DB::rollBack();
                    return $entryScopeError;
                }
                $exchangeRate = $this->resolveExchangeRate($entryRequest, $tenantId, $currency);
                $amountGnf    = $this->resolveAmountGnf($entryRequest, $currency, $exchangeRate);
                $routing      = $this->routePaymentToAccount(
                    $entryRequest, $tenantId, $currency, (float) $entry['amount'], $exchangeRate
                );

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

                if ($routing['target_account_id']) {
                    $account = ClientCurrencyAccount::where('tenant_id', $tenantId)->find($routing['target_account_id']);
                    if ($account) {
                        $account->applyCredit((float) $routing['converted_amount']);
                    }
                }

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
        float $exchangeRate
    ): array {
        // Pas un paiement client (depot, retrait, supplier) -> pas de routage
        if ($request->type !== 'CLIENT' || !$request->client_id) {
            return [
                'target_currency'   => null,
                'target_account_id' => null,
                'converted_amount'  => null,
                'conversion_rate'   => null,
            ];
        }

        $client = Client::where('tenant_id', $tenantId)->find($request->client_id);
        if (!$client) {
            return ['target_currency' => null, 'target_account_id' => null, 'converted_amount' => null, 'conversion_rate' => null];
        }

        // Resolution du compte cible
        $targetAccount = null;
        if ($request->filled('target_account_id')) {
            $targetAccount = ClientCurrencyAccount::where('tenant_id', $tenantId)
                ->where('client_id', $client->id)
                ->find($request->target_account_id);
        }
        if (!$targetAccount) {
            $targetCurrency = strtoupper($request->target_currency ?: $paymentCurrency);
            $targetAccount  = $client->getAccount($targetCurrency);
        }

        $targetCurrency = strtoupper($targetAccount->currency);

        // Calcul du montant converti
        if ($paymentCurrency === $targetCurrency) {
            $convertedAmount = $amount;
            $conversionRate  = 1.0;
        } elseif ($paymentCurrency === 'GNF') {
            // GNF -> devise : on divise par le taux
            $conversionRate  = $exchangeRate > 0 ? (float) $exchangeRate : 1.0;
            $convertedAmount = round($amount / $conversionRate, 2);
        } elseif ($targetCurrency === 'GNF') {
            // Devise -> GNF : on multiplie par le taux
            $conversionRate  = $exchangeRate > 0 ? (float) $exchangeRate : 1.0;
            $convertedAmount = round($amount * $conversionRate, 2);
        } else {
            // Devise A -> Devise B : passage par GNF
            $rateBuy  = $exchangeRate > 0 ? (float) $exchangeRate : 1.0;
            $rateSell = $rateBuy;
            $convertedAmount = round(($amount * $rateBuy) / $rateSell, 2);
            $conversionRate  = $rateBuy / $rateSell;
        }

        return [
            'target_currency'   => $targetCurrency,
            'target_account_id' => $targetAccount->id,
            'converted_amount'  => $convertedAmount,
            'conversion_rate'   => $conversionRate,
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
            'exchange_rate'=> 'nullable|numeric|min:0.0001',
            'amount_gnf'   => 'nullable|numeric|min:0.01',
            'proof'        => 'nullable|string|max:255',
            'reference'    => 'nullable|string|max:255',
            'description'  => 'nullable|string|max:1000',
            'status'       => 'nullable|in:PENDING,COMPLETED,FAILED,CANCELLED',
            'payment_date' => 'sometimes|date',
            'client_id'    => 'nullable|exists:clients,id',
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
            $currency = $request->currency ?? $payment->currency ?? 'GNF';
            $exchangeRate = $this->resolveExchangeRate($request, $payment->tenant_id, $currency, (float) ($payment->exchange_rate ?? 1));
            $amountGnf = $this->resolveAmountGnf(
                $request,
                $currency,
                $exchangeRate,
                (float) ($request->amount ?? $payment->amount)
            );

            $payload = $request->only([
                'type', 'method', 'amount', 'currency', 'proof',
                'reference', 'description', 'status', 'payment_date',
                'client_id', 'invoice_id',
            ]);
            $payload['currency'] = $currency;
            $payload['exchange_rate'] = $exchangeRate;
            $payload['amount_gnf'] = $amountGnf;

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
        $payment->delete();

        if ($invoiceId) {
            Invoice::find($invoiceId)?->recalculatePaidAmount();
        }

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
        $totalPaid      = (float) $linkedPayments->sum(fn ($payment) => $payment->amount_gnf);
        $returnCredits  = ProductReturn::where('client_id', $clientId)
            ->where('tenant_id', $tenantId)
            ->whereNull('invoice_id')
            ->where('status', 'APPROVED')
            ->sum('client_credit_amount');
        $availableCredit = (float) $unappliedPayments->sum(fn ($payment) => $payment->amount_gnf);
        $totalRemaining = max(0, $totalInvoiced - $totalPaid - $availableCredit - (float) $returnCredits);

        $payments = Payment::where('client_id', $clientId)
            ->where('tenant_id', $tenantId)
            ->where('status', 'COMPLETED')
            ->orderBy('payment_date', 'desc')
            ->get();

        return $this->sendResponse([
            'client'          => ['id' => $client->id, 'name' => $client->name, 'phone' => $client->phone1],
            'total_invoiced'  => $totalInvoiced,
            'total_paid'      => $totalPaid,
            'total_remaining' => $totalRemaining,
            'available_credit_gnf' => $availableCredit,
            'total_return_credits' => (float) $returnCredits,
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

        $balances = $invoices->map(function ($clientInvoices) use ($tenantId) {
            $client = $clientInvoices->first()->client;
            $totalInvoiced = $clientInvoices->sum(fn ($invoice) => $this->invoiceTotalGnf($invoice));
            $totalPaid = (float) Payment::when($tenantId, fn ($query) => $query->where('tenant_id', $tenantId))
                ->where('client_id', $client?->id)
                ->where('status', 'COMPLETED')
                ->whereNotNull('invoice_id')
                ->get()
                ->sum(fn ($payment) => $payment->amount_gnf);
            $availableCredit = (float) Payment::when($tenantId, fn ($query) => $query->where('tenant_id', $tenantId))
                ->where('client_id', $client?->id)
                ->where('status', 'COMPLETED')
                ->where('type', 'CLIENT')
                ->whereNull('invoice_id')
                ->get()
                ->sum(fn ($payment) => $payment->amount_gnf);
            $returnCredits = (float) ProductReturn::when($tenantId, fn ($query) => $query->where('tenant_id', $tenantId))
                ->where('client_id', $client?->id)
                ->whereNull('invoice_id')
                ->where('status', 'APPROVED')
                ->sum('client_credit_amount');

            return [
                'client_id'       => $client?->id,
                'client_name'     => $client?->name ?? 'Inconnu',
                'client_phone'    => $client?->phone1,
                'total_invoiced'  => $totalInvoiced,
                'total_paid'      => $totalPaid,
                'available_credit_gnf' => $availableCredit,
                'total_remaining' => max(0, $totalInvoiced - $totalPaid - $availableCredit - $returnCredits),
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
            $outgoingTotal = $supplierOutTotal + $bankWithdrawals + $expenseTotal;

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
                $costGnf = ($inv->currency === 'GNF') ? $cost    : $cost    * $rate;
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
            $containerRows = \DB::table('container_sales')
                ->join('container_arrivals', 'container_sales.container_arrival_id', '=', 'container_arrivals.id')
                ->join('containers', 'container_arrivals.container_id', '=', 'containers.id')
                ->leftJoin('product_categories', 'container_arrivals.product_category_id', '=', 'product_categories.id')
                ->leftJoin('suppliers', 'container_arrivals.supplier_id', '=', 'suppliers.id')
                ->where('container_sales.tenant_id', $tenantId)
                ->when($from, fn ($q) => $q->whereDate('container_sales.sale_date', '>=', $from))
                ->when($to,   fn ($q) => $q->whereDate('container_sales.sale_date', '<=', $to))
                ->groupBy(
                    'container_sales.container_arrival_id',
                    'containers.container_number',
                    'container_arrivals.arrival_date',
                    'container_arrivals.total_quantity',
                    'container_arrivals.purchase_price',
                    'container_arrivals.currency',
                    'container_arrivals.exchange_rate',
                    'product_categories.name',
                    'suppliers.name'
                )
                ->selectRaw('
                    container_sales.container_arrival_id as arrival_id,
                    containers.container_number,
                    container_arrivals.arrival_date,
                    container_arrivals.total_quantity as total_quantity,
                    container_arrivals.purchase_price as arrival_purchase_price,
                    container_arrivals.currency as arrival_currency,
                    container_arrivals.exchange_rate as arrival_rate,
                    product_categories.name as product_category,
                    suppliers.name as supplier_name,
                    COALESCE(SUM(container_sales.quantity_sold), 0) as quantity_sold,
                    COALESCE(SUM(container_sales.sale_price), 0) as revenue_native,
                    COALESCE(SUM(
                        CASE
                            WHEN container_arrivals.total_quantity > 0
                            THEN (container_sales.quantity_sold * container_arrivals.purchase_price) / container_arrivals.total_quantity
                            ELSE 0
                        END
                    ), 0) as cost_native
                ')
                ->get();

            $ctnRevGnf = 0.0; $ctnCostGnf = 0.0;
            $containers = [];
            foreach ($containerRows as $row) {
                $rate = (float) ($row->arrival_rate ?: 1);
                $revenueNative = (float) $row->revenue_native;
                $costNative    = (float) $row->cost_native;
                $revGnf  = ($row->arrival_currency === 'GNF') ? $revenueNative : $revenueNative * $rate;
                $costGnf = ($row->arrival_currency === 'GNF') ? $costNative    : $costNative    * $rate;
                $marginGnf = $revGnf - $costGnf;
                $pct = $revGnf > 0 ? round(($marginGnf / $revGnf) * 100, 2) : null;
                $ctnRevGnf  += $revGnf;
                $ctnCostGnf += $costGnf;
                $containers[] = [
                    'arrival_id'        => (int) $row->arrival_id,
                    'container_number'  => $row->container_number,
                    'arrival_date'      => $row->arrival_date,
                    'product_category'  => $row->product_category,
                    'supplier_name'     => $row->supplier_name,
                    'currency'          => $row->arrival_currency,
                    'quantity_sold'     => (float) $row->quantity_sold,
                    'revenue'           => round($revenueNative, 2),
                    'cost'              => round($costNative, 2),
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

    private function unitCostForItem($item): float
    {
        $p = $item->product;
        if (!$p) return 0.0;
        if ($item->sale_type === 'CARTON' && (float) $p->carton_purchase_price > 0) {
            return (float) $p->carton_purchase_price;
        }
        return (float) ($p->purchase_price ?? 0);
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

            $stats = [
                'total_payments'  => (clone $base)->count(),
                'total_amount'    => (clone $base)->sum('amount_gnf'),
                'average_payment' => (clone $base)->avg('amount_gnf') ?? 0,
                'by_type'         => [
                    'CLIENT'   => (clone $base)->where('type', 'CLIENT')->sum('amount_gnf'),
                    'SUPPLIER' => (clone $base)->where('type', 'SUPPLIER')->sum('amount_gnf'),
                    'DEPOT'    => (clone $base)->where('type', 'DEPOT')->sum('amount_gnf'),
                    'RETRAIT'  => (clone $base)->where('type', 'RETRAIT')->sum('amount_gnf'),
                ],
                'by_method'       => [
                    'ORANGE_MONEY' => (clone $base)->where('method', 'ORANGE_MONEY')->sum('amount_gnf'),
                    'WAVE'         => (clone $base)->where('method', 'WAVE')->sum('amount_gnf'),
                    'MTN_MONEY'    => (clone $base)->where('method', 'MTN_MONEY')->sum('amount_gnf'),
                    'VIREMENT'     => (clone $base)->where('method', 'VIREMENT')->sum('amount_gnf'),
                    'CHEQUE'       => (clone $base)->where('method', 'CHEQUE')->sum('amount_gnf'),
                    'ESPECES'      => (clone $base)->where('method', 'ESPECES')->sum('amount_gnf'),
                ],
                'monthly_trend'   => $this->getMonthlyTrend($tenantId, $request),
                'invoices_summary' => [
                    'total'   => Invoice::where('tenant_id', $tenantId)->count(),
                    'paye'    => Invoice::where('tenant_id', $tenantId)->where('status', 'PAYE')->count(),
                    'partiel' => Invoice::where('tenant_id', $tenantId)->where('status', 'PARTIEL')->count(),
                    'impaye'  => Invoice::where('tenant_id', $tenantId)->where('status', 'IMPAYE')->count(),
                    'total_remaining' => Invoice::where('tenant_id', $tenantId)
                        ->selectRaw('SUM(total_amount - paid_amount) as remaining')
                        ->value('remaining') ?? 0,
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
        $deleted    = $query->delete();

        foreach ($invoiceIds as $invId) {
            Invoice::find($invId)?->recalculatePaidAmount();
        }

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

    private function generateReceiptNumber(int $tenantId): string
    {
        $year  = now()->year;
        $count = Payment::where('tenant_id', $tenantId)
            ->whereYear('created_at', $year)
            ->count() + 1;

        return sprintf('REC-%d-%d-%04d', $tenantId, $year, $count);
    }

    private function resolveExchangeRate(Request $request, ?int $tenantId, string $currency, float $fallback = 1): float
    {
        if ($currency === 'GNF') {
            return 1;
        }

        if ($request->filled('exchange_rate')) {
            return round((float) $request->exchange_rate, 4);
        }

        $currencyModel = Currency::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->where('code', $currency)
            ->first();

        return round((float) ($currencyModel?->exchange_rate ?? $fallback ?: 1), 4);
    }

    private function resolveAmountGnf(Request $request, string $currency, float $exchangeRate, ?float $fallbackAmount = null): float
    {
        $amount = (float) ($request->amount ?? $fallbackAmount ?? 0);

        if ($currency === 'GNF') {
            return round($amount, 2);
        }

        if ($request->filled('amount_gnf')) {
            return round((float) $request->amount_gnf, 2);
        }

        return round($amount * $exchangeRate, 2);
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
