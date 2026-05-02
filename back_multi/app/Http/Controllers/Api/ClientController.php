<?php

namespace App\Http\Controllers\Api;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Models\ContainerSale;
use App\Models\ContainerSalePayment;
use App\Models\ClientAdvance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class ClientController extends BaseController
{
    public function index(Request $request)
    {
        $user     = Auth::user();
        $tenantId = $user->hasRole('SUPER_ADMIN') ? $request->get('tenant_id') : $user->tenant_id;

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
            Storage::disk('public')->delete($client->photo);
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
            Storage::disk('public')->delete($client->photo);
        }

        $path = $request->file('photo')->store('clients', 'public');
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
            Storage::disk('public')->delete($client->photo);
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

    public function getStatistics(Request $request)
    {
        $user     = Auth::user();
        $tenantId = $user->hasRole('SUPER_ADMIN') ? $request->get('tenant_id') : $user->tenant_id;

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
}
