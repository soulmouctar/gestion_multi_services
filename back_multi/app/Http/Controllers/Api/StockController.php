<?php

namespace App\Http\Controllers\Api;

use App\Models\Product;
use App\Models\StockAdjustment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Etat du stock par produit et ajustements hors achat et vente.
 *
 * Chaque produit a deux stocks : le stock sain, vendu au prix normal, et le
 * stock avarie, tenu a part et vendu a prix libre. Rien ne disparait sans
 * trace : une avarie, une perte ou un ecart d'inventaire est une ecriture datee.
 */
class StockController extends BaseController
{
    private function tenantId(Request $request): ?int
    {
        $user = Auth::user();
        if ($user && $user->hasRole('SUPER_ADMIN')) {
            return $request->filled('tenant_id') ? (int) $request->tenant_id : ($user->tenant_id ?: null);
        }
        return $user?->tenant_id;
    }

    /** Par produit d'une categorie : entre, vendu, avarie, perdu, reste. Tout en pieces. */
    public function summary(Request $request)
    {
        $tenantId = $this->tenantId($request);
        if (!$tenantId) {
            return $this->sendError('tenant_id requis.', [], 400);
        }

        $products = Product::where('tenant_id', $tenantId)
            ->when($request->filled('category_id'), fn ($q) => $q->where('product_category_id', $request->category_id))
            ->orderBy('name')
            ->get(['id', 'name', 'product_category_id', 'units_per_carton', 'purchase_price', 'selling_price',
                'carton_selling_price', 'stock_quantity', 'damaged_quantity', 'low_stock_threshold']);
        $ids = $products->pluck('id');

        $received = DB::table('supplier_purchases')
            ->whereIn('product_id', $ids)->whereNull('deleted_at')
            ->groupBy('product_id')
            ->selectRaw('product_id, SUM(quantity) as units')
            ->pluck('units', 'product_id');

        // Une ligne de vente compte en pieces : 2 cartons de 48 sortent 96 pieces
        $sold = DB::table('invoice_items')
            ->join('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')
            ->join('products', 'invoice_items.product_id', '=', 'products.id')
            ->whereIn('invoice_items.product_id', $ids)->whereNull('invoices.deleted_at')
            ->groupBy('invoice_items.product_id', 'invoice_items.from_damaged')
            ->selectRaw("invoice_items.product_id, invoice_items.from_damaged,
                SUM(CEIL(invoice_items.quantity * CASE invoice_items.sale_type
                    WHEN 'CARTON' THEN GREATEST(COALESCE(products.units_per_carton, 1), 1)
                    WHEN 'DEMI_CARTON' THEN GREATEST(COALESCE(products.units_per_carton, 1), 1) / 2
                    WHEN 'DOUZAINE' THEN 12 ELSE 1 END)) as units")
            ->get()
            ->groupBy('product_id');

        $lost = StockAdjustment::whereIn('product_id', $ids)->where('type', 'PERTE')
            ->groupBy('product_id')
            ->selectRaw('product_id, SUM(-(stock_delta + damaged_delta)) as units')
            ->pluck('units', 'product_id');

        $rows = $products->map(function (Product $product) use ($received, $sold, $lost) {
            $sales = $sold->get($product->id, collect());
            return [
                'id' => $product->id,
                'name' => $product->name,
                'units_per_carton' => max(1, (int) ($product->units_per_carton ?: 1)),
                'purchase_price' => (float) $product->purchase_price,
                'selling_price' => (float) $product->selling_price,
                'carton_selling_price' => (float) $product->carton_selling_price,
                'low_stock_threshold' => (int) $product->low_stock_threshold,
                'received' => (int) round((float) ($received[$product->id] ?? 0)),
                'sold' => (int) ($sales->firstWhere('from_damaged', 0)->units ?? 0),
                'sold_damaged' => (int) ($sales->firstWhere('from_damaged', 1)->units ?? 0),
                'lost' => (int) ($lost[$product->id] ?? 0),
                'damaged' => (int) $product->damaged_quantity,
                'stock' => (int) $product->stock_quantity,
            ];
        });

        return $this->sendResponse([
            'products' => $rows->values(),
            'totals' => [
                'received' => $rows->sum('received'),
                'sold' => $rows->sum('sold'),
                'sold_damaged' => $rows->sum('sold_damaged'),
                'lost' => $rows->sum('lost'),
                'damaged' => $rows->sum('damaged'),
                'stock' => $rows->sum('stock'),
            ],
        ], 'Etat du stock');
    }

    public function adjust(Request $request, $id)
    {
        $tenantId = $this->tenantId($request);
        $validator = Validator::make($request->all(), [
            'type'            => 'required|in:' . implode(',', StockAdjustment::TYPES),
            // AVARIE, PERTE, REMISE : nombre de pieces concernees
            'quantity'        => 'required_unless:type,INVENTAIRE|nullable|integer|min:1',
            // PERTE : d'ou sortent les pieces
            'source'          => 'nullable|in:SAIN,AVARIE',
            // INVENTAIRE : ce qui a ete compte
            'counted_stock'   => 'required_if:type,INVENTAIRE|nullable|integer|min:0',
            'counted_damaged' => 'nullable|integer|min:0',
            'reason'          => 'nullable|string|max:500',
            'adjustment_date' => 'required|date',
        ]);
        if ($validator->fails()) {
            return $this->sendError($validator->errors()->first(), $validator->errors()->toArray(), 422);
        }

        try {
            $adjustment = DB::transaction(function () use ($request, $tenantId, $id) {
                $product = Product::where('tenant_id', $tenantId)->lockForUpdate()->find($id);
                if (!$product) {
                    throw new \DomainException('Produit introuvable.');
                }
                $stock = (int) $product->stock_quantity;
                $damaged = (int) $product->damaged_quantity;
                $quantity = (int) $request->quantity;

                [$stockDelta, $damagedDelta] = match ($request->type) {
                    'AVARIE' => [-$quantity, $quantity],
                    'REMISE' => [$quantity, -$quantity],
                    'PERTE' => $request->input('source', 'AVARIE') === 'SAIN' ? [-$quantity, 0] : [0, -$quantity],
                    'INVENTAIRE' => [
                        (int) $request->counted_stock - $stock,
                        $request->filled('counted_damaged') ? (int) $request->counted_damaged - $damaged : 0,
                    ],
                };

                if ($stock + $stockDelta < 0) {
                    throw new \DomainException("Stock sain insuffisant : {$stock} piece(s) disponible(s).");
                }
                if ($damaged + $damagedDelta < 0) {
                    throw new \DomainException("Stock avarie insuffisant : {$damaged} piece(s) disponible(s).");
                }
                if ($stockDelta === 0 && $damagedDelta === 0) {
                    throw new \DomainException('Le comptage correspond deja au stock : aucun ecart a enregistrer.');
                }

                $product->forceFill([
                    'stock_quantity' => $stock + $stockDelta,
                    'damaged_quantity' => $damaged + $damagedDelta,
                ])->save();

                return StockAdjustment::create([
                    'tenant_id' => $tenantId,
                    'product_id' => $product->id,
                    'user_id' => Auth::id(),
                    'type' => $request->type,
                    'stock_delta' => $stockDelta,
                    'damaged_delta' => $damagedDelta,
                    'reason' => $request->reason,
                    'adjustment_date' => $request->adjustment_date,
                ]);
            });
        } catch (\DomainException $e) {
            return $this->sendError($e->getMessage(), [], 422);
        }

        return $this->sendResponse($adjustment, 'Ajustement de stock enregistre', 201);
    }
}
