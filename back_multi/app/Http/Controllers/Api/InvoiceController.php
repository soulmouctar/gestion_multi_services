<?php

namespace App\Http\Controllers\Api;

use App\Models\Client;
use App\Models\Currency;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\Payment;
use App\Models\ProductReturn;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class InvoiceController extends BaseController
{
    public function index(Request $request)
    {
        $user     = Auth::user();
        $tenantId = $user->hasRole('SUPER_ADMIN')
            ? $request->get('tenant_id')
            : $user->tenant_id;

        $query = Invoice::with(['client:id,name,phone1', 'items']);

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('currency')) {
            $query->where('currency', $request->currency);
        }
        if ($request->filled('client_id')) {
            $query->where('client_id', $request->client_id);
        }
        if ($request->filled('search')) {
            $query->where('invoice_number', 'like', '%' . $request->search . '%');
        }

        $invoices = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 15));

        return $this->sendResponse($invoices, 'Invoices retrieved successfully');
    }

    public function store(Request $request)
    {
        $user     = Auth::user();
        $tenantId = $user->hasRole('SUPER_ADMIN')
            ? ($request->get('tenant_id') ?? null)
            : $user->tenant_id;

        // Pour le SUPER_ADMIN sans tenant_id explicite, on le déduit du client sélectionné
        if (!$tenantId && $request->filled('client_id')) {
            $tenantId = \App\Models\Client::find($request->client_id)?->tenant_id;
        }

        if (!$tenantId) {
            return $this->sendError('Tenant ID introuvable. Veuillez sélectionner un client valide.', [], 400);
        }

        $validator = $this->validator($request, null);
        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        DB::beginTransaction();

        try {
            $payload = $this->buildInvoicePayload($request, $tenantId);

            $invoice = Invoice::create([
                'tenant_id'                => $tenantId,
                'client_id'                => $request->client_id,
                'invoice_number'           => $payload['invoice_number'],
                'total_amount'             => $payload['total_amount'],
                'paid_amount'              => 0,
                'items_subtotal_amount'    => $payload['items_subtotal_amount'],
                'previous_balance_amount'  => $payload['previous_balance_amount'],
                'status'                   => $request->status ?? 'IMPAYE',
                'due_date'                 => $request->due_date ?: null,
                'notes'                    => $request->notes,
                'currency'                 => $payload['currency'],
                'exchange_rate'            => $payload['exchange_rate'],
                'total_amount_gnf'         => $payload['total_amount_gnf'],
            ]);

            $this->syncItems($invoice, $payload['line_items']);

            DB::commit();

            return $this->sendResponse(
                $invoice->load(['client:id,name,phone1', 'items.product:id,name', 'items.supplier:id,name']),
                'Invoice created successfully',
                201
            );
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('InvoiceController@store: ' . $e->getMessage());
            return $this->sendError('Error creating invoice', ['error' => $e->getMessage()], 500);
        }
    }

    public function show($id)
    {
        $user    = Auth::user();
        $invoice = Invoice::with(['client:id,name,phone1', 'items.product:id,name,sku', 'items.supplier:id,name'])->find($id);

        if (!$invoice) {
            return $this->sendError('Invoice not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $invoice->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        return $this->sendResponse($invoice, 'Invoice retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $user    = Auth::user();
        $invoice = Invoice::with('items')->find($id);

        if (!$invoice) {
            return $this->sendError('Invoice not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $invoice->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $validator = $this->validator($request, $id);
        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        DB::beginTransaction();

        try {
            $payload = $this->buildInvoicePayload($request, $invoice->tenant_id, $invoice->id);

            $invoice->update([
                'client_id'                => $request->client_id,
                'invoice_number'           => $payload['invoice_number'],
                'total_amount'             => $payload['total_amount'],
                'items_subtotal_amount'    => $payload['items_subtotal_amount'],
                'previous_balance_amount'  => $payload['previous_balance_amount'],
                'status'                   => $request->status ?? $invoice->status,
                'due_date'                 => $request->due_date ?: null,
                'notes'                    => $request->notes,
                'currency'                 => $payload['currency'],
                'exchange_rate'            => $payload['exchange_rate'],
                'total_amount_gnf'         => $payload['total_amount_gnf'],
            ]);

            $this->syncItems($invoice, $payload['line_items']);
            $invoice->recalculatePaidAmount();

            DB::commit();

            return $this->sendResponse(
                $invoice->fresh()->load(['client:id,name,phone1', 'items.product:id,name', 'items.supplier:id,name']),
                'Invoice updated successfully'
            );
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('InvoiceController@update: ' . $e->getMessage());
            return $this->sendError('Error updating invoice', ['error' => $e->getMessage()], 500);
        }
    }

    public function destroy($id)
    {
        $user    = Auth::user();
        $invoice = Invoice::with('items')->find($id);

        if (!$invoice) {
            return $this->sendError('Invoice not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $invoice->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        DB::beginTransaction();
        try {
            $this->restoreInvoiceStock($invoice);
            $invoice->delete();
            DB::commit();

            return $this->sendResponse([], 'Invoice deleted successfully');
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('InvoiceController@destroy: ' . $e->getMessage());
            return $this->sendError('Error deleting invoice', ['error' => $e->getMessage()], 500);
        }

    }

    /**
     * Retourne le solde arriéré actuel d'un client (montant impayé global), optionnellement
     * en excluant une facture donnée (utile pour le PDF d'une facture précise).
     *
     * Query params : exclude_invoice_id (optionnel)
     */
    public function clientOutstandingBalance(Request $request, $clientId)
    {
        $user   = Auth::user();
        $client = Client::find($clientId);

        if (!$client) {
            return $this->sendError('Client not found', [], 404);
        }
        if (!$user->hasRole('SUPER_ADMIN') && $client->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $excludeId = $request->get('exclude_invoice_id') ? (int) $request->get('exclude_invoice_id') : null;
        $balance   = $this->getOutstandingClientBalance($client->id, $client->tenant_id, $excludeId);

        return $this->sendResponse([
            'client_id' => $client->id,
            'balance'   => round($balance, 2),
            'currency'  => 'GNF',
            'as_of'     => now()->format('Y-m-d H:i:s'),
        ], 'Outstanding balance computed');
    }

    /**
     * Synthèse des ventes avec calcul des marges (€ + %) ligne par ligne.
     *
     * Query params:
     *   - from=YYYY-MM-DD, to=YYYY-MM-DD
     *   - client_id, currency, status, search
     *   - per_page (def. 25)
     */
    public function salesSummary(Request $request)
    {
        $user     = Auth::user();
        $tenantId = $user->hasRole('SUPER_ADMIN')
            ? $request->get('tenant_id')
            : $user->tenant_id;

        $query = Invoice::with([
            'client:id,name,phone1,client_type',
            'items.product:id,name,sku,purchase_price,carton_purchase_price,units_per_carton',
            'items.supplier:id,name',
        ]);

        if ($tenantId) $query->where('tenant_id', $tenantId);
        if ($request->filled('from'))     $query->whereDate('created_at', '>=', $request->from);
        if ($request->filled('to'))       $query->whereDate('created_at', '<=', $request->to);
        if ($request->filled('client_id')) $query->where('client_id', $request->client_id);
        if ($request->filled('currency')) $query->where('currency', $request->currency);
        if ($request->filled('status'))   $query->where('status', $request->status);
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('invoice_number', 'like', "%{$s}%")
                  ->orWhereHas('client', fn ($cq) => $cq->where('name', 'like', "%{$s}%"));
            });
        }

        $perPage   = (int) $request->get('per_page', 25);
        $paginated = $query->orderByDesc('created_at')->paginate($perPage);

        // Agrégat global (sur TOUTE la requête filtrée, pas seulement la page)
        $allIds = (clone $query)->pluck('id');
        $allInvoices = Invoice::with([
            'items.product:id,purchase_price,carton_purchase_price,units_per_carton',
        ])->whereIn('id', $allIds)->get();

        $totalRevenueGnf = 0.0;
        $totalCostGnf    = 0.0;
        $totalRevenueNative = 0.0;
        $totalCostNative    = 0.0;
        $sampleCount = 0;
        $itemsCount  = 0;

        foreach ($allInvoices as $inv) {
            foreach ($inv->items as $it) {
                $itemsCount++;
                if ($it->is_sample) { $sampleCount++; continue; }
                $cost = $this->unitCost($it) * (float) $it->quantity;
                $rev  = (float) $it->line_total;
                $totalRevenueNative += $rev;
                $totalCostNative    += $cost;
                $rate = (float) ($inv->exchange_rate ?: 1);
                $totalRevenueGnf += ($inv->currency === 'GNF') ? $rev : $rev * $rate;
                $totalCostGnf    += ($inv->currency === 'GNF') ? $cost : $cost * $rate;
            }
        }

        // Enrichir les lignes paginées avec marge calculée
        $items = collect($paginated->items())->map(function (Invoice $inv) {
            $revenue = 0.0; $cost = 0.0; $samples = 0;
            $itemRows = $inv->items->map(function ($it) use (&$revenue, &$cost, &$samples) {
                $isSample = (bool) $it->is_sample;
                if ($isSample) $samples++;
                $unitCost = $this->unitCost($it);
                $lineCost = $isSample ? 0.0 : $unitCost * (float) $it->quantity;
                $lineRev  = (float) $it->line_total;
                $margin   = $lineRev - $lineCost;
                $marginPct = $lineRev > 0 ? round(($margin / $lineRev) * 100, 1) : null;
                if (!$isSample) { $revenue += $lineRev; $cost += $lineCost; }
                return [
                    'id'           => $it->id,
                    'product_id'   => $it->product_id,
                    'product_name' => $it->product->name ?? $it->description,
                    'sku'          => $it->product->sku ?? null,
                    'supplier'     => $it->supplier->name ?? null,
                    'sale_type'    => $it->sale_type,
                    'quantity'     => (float) $it->quantity,
                    'unit_price'   => (float) $it->unit_price,
                    'unit_cost'    => round($unitCost, 2),
                    'discount'     => (float) $it->discount_amount,
                    'is_sample'    => $isSample,
                    'line_total'   => round($lineRev, 2),
                    'line_cost'    => round($lineCost, 2),
                    'margin'       => round($margin, 2),
                    'margin_pct'   => $marginPct,
                ];
            });
            $invMargin    = $revenue - $cost;
            $invMarginPct = $revenue > 0 ? round(($invMargin / $revenue) * 100, 1) : null;
            return [
                'id'              => $inv->id,
                'invoice_number'  => $inv->invoice_number,
                'date'            => $inv->created_at?->format('Y-m-d'),
                'client'          => $inv->client ? [
                    'id' => $inv->client->id, 'name' => $inv->client->name,
                    'phone1' => $inv->client->phone1, 'client_type' => $inv->client->client_type,
                ] : null,
                'currency'        => $inv->currency,
                'exchange_rate'   => (float) $inv->exchange_rate,
                'status'          => $inv->status,
                'total_amount'    => (float) $inv->total_amount,
                'total_amount_gnf'=> (float) $inv->total_amount_gnf,
                'paid_amount'     => (float) $inv->paid_amount,
                'items_subtotal'  => (float) $inv->items_subtotal_amount,
                'previous_balance'=> (float) $inv->previous_balance_amount,
                'samples_count'   => $samples,
                'revenue'         => round($revenue, 2),
                'cost'            => round($cost, 2),
                'margin'          => round($invMargin, 2),
                'margin_pct'      => $invMarginPct,
                'items'           => $itemRows,
            ];
        });

        $marginGnf = $totalRevenueGnf - $totalCostGnf;
        $marginPct = $totalRevenueGnf > 0 ? round(($marginGnf / $totalRevenueGnf) * 100, 1) : null;

        return $this->sendResponse([
            'summary' => [
                'invoices_count'        => $paginated->total(),
                'items_count'           => $itemsCount,
                'samples_count'         => $sampleCount,
                'total_revenue_gnf'     => round($totalRevenueGnf, 2),
                'total_cost_gnf'        => round($totalCostGnf, 2),
                'total_margin_gnf'      => round($marginGnf, 2),
                'margin_pct'            => $marginPct,
                'total_revenue_native'  => round($totalRevenueNative, 2),
                'total_cost_native'     => round($totalCostNative, 2),
            ],
            'invoices' => $items,
            'pagination' => [
                'current_page' => $paginated->currentPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
                'last_page'    => $paginated->lastPage(),
            ],
            'period' => ['from' => $request->from, 'to' => $request->to],
        ], 'Sales summary retrieved successfully');
    }

    /**
     * Coût unitaire d'un item selon le sale_type et les prix du produit.
     */
    private function unitCost($item): float
    {
        $p = $item->product ?? null;
        if (!$p) return 0.0;
        $unitsPerCarton = max(1, (int) ($p->units_per_carton ?: 1));
        $unitCost   = (float) ($p->purchase_price ?? 0);
        $cartonCost = (float) ($p->carton_purchase_price ?? ($unitCost * $unitsPerCarton));
        switch ($item->sale_type) {
            case 'CARTON':      return $cartonCost;
            case 'DEMI_CARTON': return $cartonCost / 2;
            case 'DOUZAINE':    return $unitCost * 12;
            default:            return $unitCost;
        }
    }

    private function validator(Request $request, ?int $invoiceId)
    {
        return Validator::make($request->all(), [
            'client_id'                => 'nullable|exists:clients,id',
            'invoice_number'           => 'nullable|string|max:100',
            'total_amount'             => 'nullable|numeric|min:0',
            'status'                   => 'nullable|in:PAYE,PARTIEL,IMPAYE',
            'due_date'                 => 'nullable|date',
            'notes'                    => 'nullable|string|max:2000',
            'currency'                 => 'nullable|string|max:10',
            'exchange_rate'            => 'nullable|numeric|min:0',
            'previous_balance_amount'  => 'nullable|numeric|min:0',
            'include_previous_balance' => 'nullable|boolean',
            'line_items'                    => 'nullable|array',
            'line_items.*.product_id'       => 'nullable|exists:products,id',
            'line_items.*.supplier_id'      => 'nullable|exists:suppliers,id',
            'line_items.*.sale_type'        => 'nullable|in:UNITE,CARTON,DEMI_CARTON,DOUZAINE',
            'line_items.*.is_sample'        => 'nullable|boolean',
            'line_items.*.description'      => 'required_with:line_items|string|max:255',
            'line_items.*.quantity'         => 'nullable|numeric|min:0.01',
            'line_items.*.unit_price'       => 'nullable|numeric|min:0',
            'line_items.*.discount_amount'  => 'nullable|numeric|min:0',
        ]);
    }

    private function buildInvoicePayload(Request $request, int $tenantId, ?int $invoiceId = null): array
    {
        $currency     = $request->currency ?? 'GNF';
        $exchangeRate = $request->exchange_rate ?? 1;

        if ($currency !== 'GNF' && (float) $exchangeRate === 1.0) {
            $cur = Currency::where('tenant_id', $tenantId)->where('code', $currency)->first();
            if ($cur) {
                $exchangeRate = $cur->exchange_rate;
            }
        }

        $lineItems = collect($request->get('line_items', []))
            ->filter(fn ($item) => filled($item['description'] ?? null))
            ->values()
            ->map(function ($item, $index) {
                $quantity  = (float) ($item['quantity'] ?? 1);
                $unitPrice = (float) ($item['unit_price'] ?? 0);
                $discount  = (float) ($item['discount_amount'] ?? 0);
                $isSample  = (bool) ($item['is_sample'] ?? false);
                $saleType  = in_array($item['sale_type'] ?? '', ['UNITE', 'CARTON', 'DEMI_CARTON', 'DOUZAINE'])
                    ? $item['sale_type']
                    : 'UNITE';

                // Total ligne : 0 si échantillon ; sinon qty*prix - rabais (jamais négatif)
                $lineTotal = $isSample
                    ? 0.0
                    : max(0, round(($quantity * $unitPrice) - $discount, 2));

                return [
                    'product_id'      => $item['product_id'] ?? null,
                    'supplier_id'     => $item['supplier_id'] ?? null,
                    'sale_type'       => $saleType,
                    'is_sample'       => $isSample,
                    'description'     => $item['description'],
                    'quantity'        => $quantity,
                    'unit_price'      => $unitPrice,
                    'discount_amount' => $discount,
                    'line_total'      => $lineTotal,
                    'sort_order'      => $index,
                ];
            })->all();

        $itemsSubtotal = !empty($lineItems)
            ? round(collect($lineItems)->sum('line_total'), 2)
            : round((float) ($request->total_amount ?? 0), 2);

        $includePrevious = $request->has('include_previous_balance')
            ? $request->boolean('include_previous_balance')
            : true;

        $previousBalance = 0;
        if ($request->filled('previous_balance_amount')) {
            $previousBalance = round((float) $request->previous_balance_amount, 2);
        } elseif ($includePrevious && $request->filled('client_id')) {
            $previousBalance = $this->getOutstandingClientBalance((int) $request->client_id, $tenantId, $invoiceId);
        }

        $totalAmount = round($itemsSubtotal + $previousBalance, 2);
        $totalGnf = ($currency === 'GNF')
            ? $totalAmount
            : round($totalAmount * (float) $exchangeRate, 2);

        return [
            'invoice_number'          => $request->invoice_number ?: $this->generateInvoiceNumber($tenantId, $invoiceId),
            'currency'                => $currency,
            'exchange_rate'           => $exchangeRate,
            'line_items'              => $lineItems,
            'items_subtotal_amount'   => $itemsSubtotal,
            'previous_balance_amount' => $previousBalance,
            'total_amount'            => $totalAmount,
            'total_amount_gnf'        => $totalGnf,
        ];
    }

    private function syncItems(Invoice $invoice, array $lineItems): void
    {
        $this->restoreInvoiceStock($invoice);

        $invoice->items()->delete();

        foreach ($lineItems as $item) {
            $this->reserveStockForItem($invoice->tenant_id, $item);
            $invoice->items()->create($item);
        }
    }

    private function restoreInvoiceStock(Invoice $invoice): void
    {
        foreach ($invoice->items as $item) {
            if (!$item->product_id) {
                continue;
            }

            $product = Product::where('tenant_id', $invoice->tenant_id)->find($item->product_id);
            if ($product) {
                $product->stock_quantity = (int) ($product->stock_quantity ?? 0) + (float) $item->quantity;
                $product->save();
            }
        }
    }

    private function reserveStockForItem(int $tenantId, array $item): void
    {
        if (empty($item['product_id'])) {
            return;
        }

        $product = Product::where('tenant_id', $tenantId)->lockForUpdate()->findOrFail($item['product_id']);
        $quantity = (float) ($item['quantity'] ?? 0);
        $currentStock = (float) ($product->stock_quantity ?? 0);

        if ($currentStock < $quantity) {
            throw new \RuntimeException("Stock insuffisant pour le produit {$product->name}");
        }

        $product->stock_quantity = $currentStock - $quantity;
        $product->save();
    }

    private function getOutstandingClientBalance(int $clientId, int $tenantId, ?int $excludeInvoiceId = null): float
    {
        $invoiceQuery = Invoice::where('tenant_id', $tenantId)
            ->where('client_id', $clientId)
            ->whereIn('status', ['IMPAYE', 'PARTIEL']);

        if ($excludeInvoiceId) {
            $invoiceQuery->where('id', '!=', $excludeInvoiceId);
        }

        $invoiceBalance = (float) $invoiceQuery->sum(DB::raw('GREATEST(total_amount - paid_amount, 0)'));

        $returnCredits = (float) ProductReturn::where('tenant_id', $tenantId)
            ->where('client_id', $clientId)
            ->whereNull('invoice_id')
            ->where('status', 'APPROVED')
            ->sum('client_credit_amount');

        $paymentCredits = (float) Payment::where('tenant_id', $tenantId)
            ->where('client_id', $clientId)
            ->where('status', 'COMPLETED')
            ->where('type', 'CLIENT')
            ->whereNull('invoice_id')
            ->get()
            ->sum(fn ($payment) => $payment->amount_gnf);

        return max(0, round($invoiceBalance - $returnCredits - $paymentCredits, 2));
    }

    private function generateInvoiceNumber(int $tenantId, ?int $excludeInvoiceId = null): string
    {
        $prefix = 'FACT-' . now()->format('Y') . '-';

        $query = Invoice::where('tenant_id', $tenantId)
            ->where('invoice_number', 'like', $prefix . '%');

        if ($excludeInvoiceId) {
            $query->where('id', '!=', $excludeInvoiceId);
        }

        $lastInvoice = $query->orderByDesc('id')->first();
        $next = 1;

        if ($lastInvoice && preg_match('/(\d+)$/', $lastInvoice->invoice_number, $matches)) {
            $next = ((int) $matches[1]) + 1;
        }

        return $prefix . str_pad((string) $next, 3, '0', STR_PAD_LEFT);
    }
}
