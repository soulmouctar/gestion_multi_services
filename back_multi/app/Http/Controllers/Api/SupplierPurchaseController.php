<?php

namespace App\Http\Controllers\Api;

use App\Models\Currency;
use App\Models\Supplier;
use App\Models\SupplierPurchase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Achats fournisseurs hors arrivages de conteneurs.
 *
 * Chaque achat debite le compte-devise du fournisseur, de sorte que sa
 * situation reflete l'ensemble des marchandises prises, pas seulement les
 * conteneurs.
 */
class SupplierPurchaseController extends BaseController
{
    private function tenantId(Request $request): ?int
    {
        $user = Auth::user();
        if ($user && $user->hasRole('SUPER_ADMIN')) {
            return $request->filled('tenant_id') ? (int) $request->tenant_id : ($user->tenant_id ?: null);
        }
        return $user?->tenant_id;
    }

    private function supplierFor(Request $request, $supplierId): ?Supplier
    {
        $tenantId = $this->tenantId($request);
        return Supplier::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))->find($supplierId);
    }

    /** Taux devise -> GNF du tenant. Null si la devise n'est pas configuree. */
    private function gnfRate(int $tenantId, string $currency, ?float $provided): ?float
    {
        $currency = strtoupper($currency);
        if ($currency === 'GNF') return 1.0;
        if ($provided && $provided > 1) return $provided;

        $rate = Currency::where('tenant_id', $tenantId)->where('code', $currency)->value('exchange_rate');
        return $rate && (float) $rate > 1 ? (float) $rate : null;
    }

    public function index(Request $request)
    {
        $tenantId = $this->tenantId($request);
        if (!$tenantId) {
            return $this->sendError('tenant_id requis.', [], 400);
        }

        $query = SupplierPurchase::with(['supplier:id,name,category', 'productCategory:id,name'])
            ->where('tenant_id', $tenantId)
            ->when($request->filled('supplier_id'), fn ($q) => $q->where('supplier_id', $request->supplier_id))
            ->when($request->filled('category'), fn ($q) => $q->where('category', $request->category))
            ->when($request->filled('from'), fn ($q) => $q->whereDate('purchase_date', '>=', $request->from))
            ->when($request->filled('to'), fn ($q) => $q->whereDate('purchase_date', '<=', $request->to))
            ->when($request->filled('search'), function ($q) use ($request) {
                $s = $request->search;
                $q->where(fn ($n) => $n->where('designation', 'like', "%{$s}%")
                    ->orWhere('reference', 'like', "%{$s}%")
                    ->orWhere('purchase_number', 'like', "%{$s}%"));
            })
            ->orderByDesc('purchase_date')
            ->orderByDesc('id');

        $rows = $query->paginate((int) $request->get('per_page', 25));

        return $this->sendResponse($rows, 'Achats fournisseurs');
    }

    public function store(Request $request, $supplierId)
    {
        $supplier = $this->supplierFor($request, $supplierId);
        if (!$supplier) {
            return $this->sendError('Fournisseur introuvable', [], 404);
        }

        $validator = Validator::make($request->all(), [
            'designation'         => 'required|string|max:255',
            'category'            => 'nullable|in:' . implode(',', SupplierPurchase::CATEGORIES),
            'product_category_id' => 'nullable|exists:product_categories,id',
            'quantity'            => 'required|numeric|min:0.01',
            'unit_price'          => 'required|numeric|min:0',
            'currency'            => 'required|string|max:10',
            'exchange_rate'       => 'nullable|numeric|min:0.0001',
            'purchase_date'       => 'required|date',
            'reference'           => 'nullable|string|max:100',
            'notes'               => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $currency = strtoupper($request->currency);
        $rate     = $this->gnfRate((int) $supplier->tenant_id, $currency, $request->exchange_rate ? (float) $request->exchange_rate : null);

        if ($rate === null) {
            return $this->sendError(
                "Taux {$currency} → GNF introuvable : configurez la devise dans Finance › Devises.",
                ['exchange_rate' => ["Aucun taux {$currency} vers GNF n'est defini."]],
                422
            );
        }

        $total = round((float) $request->quantity * (float) $request->unit_price, 2);

        $purchase = DB::transaction(function () use ($request, $supplier, $currency, $rate, $total) {
            $purchase = SupplierPurchase::create([
                'tenant_id'           => $supplier->tenant_id,
                'supplier_id'         => $supplier->id,
                'purchase_number'     => $this->nextNumber((int) $supplier->tenant_id),
                'category'            => $request->category ?: $this->guessCategory($supplier),
                'product_category_id' => $request->product_category_id,
                'designation'         => $request->designation,
                'quantity'            => $request->quantity,
                'unit_price'          => $request->unit_price,
                'total_amount'        => $total,
                'currency'            => $currency,
                'exchange_rate'       => $rate,
                'total_amount_gnf'    => round($total * $rate, 2),
                'purchase_date'       => $request->purchase_date,
                'reference'           => $request->reference,
                'notes'               => $request->notes,
            ]);

            $purchase->postToAccount();

            return $purchase;
        });

        return $this->sendResponse($purchase->load('supplier:id,name'), 'Achat enregistre', 201);
    }

    public function update(Request $request, $id)
    {
        $tenantId = $this->tenantId($request);
        $purchase = SupplierPurchase::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))->find($id);

        if (!$purchase) {
            return $this->sendError('Achat introuvable', [], 404);
        }

        $validator = Validator::make($request->all(), [
            'designation'   => 'sometimes|string|max:255',
            'category'      => 'sometimes|in:' . implode(',', SupplierPurchase::CATEGORIES),
            'quantity'      => 'sometimes|numeric|min:0.01',
            'unit_price'    => 'sometimes|numeric|min:0',
            'currency'      => 'sometimes|string|max:10',
            'exchange_rate' => 'nullable|numeric|min:0.0001',
            'purchase_date' => 'sometimes|date',
            'reference'     => 'nullable|string|max:100',
            'notes'         => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        DB::transaction(function () use ($request, $purchase) {
            // On retire l'ancien montant avant d'appliquer le nouveau, sinon le
            // compte cumulerait les deux versions de l'achat.
            $purchase->unpostFromAccount();

            $currency = strtoupper($request->get('currency', $purchase->currency));
            $rate     = $this->gnfRate((int) $purchase->tenant_id, $currency, $request->exchange_rate ? (float) $request->exchange_rate : null)
                ?? (float) $purchase->exchange_rate;

            $qty   = (float) $request->get('quantity', $purchase->quantity);
            $price = (float) $request->get('unit_price', $purchase->unit_price);
            $total = round($qty * $price, 2);

            $purchase->fill(array_filter([
                'designation'   => $request->get('designation'),
                'category'      => $request->get('category'),
                'purchase_date' => $request->get('purchase_date'),
                'reference'     => $request->get('reference'),
                'notes'         => $request->get('notes'),
            ], fn ($v) => $v !== null));

            $purchase->quantity         = $qty;
            $purchase->unit_price       = $price;
            $purchase->total_amount     = $total;
            $purchase->currency         = $currency;
            $purchase->exchange_rate    = $rate;
            $purchase->total_amount_gnf = round($total * $rate, 2);
            $purchase->save();

            $purchase->postToAccount();
        });

        return $this->sendResponse($purchase->fresh(), 'Achat mis a jour');
    }

    public function destroy(Request $request, $id)
    {
        $tenantId = $this->tenantId($request);
        $purchase = SupplierPurchase::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))->find($id);

        if (!$purchase) {
            return $this->sendError('Achat introuvable', [], 404);
        }

        DB::transaction(function () use ($purchase) {
            $purchase->unpostFromAccount();
            $purchase->delete();
        });

        return $this->sendResponse([], 'Achat supprime');
    }

    private function nextNumber(int $tenantId): string
    {
        $year = now()->format('Y');
        $count = SupplierPurchase::withTrashed()
            ->where('tenant_id', $tenantId)
            ->whereYear('created_at', $year)
            ->count() + 1;

        return sprintf('ACH-%s-%03d', $year, $count);
    }

    /** A defaut de categorie explicite, on reprend celle du fournisseur. */
    private function guessCategory(Supplier $supplier): string
    {
        $map = [
            'textile'          => 'TEXTILE',
            'cosmétiques'      => 'COSMETIQUES',
            'cosmetiques'      => 'COSMETIQUES',
            'pneus'            => 'PNEUS',
            'machine à coudre' => 'MACHINE_A_COUDRE',
            'machine a coudre' => 'MACHINE_A_COUDRE',
        ];

        return $map[mb_strtolower((string) $supplier->category)] ?? 'AUTRE';
    }
}
