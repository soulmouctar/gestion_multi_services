<?php

namespace App\Http\Controllers\Api;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Supplier;
use App\Models\SupplierPurchase;
use App\Models\TyreContainer;
use App\Models\TyreContainerExpense;
use App\Support\GnfRate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Conteneurs de pneus et leur rentabilite.
 *
 * Les ventes de pneus sont rattachees au conteneur par periode : tout ce qui
 * est vendu entre l'arrivee d'un conteneur et celle du suivant lui revient.
 * Tout est exprime en GNF pour pouvoir comparer prix, ventes et depenses.
 */
class TyreContainerController extends BaseController
{
    private function tenantId(Request $request): ?int
    {
        $user = Auth::user();
        if ($user && $user->hasRole('SUPER_ADMIN')) {
            return $request->filled('tenant_id') ? (int) $request->tenant_id : ($user->tenant_id ?: null);
        }
        return $user?->tenant_id;
    }

    public function index(Request $request)
    {
        $tenantId = $this->tenantId($request);
        if (!$tenantId) {
            return $this->sendError('tenant_id requis.', [], 400);
        }

        $family = $this->family($request);
        // La periode d'un conteneur s'arrete a l'arrivee du suivant de la meme famille
        $containers = TyreContainer::with(['supplier:id,name', 'expenses'])
            ->where('tenant_id', $tenantId)->where('family', $family)
            ->orderBy('arrival_date')->orderBy('id')
            ->get();

        $tyreCategoryId = $this->categoryId($family);

        $rows = [];
        foreach ($containers as $index => $container) {
            $from = $container->arrival_date->toDateString();
            // La periode s'arrete a la veille de l'arrivee du conteneur suivant
            $next = $containers[$index + 1] ?? null;
            $until = $next ? $next->arrival_date->toDateString() : null;

            $sales = DB::table('invoice_items')
                ->join('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')
                ->join('products', 'invoice_items.product_id', '=', 'products.id')
                ->where('invoices.tenant_id', $tenantId)
                ->whereNull('invoices.deleted_at')
                ->where('products.product_category_id', $tyreCategoryId)
                ->whereDate('invoices.created_at', '>=', $from)
                ->when($until, fn ($q) => $q->whereDate('invoices.created_at', '<', $until))
                ->selectRaw('COALESCE(SUM(invoice_items.line_total * COALESCE(NULLIF(invoices.exchange_rate, 0), 1)), 0) as amount_gnf')
                ->selectRaw("COALESCE(SUM(CEIL(invoice_items.quantity * CASE invoice_items.sale_type
                    WHEN 'CARTON' THEN GREATEST(COALESCE(products.units_per_carton, 1), 1)
                    WHEN 'DEMI_CARTON' THEN GREATEST(COALESCE(products.units_per_carton, 1), 1) / 2
                    WHEN 'DOUZAINE' THEN 12 ELSE 1 END)), 0) as tyres")
                ->first();

            $priceGnf = round($container->purchase_price * ($container->exchange_rate ?: 1), 2);
            $salesGnf = round((float) $sales->amount_gnf, 2);
            $expensesGnf = round((float) $container->expenses->sum('amount'), 2);

            $rows[] = [
                'id' => $container->id,
                'family' => $container->family,
                'reference' => $container->reference,
                'supplier' => $container->supplier,
                'arrival_date' => $from,
                'period_end' => $until,
                'purchase_price' => $container->purchase_price,
                'currency' => $container->currency,
                'exchange_rate' => $container->exchange_rate,
                'notes' => $container->notes,
                'price_gnf' => $priceGnf,
                'sales_gnf' => $salesGnf,
                'tyres_sold' => (int) round((float) $sales->tyres),
                'expenses_gnf' => $expensesGnf,
                // Comme dans le classeur : ce qu'il reste des ventes une fois les depenses payees
                'after_expenses_gnf' => round($salesGnf - $expensesGnf, 2),
                // Resultat du conteneur : positif une fois son prix d'achat couvert
                'result_gnf' => round($salesGnf - $expensesGnf - $priceGnf, 2),
                'expenses' => $container->expenses->map(fn ($expense) => [
                    'id' => $expense->id,
                    'label' => $expense->label,
                    'amount' => $expense->amount,
                    'expense_date' => $expense->expense_date->toDateString(),
                ]),
            ];
        }

        // Le plus recent en premier a l'ecran
        return $this->sendResponse(array_reverse($rows), 'Conteneurs de pneus');
    }

    public function store(Request $request)
    {
        $tenantId = $this->tenantId($request);
        if (!$tenantId) {
            return $this->sendError('tenant_id requis.', [], 400);
        }

        $validator = Validator::make($request->all(), [
            'family'             => 'nullable|in:pneus,cosmetique',
            'reference'          => 'required|string|max:100',
            'supplier_id'        => 'required|exists:suppliers,id',
            'arrival_date'       => 'required|date',
            'purchase_price'     => 'required|numeric|min:0',
            'currency'           => 'required|string|max:10',
            'exchange_rate'      => 'nullable|numeric|min:0.0001',
            'notes'              => 'nullable|string|max:1000',
            'lines'              => 'nullable|array',
            'lines.*.product_id' => 'required|exists:products,id',
            'lines.*.quantity'   => 'required|integer|min:1',
        ]);
        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $supplier = Supplier::where('tenant_id', $tenantId)->find($request->supplier_id);
        if (!$supplier) {
            return $this->sendError('Fournisseur introuvable pour cette organisation.', [], 422);
        }
        $currency = strtoupper($request->currency);
        $rate = GnfRate::resolve($tenantId, $currency, $request->exchange_rate);
        if ($rate === null) {
            $message = GnfRate::missingMessage($currency);
            return $this->sendError($message, ['exchange_rate' => [$message]], 422);
        }

        $lines = collect($request->get('lines', []));
        $products = Product::where('tenant_id', $tenantId)->whereIn('id', $lines->pluck('product_id'))->get()->keyBy('id');
        if ($products->count() !== $lines->pluck('product_id')->unique()->count()) {
            return $this->sendError('Un des produits n\'appartient pas a cette organisation.', [], 422);
        }

        $container = DB::transaction(function () use ($request, $tenantId, $supplier, $currency, $rate, $lines, $products) {
            $container = TyreContainer::create([
                'tenant_id' => $tenantId,
                'family' => $this->family($request),
                'supplier_id' => $supplier->id,
                'reference' => $request->reference,
                'arrival_date' => $request->arrival_date,
                'purchase_price' => $request->purchase_price,
                'currency' => $currency,
                'exchange_rate' => $rate,
                'notes' => $request->notes,
            ]);

            // Le prix du conteneur devient la dette envers le fournisseur
            $price = (float) $request->purchase_price;
            $debt = $this->purchase($container, [
                'designation' => ($container->family === 'cosmetique' ? 'Conteneur de cosmétique ' : 'Conteneur de pneus ') . $container->reference,
                'quantity' => 1,
                'unit_price' => $price,
                'total_amount' => $price,
                'total_amount_gnf' => round($price * $rate, 2),
            ]);
            $debt->postToAccount();

            // Chaque dimension entre en stock ; son prix est deja compte dans celui du conteneur
            foreach ($lines as $line) {
                $entry = $this->purchase($container, [
                    'designation' => $products[$line['product_id']]->name,
                    'product_id' => $line['product_id'],
                    'product_category_id' => $products[$line['product_id']]->product_category_id,
                    'quantity' => $line['quantity'],
                    'unit_price' => 0,
                    'total_amount' => 0,
                    'total_amount_gnf' => 0,
                ]);
                $entry->moveStock((float) $line['quantity']);
            }

            return $container;
        });

        return $this->sendResponse($container, 'Conteneur enregistre', 201);
    }

    public function destroy(Request $request, $id)
    {
        $container = TyreContainer::where('tenant_id', $this->tenantId($request))->find($id);
        if (!$container) {
            return $this->sendError('Conteneur introuvable', [], 404);
        }

        DB::transaction(function () use ($container) {
            foreach ($container->purchases as $purchase) {
                // Les pneus entres avec le conteneur ressortent du stock
                $purchase->moveStock(-(float) $purchase->quantity);
                $purchase->delete();
                $purchase->unpostFromAccount();
            }
            $container->expenses()->delete();
            $container->delete();
        });

        return $this->sendResponse([], 'Conteneur supprime');
    }

    public function storeExpense(Request $request, $id)
    {
        $container = TyreContainer::where('tenant_id', $this->tenantId($request))->find($id);
        if (!$container) {
            return $this->sendError('Conteneur introuvable', [], 404);
        }

        $validator = Validator::make($request->all(), [
            'label'        => 'required|string|max:255',
            'amount'       => 'required|numeric|min:0.01',
            'expense_date' => 'required|date',
        ]);
        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $expense = $container->expenses()->create($request->only(['label', 'amount', 'expense_date']));

        return $this->sendResponse($expense, 'Depense enregistree', 201);
    }

    public function destroyExpense(Request $request, $id)
    {
        $expense = TyreContainerExpense::whereHas('container', fn ($q) => $q->where('tenant_id', $this->tenantId($request)))->find($id);
        if (!$expense) {
            return $this->sendError('Depense introuvable', [], 404);
        }
        $expense->delete();

        return $this->sendResponse([], 'Depense supprimee');
    }

    private function family(Request $request): string
    {
        return $request->input('family') === 'cosmetique' ? 'cosmetique' : 'pneus';
    }

    private function categoryId(string $family): ?int
    {
        return ProductCategory::where('name', 'like', $family === 'cosmetique' ? '%cosm%' : '%pneu%')->value('id');
    }

    private function purchase(TyreContainer $container, array $fields): SupplierPurchase
    {
        $count = SupplierPurchase::withTrashed()
            ->where('tenant_id', $container->tenant_id)
            ->whereYear('created_at', now()->format('Y'))
            ->count() + 1;

        return SupplierPurchase::create($fields + [
            'tenant_id' => $container->tenant_id,
            'supplier_id' => $container->supplier_id,
            'tyre_container_id' => $container->id,
            'purchase_number' => sprintf('ACH-%s-%03d', now()->format('Y'), $count),
            'category' => $container->family === 'cosmetique' ? 'COSMETIQUES' : 'PNEUS',
            'currency' => $container->currency,
            'exchange_rate' => $container->exchange_rate,
            'purchase_date' => $container->arrival_date,
            'reference' => $container->reference,
        ]);
    }
}
