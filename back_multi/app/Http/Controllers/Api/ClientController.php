<?php

namespace App\Http\Controllers\Api;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Models\ContainerSale;
use App\Models\ContainerSalePayment;
use App\Models\ClientAdvance;
use App\Models\ProductReturn;
use App\Models\ClientInterestCharge;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class ClientController extends BaseController
{
    private function tenantId(Request $request): ?int
    {
        $user = Auth::user();

        return $user->hasRole('SUPER_ADMIN') ? $request->get('tenant_id') : $user->tenant_id;
    }

    public function index(Request $request)
    {
        $tenantId = $this->tenantId($request);

        $query = Client::query();

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('email', 'like', "%{$s}%")
                  ->orWhere('phone1', 'like', "%{$s}%");
            });
        }

        if ($request->filled('client_type')) {
            $query->where('client_type', $request->client_type);
        }

        $clients = $query->orderBy('name')->paginate($request->get('per_page', 15));
        return $this->sendResponse($clients, 'Clients retrieved successfully');
    }

    public function store(Request $request)
    {
        $user     = Auth::user();
        $tenantId = $user->hasRole('SUPER_ADMIN')
            ? ($request->get('tenant_id') ?? $user->tenant_id)
            : $user->tenant_id;

        if (!$tenantId) {
            return $this->sendError('Tenant ID requis pour créer un client.', [], 422);
        }

        $validator = Validator::make($request->all(), [
            'name'    => 'required|string|max:150',
            'phone1'  => 'nullable|string|max:50',
            'phone2'  => 'nullable|string|max:50',
            'email'   => 'nullable|email|max:150',
            'address' => 'nullable|string|max:255',
            'notes'   => 'nullable|string|max:1000',
            'client_type' => 'nullable|in:' . implode(',', Client::TYPES),
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        try {
            $client = Client::create([
                'tenant_id' => $tenantId,
                'client_type' => $request->client_type ?? Client::TYPE_GENERAL,
                'name'      => $request->name,
                'phone1'    => $request->phone1,
                'phone2'    => $request->phone2,
                'email'     => $request->email,
                'address'   => $request->address,
                'notes'     => $request->notes,
            ]);

            return $this->sendResponse($client, 'Client created successfully', 201);
        } catch (\Exception $e) {
            return $this->sendError('Erreur lors de la création du client.', [], 500);
        }
    }

    public function show($id)
    {
        $user   = Auth::user();
        $client = Client::find($id);

        if (!$client) {
            return $this->sendError('Client not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $client->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        return $this->sendResponse($client, 'Client retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $user   = Auth::user();
        $client = Client::find($id);

        if (!$client) {
            return $this->sendError('Client not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $client->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $validator = Validator::make($request->all(), [
            'name'    => 'sometimes|string|max:150',
            'phone1'  => 'nullable|string|max:50',
            'phone2'  => 'nullable|string|max:50',
            'email'   => 'nullable|email|max:150',
            'address' => 'nullable|string|max:255',
            'notes'   => 'nullable|string|max:1000',
            'client_type' => 'nullable|in:' . implode(',', Client::TYPES),
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $client->update($request->only(['name', 'phone1', 'phone2', 'email', 'address', 'notes', 'client_type']));

        return $this->sendResponse($client, 'Client updated successfully');
    }

    public function destroy($id)
    {
        $user   = Auth::user();
        $client = Client::find($id);

        if (!$client) {
            return $this->sendError('Client not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $client->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        if ($client->photo) {
            $this->deleteUploadedFile($client->photo);
        }

        $client->delete();
        return $this->sendResponse([], 'Client deleted successfully');
    }

    public function uploadPhoto(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'photo' => 'required|image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $user   = Auth::user();
        $client = Client::find($id);

        if (!$client) {
            return $this->sendError('Client not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $client->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        if ($client->photo) {
            $this->deleteUploadedFile($client->photo);
        }

        $path = $this->storeUploadedFile($request->file('photo'), 'clients');
        $client->update(['photo' => $path]);

        return $this->sendResponse($client, 'Photo uploaded successfully');
    }

    public function deletePhoto($id)
    {
        $user   = Auth::user();
        $client = Client::find($id);

        if (!$client || (!$user->hasRole('SUPER_ADMIN') && $client->tenant_id !== $user->tenant_id)) {
            return $this->sendError('Client not found', [], 404);
        }

        if ($client->photo) {
            $this->deleteUploadedFile($client->photo);
            $client->update(['photo' => null]);
        }

        return $this->sendResponse($client, 'Photo deleted successfully');
    }

    /**
     * Historique complet du client : factures, paiements, ventes conteneurs,
     * versements conteneurs, avances client.
     */
    public function getTransactionHistory(Request $request, $id)
    {
        $user   = Auth::user();
        $client = Client::find($id);

        if (!$client) {
            return $this->sendError('Client not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $client->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $tid = $client->tenant_id;

        // ── 1. Factures (module Finance) ─────────────────────────────────────
        $invoices = Invoice::where('client_id', $id)
            ->where('tenant_id', $tid)
            ->with([
                'payments' => function ($query) {
                    $query->where('status', 'COMPLETED');
                },
                'items.product',
            ])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($inv) {
                $paidGnf = (float) $inv->payments->sum('amount_gnf');
                $totalGnf = (float) ($inv->total_amount_gnf ?? $inv->total_amount);
                $remainingGnf = max(0, $totalGnf - $paidGnf);

                $items = $inv->items->map(function ($item) {
                    $product = $item->product;
                    return [
                        'id'           => $item->id,
                        'product_id'   => $item->product_id,
                        'product_name' => $product->name ?? $item->description ?? 'Produit',
                        'product_sku'  => $product->sku ?? null,
                        'description'  => $item->description,
                        'quantity'     => (float) $item->quantity,
                        'unit_price'   => (float) $item->unit_price,
                        'line_total'   => (float) $item->line_total,
                    ];
                })->values();

                return [
                    'id'                  => $inv->id,
                    'type'                => 'invoice',
                    'module'              => 'finance',
                    'date'                => $inv->created_at->format('Y-m-d'),
                    'label'               => "Facture #{$inv->invoice_number}",
                    'amount'              => $totalGnf,
                    'paid_amount'         => $paidGnf,
                    'remaining_balance'   => $remainingGnf,
                    'payment_count'       => $inv->payments->count(),
                    'settled_by_payments' => $remainingGnf <= 0 && $inv->payments->count() > 0,
                    'status'              => $inv->status,
                    'due_date'            => $inv->due_date?->format('Y-m-d'),
                    'notes'               => $inv->notes,
                    'currency'            => 'GNF',
                    'direction'           => 'debit',
                    'items'               => $items,
                    'items_count'         => $items->count(),
                    'invoice_number'      => $inv->invoice_number,
                ];
            });

        // ── 2. Paiements (module Finance) ────────────────────────────────────
        $payments = Payment::where('client_id', $id)->where('tenant_id', $tid)
            ->where('status', 'COMPLETED')->orderBy('payment_date', 'desc')->get()
            ->map(fn ($p) => [
                'id'        => $p->id,
                'type'      => 'payment',
                'module'    => 'finance',
                'date'      => $p->payment_date->format('Y-m-d'),
                'label'     => $p->invoice_id ? "Paiement #{$p->receipt_number}" : "Versement au compte client #{$p->receipt_number}",
                'amount'    => (float) ($p->amount_gnf ?? $p->amount),
                'method'    => $p->method,
                'reference' => $p->reference,
                'notes'     => $p->description,
                'currency'  => 'GNF',
                'direction' => 'credit',
            ]);

        // ── 3. Ventes conteneurs ─────────────────────────────────────────────
        $containerSales = ContainerSale::where('client_id', $id)->where('tenant_id', $tid)
            ->with('containerArrival:id,product_type,description')
            ->orderBy('sale_date', 'desc')->get()
            ->map(function ($s) {
                $statusLabels = [
                    'IMPAYE'      => 'Impayé',
                    'PARTIEL'     => 'Partiel',
                    'PAYE_TOTAL'  => 'Payé',
                    'ANNULE'      => 'Annulé',
                ];
                $saleTypeLabels = [
                    'DETAIL'  => 'Détail',
                    'GROS'    => 'Gros',
                    'PARTIEL' => 'Partiel',
                ];
                $arrival = $s->containerArrival;
                $arrivalName = $arrival
                    ? ($arrival->product_type ?? $arrival->description ?? "Arrivage #{$s->container_arrival_id}")
                    : "Arrivage #{$s->container_arrival_id}";
                return [
                    'id'               => $s->id,
                    'type'             => 'container_sale',
                    'module'           => 'containers',
                    'date'             => $s->sale_date,
                    'label'            => "Vente conteneur — {$arrivalName}",
                    'amount'           => (float) ($s->quantity_sold * $s->sale_price),
                    'paid_amount'      => (float) $s->amount_paid,
                    'remaining_balance'=> (float) $s->remaining_amount,
                    'quantity'         => $s->quantity_sold,
                    'unit_price'       => (float) $s->sale_price,
                    'sale_type'        => $saleTypeLabels[$s->sale_type] ?? $s->sale_type,
                    'status'           => $s->status,
                    'status_label'     => $statusLabels[$s->status] ?? $s->status,
                    'due_date'         => $s->due_date,
                    'notes'            => $s->notes,
                    'currency'         => $s->currency ?? 'GNF',
                    'direction'        => 'debit',
                    'is_installment'   => (bool) $s->is_installment,
                ];
            });

        // ── 4. Versements sur ventes conteneurs ──────────────────────────────
        $containerPayments = ContainerSalePayment::where('client_id', $id)->where('tenant_id', $tid)
            ->orderBy('payment_date', 'desc')->get()
            ->map(fn ($p) => [
                'id'             => $p->id,
                'type'           => 'container_payment',
                'module'         => 'containers',
                'date'           => $p->payment_date,
                'label'          => "Versement conteneur",
                'amount'         => (float) $p->amount,
                'method'         => $p->payment_method,
                'reference'      => $p->reference,
                'notes'          => $p->notes,
                'currency'       => $p->currency ?? 'GNF',
                'direction'      => 'credit',
                'container_sale_id' => $p->container_sale_id,
            ]);

        // ── 5. Avances client ────────────────────────────────────────────────
        $advances = ClientAdvance::where('client_id', $id)->where('tenant_id', $tid)
            ->orderBy('payment_date', 'desc')->get()
            ->map(fn ($a) => [
                'id'               => $a->id,
                'type'             => 'advance',
                'module'           => 'containers',
                'date'             => $a->payment_date,
                'label'            => "Avance client",
                'amount'           => (float) $a->amount,
                'used_amount'      => (float) $a->used_amount,
                'remaining_amount' => (float) $a->remaining_amount,
                'method'           => $a->payment_method,
                'reference'        => $a->reference,
                'notes'            => $a->description,
                'currency'         => $a->currency ?? 'GNF',
                'direction'        => 'credit',
                'status'           => $a->status,
            ]);

        // ── Fusion & tri ──────────────────────────────────────────────────────
        $history = $invoices
            ->concat($payments)
            ->concat($containerSales)
            ->concat($containerPayments)
            ->concat($advances)
            ->sortByDesc('date')
            ->values();

        $accountCreditsQuery = Payment::where('client_id', $id)
            ->where('tenant_id', $tid)
            ->where('status', 'COMPLETED')
            ->where('type', 'CLIENT')
            ->whereNull('invoice_id');
        $accountCredits = (float) ($this->sumPaymentAmountGnf($accountCreditsQuery));

        $returnCredits = (float) $client->productReturns()
            ->whereNull('invoice_id')
            ->where('status', 'APPROVED')
            ->sum('client_credit_amount');

        // ── Résumé global ─────────────────────────────────────────────────────
        $totalCharged  = $invoices->sum('amount')
                       + $containerSales->sum('amount');
        $totalPaid     = $payments->sum('amount')
                       + $containerPayments->sum('amount')
                       + $advances->sum('amount');
        $invoiceDebt = (float) $invoices->sum('remaining_balance');
        $containerDebt = (float) $containerSales->sum('remaining_balance');
        $grossDebt = $invoiceDebt + $containerDebt;
        $availableCredit = $accountCredits + $returnCredits;
        $totalRemaining = max(0, $grossDebt - $availableCredit);
        $creditAfterOffset = max(0, $availableCredit - $grossDebt);

        $productConsumption = $invoices
            ->flatMap(fn ($invoice) => collect($invoice['items'] ?? []))
            ->groupBy('product_id')
            ->map(function ($items, $productId) {
                $first = $items->first();
                return [
                    'product_id'   => $first['product_id'] ?? $productId,
                    'product_name' => $first['product_name'] ?? 'Produit',
                    'product_sku'  => $first['product_sku'] ?? null,
                    'quantity'     => (float) $items->sum('quantity'),
                    'value_gnf'    => (float) $items->sum('line_total'),
                ];
            })
            ->sortByDesc('value_gnf')
            ->values();

        $summary = [
            'total_charged'          => $totalCharged,
            'total_paid'             => $totalPaid,
            'total_remaining'        => $totalRemaining,
            'gross_debt_gnf'         => $grossDebt,
            // par module
            'finance_invoiced'       => $invoices->sum('amount'),
            'finance_paid'           => $payments->sum('amount'),
            'invoice_debt_gnf'       => $invoiceDebt,
            'containers_charged'     => $containerSales->sum('amount'),
            'containers_paid'        => $containerPayments->sum('amount'),
            'container_debt_gnf'     => $containerDebt,
            'advances_total'         => $advances->sum('amount'),
            'advances_remaining'     => $advances->sum('remaining_amount'),
            'account_credit_gnf'     => $accountCredits,
            'return_credit_gnf'      => $returnCredits,
            'available_credit_gnf'   => $availableCredit,
            'credit_after_offset_gnf' => $creditAfterOffset,
            // compteurs
            'invoice_count'          => $invoices->count(),
            'invoice_settled_count'  => $invoices->where('remaining_balance', '<=', 0)->count(),
            'payment_count'          => $payments->count(),
            'container_sale_count'   => $containerSales->count(),
            'container_payment_count'=> $containerPayments->count(),
            'advance_count'          => $advances->count(),
            'product_consumption'    => $productConsumption,
        ];

        return $this->sendResponse([
            'client'  => [
                'id'        => $client->id,
                'name'      => $client->name,
                'email'     => $client->email,
                'phone1'    => $client->phone1,
                'address'   => $client->address,
                'photo_url' => $client->photo_url,
            ],
            'summary' => $summary,
            'history' => $history,
        ], 'Client history retrieved successfully');
    }

    private function sumPaymentAmountGnf($query): float
    {
        if (Schema::hasColumn('payments', 'amount_gnf')) {
            return (float) $query->sum('amount_gnf');
        }

        return (float) $query->sum('amount');
    }

    /**
     * Grand livre client style "feuille Excel T.B.SALL" — vue chronologique
     * ASC avec solde courant ligne par ligne, en GNF (USD reconverti via taux).
     *
     * Fusionne : Factures, Paiements (finance), Ventes conteneurs, Versements
     * conteneurs, Avances, Retours produits.
     *
     * Query params :
     *   - from=YYYY-MM-DD     date min
     *   - to=YYYY-MM-DD       date max
     *   - type=invoice|payment|return|advance   filtre
     */
    public function getLedger(Request $request, $id)
    {
        $user   = Auth::user();
        $client = Client::find($id);

        if (!$client) {
            return $this->sendError('Client not found', [], 404);
        }
        if (!$user->hasRole('SUPER_ADMIN') && $client->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $tid  = $client->tenant_id;
        $from = $request->get('from');
        $to   = $request->get('to');
        $typeFilter = $request->get('type');

        $applyDateRange = function ($query, string $column) use ($from, $to) {
            if ($from) $query->whereDate($column, '>=', $from);
            if ($to)   $query->whereDate($column, '<=', $to);
            return $query;
        };

        // ── 1. Factures (DEBIT) ─────────────────────────────────────────────
        $invoices = collect();
        if (!$typeFilter || $typeFilter === 'invoice') {
            $invoiceQuery = Invoice::where('client_id', $id)
                ->where('tenant_id', $tid)
                ->with(['items.product', 'items.supplier:id,name']);
            $applyDateRange($invoiceQuery, 'created_at');

            $invoices = $invoiceQuery->get()->map(function ($inv) {
                $designation = "Facture #{$inv->invoice_number}";
                $items = $inv->items;
                if ($items->count() === 1) {
                    $it = $items->first();
                    $productName = $it->product->name ?? $it->description ?? 'Article';
                    $supplierName = $it->supplier->name ?? null;
                    $suffix = $supplierName ? " {$supplierName}" : '';
                    $sampleTag = $it->is_sample ? ' [échantillon]' : '';
                    $designation = "{$productName}{$suffix}{$sampleTag} (fact. #{$inv->invoice_number})";
                } elseif ($items->count() > 1) {
                    $sampleCount = $items->where('is_sample', true)->count();
                    $sampleSuffix = $sampleCount > 0 ? ", dont {$sampleCount} échantillon(s)" : '';
                    $designation = "Facture #{$inv->invoice_number} ({$items->count()} articles{$sampleSuffix})";
                }
                $currency = strtoupper($inv->currency ?? 'GNF');
                // Montant dans la devise native de la facture (USD ou GNF)
                $nativeAmount = $currency === 'USD'
                    ? (float) $inv->total_amount
                    : (float) ($inv->total_amount_gnf ?? $inv->total_amount);
                $qty = (float) $items->sum('quantity');

                return [
                    'date'        => $inv->created_at->format('Y-m-d'),
                    'sort_key'    => $inv->created_at->format('Y-m-d H:i:s') . '_a_' . $inv->id,
                    'type'        => 'invoice',
                    'type_label'  => 'Vente',
                    'designation' => $designation,
                    'quantity'    => $qty > 0 ? $qty : null,
                    'currency'    => $currency,
                    'debit'       => $nativeAmount,
                    'credit'      => 0.0,
                    'reference'   => $inv->invoice_number,
                    'meta_id'     => $inv->id,
                ];
            });
        }

        // ── 2. Paiements finance (CREDIT) ───────────────────────────────────
        $payments = collect();
        if (!$typeFilter || $typeFilter === 'payment') {
            $paymentQuery = Payment::where('client_id', $id)->where('tenant_id', $tid)
                ->where('status', 'COMPLETED')
                ->with('paidByClient:id,name');
            $applyDateRange($paymentQuery, 'payment_date');

            $payments = $paymentQuery->get()->map(function ($p) {
                $baseLabel = $p->description ?: ($p->invoice_id
                    ? "Paiement facture (rec. #{$p->receipt_number})"
                    : "Versement compte (rec. #{$p->receipt_number})");
                $thirdParty = $p->paidByClient->name ?? null;
                $designation = $thirdParty
                    ? "{$baseLabel} — par {$thirdParty}"
                    : $baseLabel;
                $cur = strtoupper($p->currency ?? 'GNF');
                $nativeAmount = $cur === 'USD' ? (float) $p->amount : (float) ($p->amount_gnf ?? $p->amount);
                return [
                    'date'        => $p->payment_date->format('Y-m-d'),
                    'sort_key'    => $p->payment_date->format('Y-m-d') . ' 23:59:59_p_' . $p->id,
                    'type'        => 'payment',
                    'type_label'  => $thirdParty ? 'Paiement (tiers)' : 'Paiement',
                    'designation' => $designation,
                    'quantity'    => null,
                    'currency'    => $cur,
                    'debit'       => 0.0,
                    'credit'      => $nativeAmount,
                    'reference'   => $p->receipt_number ?? $p->reference,
                    'meta_id'     => $p->id,
                ];
            });
        }

        // ── 3. Ventes conteneurs (DEBIT) ────────────────────────────────────
        $containerSales = collect();
        if (!$typeFilter || $typeFilter === 'invoice') {
            $containerSaleQuery = ContainerSale::where('client_id', $id)->where('tenant_id', $tid)
                ->with('containerArrival:id,product_type,description');
            $applyDateRange($containerSaleQuery, 'sale_date');

            $containerSales = $containerSaleQuery->get()->map(function ($s) {
                $arr = $s->containerArrival;
                $label = $arr ? ($arr->product_type ?? $arr->description ?? "Arrivage #{$s->container_arrival_id}") : "Arrivage #{$s->container_arrival_id}";
                return [
                    'date'        => $s->sale_date,
                    'sort_key'    => $s->sale_date . '_b_' . $s->id,
                    'type'        => 'container_sale',
                    'type_label'  => 'Vente conteneur',
                    'designation' => $label,
                    'quantity'    => (float) $s->quantity_sold,
                    'currency'    => $s->currency ?? 'GNF',
                    'debit'       => (float) ($s->quantity_sold * $s->sale_price),
                    'credit'      => 0.0,
                    'reference'   => null,
                    'meta_id'     => $s->id,
                ];
            });
        }

        // ── 4. Versements conteneurs (CREDIT) ───────────────────────────────
        $containerPayments = collect();
        if (!$typeFilter || $typeFilter === 'payment') {
            $cspQuery = ContainerSalePayment::where('client_id', $id)->where('tenant_id', $tid);
            $applyDateRange($cspQuery, 'payment_date');

            $containerPayments = $cspQuery->get()->map(fn ($p) => [
                'date'        => $p->payment_date,
                'sort_key'    => $p->payment_date . ' 23:59:58_p_' . $p->id,
                'type'        => 'container_payment',
                'type_label'  => 'Versement conteneur',
                'designation' => $p->notes ?: 'Versement conteneur',
                'quantity'    => null,
                'currency'    => $p->currency ?? 'GNF',
                'debit'       => 0.0,
                'credit'      => (float) $p->amount,
                'reference'   => $p->reference,
                'meta_id'     => $p->id,
            ]);
        }

        // ── 5. Avances (CREDIT — réduit la dette ou crée un crédit) ─────────
        $advances = collect();
        if (!$typeFilter || $typeFilter === 'advance') {
            $advQuery = ClientAdvance::where('client_id', $id)->where('tenant_id', $tid);
            $applyDateRange($advQuery, 'payment_date');

            $advances = $advQuery->get()->map(fn ($a) => [
                'date'        => $a->payment_date,
                'sort_key'    => $a->payment_date . ' 23:59:57_p_' . $a->id,
                'type'        => 'advance',
                'type_label'  => 'Avance',
                'designation' => $a->description ?: 'Avance client',
                'quantity'    => null,
                'currency'    => $a->currency ?? 'GNF',
                'debit'       => 0.0,
                'credit'      => (float) $a->amount,
                'reference'   => $a->reference,
                'meta_id'     => $a->id,
            ]);
        }

        // ── 6bis. Frais d'intérêts (DEBIT — compte SALL) ────────────────────
        $interestCharges = collect();
        if (!$typeFilter || $typeFilter === 'interest') {
            $intQuery = ClientInterestCharge::where('client_id', $id)->where('tenant_id', $tid)
                ->whereIn('status', ['PENDING', 'PARTIAL', 'PAID']);
            $applyDateRange($intQuery, 'charge_date');

            $interestCharges = $intQuery->get()->map(function ($c) {
                $rateLabel = $c->interest_rate > 0 ? " ({$c->interest_rate}%)" : '';
                $designation = ($c->notes ?: 'Intérêts SALL') . $rateLabel;
                return [
                    'date'        => $c->charge_date->format('Y-m-d'),
                    'sort_key'    => $c->charge_date->format('Y-m-d') . ' 12:00:00_i_' . $c->id,
                    'type'        => 'interest',
                    'type_label'  => 'Intérêts',
                    'designation' => $designation,
                    'quantity'    => null,
                    'currency'    => $c->currency ?? 'GNF',
                    'debit'       => (float) $c->amount,
                    'credit'      => (float) ($c->paid_amount ?? 0),
                    'reference'   => $c->reference,
                    'meta_id'     => $c->id,
                ];
            });
        }

        // ── 6. Retours produits (CREDIT) ────────────────────────────────────
        $returns = collect();
        if (!$typeFilter || $typeFilter === 'return') {
            $retQuery = ProductReturn::where('client_id', $id)->where('tenant_id', $tid)
                ->where('status', 'APPROVED')
                ->with('product:id,name');
            $applyDateRange($retQuery, 'return_date');

            $returns = $retQuery->get()->map(fn ($r) => [
                'date'        => $r->return_date->format('Y-m-d'),
                'sort_key'    => $r->return_date->format('Y-m-d') . ' 23:59:56_r_' . $r->id,
                'type'        => 'return',
                'type_label'  => 'Retour',
                'designation' => 'Retour : ' . ($r->product->name ?? "Produit #{$r->product_id}"),
                'quantity'    => (float) $r->quantity,
                'currency'    => 'GNF',
                'debit'       => 0.0,
                'credit'      => (float) $r->total_amount,
                'reference'   => null,
                'meta_id'     => $r->id,
            ]);
        }

        // ── Fusion ASC + calcul de DEUX soldes courants parallèles (GNF + USD) ──
        // Chaque ligne contribue uniquement au solde de SA devise (fidèle au style
        // T.B.SALL où les colonnes GNF et USD sont indépendantes).
        $rows = $invoices
            ->concat($payments)
            ->concat($containerSales)
            ->concat($containerPayments)
            ->concat($advances)
            ->concat($returns)
            ->concat($interestCharges)
            ->sortBy('sort_key')
            ->values();

        $runningGnf = 0.0;
        $runningUsd = 0.0;
        $rows = $rows->map(function ($row) use (&$runningGnf, &$runningUsd) {
            $cur    = strtoupper($row['currency'] ?? 'GNF');
            $debit  = (float) $row['debit'];
            $credit = (float) $row['credit'];

            if ($cur === 'USD') {
                $runningUsd += $debit - $credit;
                $row['debit_gnf']  = 0.0;
                $row['credit_gnf'] = 0.0;
                $row['debit_usd']  = $debit;
                $row['credit_usd'] = $credit;
            } else {
                $runningGnf += $debit - $credit;
                $row['debit_gnf']  = $debit;
                $row['credit_gnf'] = $credit;
                $row['debit_usd']  = 0.0;
                $row['credit_usd'] = 0.0;
            }

            $row['balance_gnf'] = round($runningGnf, 2);
            $row['balance_usd'] = round($runningUsd, 2);
            // Solde dans la devise propre à la ligne (compat avec affichage existant)
            $row['balance'] = $cur === 'USD' ? round($runningUsd, 2) : round($runningGnf, 2);
            return $row;
        });

        // ── Totaux par devise ───────────────────────────────────────────────
        $totalDebitGnf  = (float) $rows->sum('debit_gnf');
        $totalCreditGnf = (float) $rows->sum('credit_gnf');
        $totalDebitUsd  = (float) $rows->sum('debit_usd');
        $totalCreditUsd = (float) $rows->sum('credit_usd');
        $hasUsd = $rows->contains(fn ($r) => $r['debit_usd'] > 0 || $r['credit_usd'] > 0);

        return $this->sendResponse([
            'client' => [
                'id'          => $client->id,
                'name'        => $client->name,
                'client_type' => $client->client_type,
                'phone1'      => $client->phone1,
                'phone2'      => $client->phone2,
                'email'       => $client->email,
                'address'     => $client->address,
                'photo_url'   => $client->photo_url,
            ],
            'summary' => [
                // Compat ancien format (GNF par défaut)
                'total_debit'        => round($totalDebitGnf, 2),
                'total_credit'       => round($totalCreditGnf, 2),
                'final_balance'      => round($totalDebitGnf - $totalCreditGnf, 2),
                // Nouveau : split par devise
                'total_debit_gnf'    => round($totalDebitGnf, 2),
                'total_credit_gnf'   => round($totalCreditGnf, 2),
                'final_balance_gnf'  => round($totalDebitGnf - $totalCreditGnf, 2),
                'total_debit_usd'    => round($totalDebitUsd, 2),
                'total_credit_usd'   => round($totalCreditUsd, 2),
                'final_balance_usd'  => round($totalDebitUsd - $totalCreditUsd, 2),
                'has_usd'            => $hasUsd,
                'rows_count'         => $rows->count(),
            ],
            'rows'   => $rows->values(),
            'period' => ['from' => $from, 'to' => $to],
        ], 'Ledger retrieved successfully');
    }

    public function getStatistics(Request $request)
    {
        $tenantId = $this->tenantId($request);

        $query = Client::where('tenant_id', $tenantId);

        $stats = [
            'total_clients'          => (clone $query)->count(),
            'new_clients_this_month' => (clone $query)->where('created_at', '>=', now()->startOfMonth())->count(),
            'new_clients_this_year'  => (clone $query)->where('created_at', '>=', now()->startOfYear())->count(),
            'clients_with_debt'      => (clone $query)->whereHas('invoices', fn ($q) =>
                $q->whereIn('status', ['IMPAYE', 'PARTIEL'])
            )->count(),
        ];

        return $this->sendResponse($stats, 'Client statistics retrieved successfully');
    }

    public function getFinancialOverview(Request $request)
    {
        $tenantId = $this->tenantId($request);

        $clientsQuery = Client::query()->where('tenant_id', $tenantId);

        if ($request->filled('search')) {
            $search = $request->search;
            $clientsQuery->where(function ($query) use ($search) {
                $query->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone1', 'like', "%{$search}%");
            });
        }

        if ($request->filled('client_type')) {
            $clientsQuery->where('client_type', $request->client_type);
        }

        $clients = $clientsQuery
            ->orderBy('name')
            ->get(['id', 'tenant_id', 'name', 'email', 'phone1', 'phone2', 'client_type', 'photo']);

        $invoiceAmountColumn = Schema::hasColumn('invoices', 'total_amount_gnf') ? 'total_amount_gnf' : 'total_amount';
        $paymentAmountColumn = Schema::hasColumn('payments', 'amount_gnf') ? 'amount_gnf' : 'amount';
        $containerSaleAmountColumn = Schema::hasColumn('container_sales', 'sale_price_gnf') ? 'sale_price_gnf' : 'sale_price';
        $containerRemainingColumn = Schema::hasColumn('container_sales', 'remaining_amount_gnf') ? 'remaining_amount_gnf' : 'remaining_amount';
        $containerPaymentAmountColumn = Schema::hasColumn('container_sale_payments', 'amount_gnf') ? 'amount_gnf' : 'amount';

        $invoiceTotals = Invoice::query()
            ->where('tenant_id', $tenantId)
            ->select('client_id', DB::raw("COALESCE(SUM({$invoiceAmountColumn}), 0) as total"))
            ->groupBy('client_id')
            ->pluck('total', 'client_id');

        $invoicePayments = Payment::query()
            ->where('tenant_id', $tenantId)
            ->where('status', 'COMPLETED')
            ->select('client_id', DB::raw("COALESCE(SUM({$paymentAmountColumn}), 0) as total"))
            ->groupBy('client_id')
            ->pluck('total', 'client_id');

        $containerSales = ContainerSale::query()
            ->where('tenant_id', $tenantId)
            ->select(
                'client_id',
                DB::raw("COALESCE(SUM({$containerSaleAmountColumn}), 0) as total_sales"),
                DB::raw("COALESCE(SUM({$containerRemainingColumn}), 0) as total_remaining"),
                DB::raw('COUNT(*) as sale_count')
            )
            ->groupBy('client_id')
            ->get()
            ->keyBy('client_id');

        $containerPayments = ContainerSalePayment::query()
            ->where('tenant_id', $tenantId)
            ->select('client_id', DB::raw("COALESCE(SUM({$containerPaymentAmountColumn}), 0) as total"))
            ->groupBy('client_id')
            ->pluck('total', 'client_id');

        $advances = ClientAdvance::query()
            ->where('tenant_id', $tenantId)
            ->select(
                'client_id',
                DB::raw('COALESCE(SUM(amount), 0) as total_advances'),
                DB::raw('COALESCE(SUM(remaining_amount), 0) as remaining_advances')
            )
            ->groupBy('client_id')
            ->get()
            ->keyBy('client_id');

        // Frais d'intérêts (compte SALL) — débit additionnel
        $interestData = ClientInterestCharge::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('status', ['PENDING', 'PARTIAL', 'PAID'])
            ->select(
                'client_id',
                DB::raw('COALESCE(SUM(amount), 0) as total_interest'),
                DB::raw('COALESCE(SUM(paid_amount), 0) as paid_interest')
            )
            ->groupBy('client_id')
            ->get()
            ->keyBy('client_id');

        // Retours produits — crédit additionnel
        $returnCredits = ProductReturn::query()
            ->where('tenant_id', $tenantId)
            ->where('status', 'APPROVED')
            ->whereNull('invoice_id')
            ->select('client_id', DB::raw('COALESCE(SUM(client_credit_amount), 0) as total'))
            ->groupBy('client_id')
            ->pluck('total', 'client_id');

        $rows = $clients->map(function (Client $client) use (
            $invoiceTotals,
            $invoicePayments,
            $containerSales,
            $containerPayments,
            $advances,
            $interestData,
            $returnCredits
        ) {
            $invoiceInvoiced = (float) ($invoiceTotals[$client->id] ?? 0);
            $invoicePaid = (float) ($invoicePayments[$client->id] ?? 0);
            $invoiceRemaining = max(0, $invoiceInvoiced - $invoicePaid);

            $containerData = $containerSales->get($client->id);
            $containerCharged = (float) ($containerData?->total_sales ?? 0);
            $containerRemaining = (float) ($containerData?->total_remaining ?? 0);
            $containerPaid = (float) ($containerPayments[$client->id] ?? 0);
            $saleCount = (int) ($containerData?->sale_count ?? 0);

            $advanceData = $advances->get($client->id);
            $advanceTotal = (float) ($advanceData?->total_advances ?? 0);
            $advanceRemaining = (float) ($advanceData?->remaining_advances ?? 0);

            // Intérêts (compte SALL)
            $interestRow = $interestData->get($client->id);
            $interestCharged  = (float) ($interestRow?->total_interest ?? 0);
            $interestPaid     = (float) ($interestRow?->paid_interest ?? 0);
            $interestRemaining = max(0, $interestCharged - $interestPaid);

            // Crédits issus des retours non rattachés à une facture
            $returnCreditAmount = (float) ($returnCredits[$client->id] ?? 0);

            $grossDebt    = $invoiceRemaining + $containerRemaining + $interestRemaining;
            $totalCredits = $advanceRemaining + $returnCreditAmount;
            $restToPay    = max(0, $grossDebt - $totalCredits);
            $creditBalance = max(0, $totalCredits - $grossDebt);
            $status = $restToPay > 0.009 ? 'DEBITEUR' : ($creditBalance > 0.009 ? 'AVANCE' : 'SOLDE');

            return [
                'id' => $client->id,
                'name' => $client->name,
                'email' => $client->email,
                'phone1' => $client->phone1,
                'phone2' => $client->phone2,
                'client_type' => $client->client_type,
                'photo_url' => $client->photo_url,
                'sale_count' => $saleCount,
                'invoice_invoiced' => round($invoiceInvoiced, 2),
                'invoice_paid' => round($invoicePaid, 2),
                'invoice_remaining' => round($invoiceRemaining, 2),
                'container_charged' => round($containerCharged, 2),
                'container_paid' => round($containerPaid, 2),
                'container_remaining' => round($containerRemaining, 2),
                'total_charged' => round($invoiceInvoiced + $containerCharged, 2),
                'total_paid' => round($invoicePaid + $containerPaid, 2),
                'advances_total' => round($advanceTotal, 2),
                'advances_remaining' => round($advanceRemaining, 2),
                'interest_charged'  => round($interestCharged, 2),
                'interest_paid'     => round($interestPaid, 2),
                'interest_remaining'=> round($interestRemaining, 2),
                'return_credit_gnf' => round($returnCreditAmount, 2),
                'gross_debt_gnf' => round($grossDebt, 2),
                'rest_to_pay_gnf' => round($restToPay, 2),
                'credit_balance_gnf' => round($creditBalance, 2),
                'status' => $status,
                'status_label' => match ($status) {
                    'DEBITEUR' => 'Débiteur',
                    'AVANCE' => 'Avance',
                    default => 'Soldé',
                },
            ];
        })->values();

        $summary = [
            'total_clients' => $rows->count(),
            'debtor_clients' => $rows->where('status', 'DEBITEUR')->count(),
            'settled_clients' => $rows->where('status', 'SOLDE')->count(),
            'credit_clients' => $rows->where('status', 'AVANCE')->count(),
            'total_charged' => round((float) $rows->sum('total_charged'), 2),
            'total_paid' => round((float) $rows->sum('total_paid'), 2),
            'total_advances' => round((float) $rows->sum('advances_total'), 2),
            'total_advances_remaining' => round((float) $rows->sum('advances_remaining'), 2),
            'total_interest_charged'   => round((float) $rows->sum('interest_charged'), 2),
            'total_interest_remaining' => round((float) $rows->sum('interest_remaining'), 2),
            'total_debt' => round((float) $rows->sum('gross_debt_gnf'), 2),
            'total_rest_to_pay' => round((float) $rows->sum('rest_to_pay_gnf'), 2),
            'total_credit_balance' => round((float) $rows->sum('credit_balance_gnf'), 2),
        ];

        return $this->sendResponse([
            'summary' => $summary,
            'clients' => $rows,
        ], 'Client financial overview retrieved successfully');
    }
}
