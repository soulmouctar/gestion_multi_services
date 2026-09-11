<?php

namespace App\Http\Controllers\Api;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class ProductController extends BaseController
{
    private const SORTABLE_COLUMNS = [
        'created_at',
        'name',
        'sku',
        'selling_price',
        'stock_quantity',
        'status',
    ];

    private function tenantId(Request $request): ?int
    {
        $user = Auth::user();

        if ($user && $user->hasRole('SUPER_ADMIN')) {
            return $request->get('tenant_id') ?? $user->tenant_id;
        }

        return $user?->tenant_id ?? $request->get('tenant_id');
    }

    private function productQuery(Request $request)
    {
        $query = Product::query();
        $tenantId = $this->tenantId($request);

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        return $query;
    }

    private function sortBy(Request $request): string
    {
        $sortBy = $request->get('sort_by', 'created_at');

        return in_array($sortBy, self::SORTABLE_COLUMNS, true) ? $sortBy : 'created_at';
    }

    private function sortOrder(Request $request): string
    {
        return strtolower($request->get('sort_order', 'desc')) === 'asc' ? 'asc' : 'desc';
    }

    public function index(Request $request)
    {
        try {
            $user = Auth::user();
            $tenantId = $user->tenant_id ?? $request->get('tenant_id');
            
            if (!$tenantId && !$user->hasRole('SUPER_ADMIN')) {
                return $this->sendError('Tenant ID required', [], 400);
            }

            $query = Product::with('tenant', 'category', 'unit');
            
            // Filter by tenant for non-super-admin users
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }

            // Search functionality
            if ($request->has('search')) {
                $search = $request->get('search');
                $query->where(function($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%")
                      ->orWhere('sku', 'like', "%{$search}%");
                });
            }

            // Filter by category
            if ($request->has('category_id')) {
                $query->where('product_category_id', $request->get('category_id'));
            }

            // Filter by status
            if ($request->has('status')) {
                $query->where('status', $request->get('status'));
            }

            // Filter by stock level
            if ($request->boolean('low_stock')) {
                $query->whereRaw('stock_quantity <= low_stock_threshold');
            }

            // Sort options
            $query->orderBy($this->sortBy($request), $this->sortOrder($request));

            $perPage = $request->get('per_page', 15);
            
            // Check if pagination is requested
            if ($request->has('per_page') || $request->has('page')) {
                $products = $query->paginate($perPage);
                return $this->sendResponse($products, 'Products retrieved successfully');
            } else {
                // Return all products without pagination
                $products = $query->get();
                return $this->sendResponse($products, 'Products retrieved successfully');
            }
            
        } catch (\Exception $e) {
            \Log::error('Error retrieving products: ' . $e->getMessage());
            return $this->sendError('Error retrieving products', [], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $user = Auth::user();
            $tenantId = $user->tenant_id ?? $request->get('tenant_id');
            
            if (!$tenantId) {
                return $this->sendError('Tenant ID required', [], 400);
            }

            $validator = Validator::make($request->all(), [
                'name' => 'required|string|max:150',
                'description' => 'nullable|string|max:1000',
                'sku' => [
                    'nullable',
                    'string',
                    'max:50',
                    Rule::unique('products', 'sku')->where(fn ($query) => $query->where('tenant_id', $tenantId)),
                ],
                'product_category_id' => [
                    'nullable',
                    Rule::exists('product_categories', 'id')->where(fn ($query) => $query->where('tenant_id', $tenantId)),
                ],
                'unit_id' => [
                    'nullable',
                    Rule::exists('units', 'id')->where(fn ($query) => $query->where('tenant_id', $tenantId)),
                ],
                'purchase_price'        => 'nullable|numeric|min:0',
                'carton_purchase_price' => 'nullable|numeric|min:0',
                'selling_price'         => 'nullable|numeric|min:0',
                'carton_selling_price'  => 'nullable|numeric|min:0',
                'units_per_carton'      => 'nullable|integer|min:1',
                'stock_quantity' => 'nullable|integer|min:0',
                'low_stock_threshold' => 'nullable|integer|min:0',
                'status' => 'nullable|in:ACTIVE,INACTIVE,DISCONTINUED',
                'barcode' => 'nullable|string|max:100',
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            $productData = $request->only([
                'name',
                'description',
                'sku',
                'product_category_id',
                'unit_id',
                'purchase_price',
                'carton_purchase_price',
                'selling_price',
                'carton_selling_price',
                'units_per_carton',
                'stock_quantity',
                'low_stock_threshold',
                'status',
                'barcode',
            ]);
            $productData['tenant_id'] = $tenantId;
            $productData['status'] = $productData['status'] ?? 'ACTIVE';

            $product = Product::create($productData);

            return $this->sendResponse($product->load('category', 'unit'), 'Product created successfully', 201);
            
        } catch (\Exception $e) {
            \Log::error('Error creating product: ' . $e->getMessage());
            return $this->sendError('Error creating product', [], 500);
        }
    }

    public function show(Request $request, $id)
    {
        $product = $this->productQuery($request)
            ->with('tenant', 'category', 'unit')
            ->find($id);

        if (!$product) {
            return $this->sendError('Product not found', [], 404);
        }

        return $this->sendResponse($product, 'Product retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $product = $this->productQuery($request)->find($id);

        if (!$product) {
            return $this->sendError('Product not found', [], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:150',
            'description' => 'nullable|string|max:1000',
            'sku' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('products', 'sku')
                    ->ignore($product->id)
                    ->where(fn ($query) => $query->where('tenant_id', $product->tenant_id)),
            ],
            'product_category_id' => [
                'nullable',
                Rule::exists('product_categories', 'id')->where(fn ($query) => $query->where('tenant_id', $product->tenant_id)),
            ],
            'unit_id' => [
                'nullable',
                Rule::exists('units', 'id')->where(fn ($query) => $query->where('tenant_id', $product->tenant_id)),
            ],
            'purchase_price'        => 'nullable|numeric|min:0',
            'carton_purchase_price' => 'nullable|numeric|min:0',
            'selling_price'         => 'nullable|numeric|min:0',
            'carton_selling_price'  => 'nullable|numeric|min:0',
            'units_per_carton'      => 'nullable|integer|min:1',
            'stock_quantity' => 'nullable|integer|min:0',
            'low_stock_threshold' => 'nullable|integer|min:0',
            'status' => 'nullable|in:ACTIVE,INACTIVE,DISCONTINUED',
            'barcode' => 'nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $product->update($request->only([
            'name',
            'description',
            'sku',
            'product_category_id',
            'unit_id',
            'purchase_price',
            'carton_purchase_price',
            'selling_price',
            'carton_selling_price',
            'units_per_carton',
            'stock_quantity',
            'low_stock_threshold',
            'status',
            'barcode',
        ]));

        return $this->sendResponse($product->load('category', 'unit'), 'Product updated successfully');
    }

    public function destroy($id)
    {
        $user    = Auth::user();
        $product = Product::find($id);

        if (!$product) {
            return $this->sendError('Product not found');
        }

        if (!$user->hasRole('SUPER_ADMIN') && $product->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        // SoftDelete : on garde l'image (la restauration la conservera).
        // L'image sera nettoyée au forceDelete via le hook Product::booted().
        $product->delete();

        return $this->sendResponse([], 'Product moved to trash');
    }

    public function uploadImage(Request $request, $id)
    {
        $user    = Auth::user();
        $product = Product::find($id);

        if (!$product) {
            return $this->sendError('Product not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $product->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $validator = Validator::make($request->all(), [
            'image' => 'required|image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        if ($product->image) {
            $this->deleteUploadedFile($product->image);
        }

        $path = $this->storeUploadedFile($request->file('image'), 'products');
        $product->update(['image' => $path]);

        return $this->sendResponse($product->load('category', 'unit'), 'Image uploaded successfully');
    }

    public function removeImage($id)
    {
        $user    = Auth::user();
        $product = Product::find($id);

        if (!$product) {
            return $this->sendError('Product not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $product->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        if ($product->image) {
            $this->deleteUploadedFile($product->image);
            $product->update(['image' => null]);
        }

        return $this->sendResponse($product->load('category', 'unit'), 'Image removed successfully');
    }

    /**
     * Update product stock
     */
    public function updateStock(Request $request, $id)
    {
        try {
            $product = $this->productQuery($request)->find($id);
            
            if (!$product) {
                return $this->sendError('Product not found', [], 404);
            }

            $validator = Validator::make($request->all(), [
                'stock_quantity' => 'required|integer|min:0',
                'operation' => 'required|in:SET,ADD,SUBTRACT',
                'reason' => 'nullable|string|max:255'
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            $currentStock = $product->stock_quantity ?? 0;
            $newQuantity = $request->get('stock_quantity');
            
            switch ($request->get('operation')) {
                case 'SET':
                    $product->stock_quantity = $newQuantity;
                    break;
                case 'ADD':
                    $product->stock_quantity = $currentStock + $newQuantity;
                    break;
                case 'SUBTRACT':
                    if ($newQuantity > $currentStock) {
                        return $this->sendError('Stock insuffisant pour cette sortie.', [
                            'stock_quantity' => ['La quantité à retirer dépasse le stock disponible.'],
                        ], 422);
                    }
                    $product->stock_quantity = max(0, $currentStock - $newQuantity);
                    break;
            }

            $product->save();

            return $this->sendResponse($product->load('category', 'unit'), 'Stock updated successfully');
            
        } catch (\Exception $e) {
            \Log::error('Error updating product stock: ' . $e->getMessage());
            return $this->sendError('Error updating stock', [], 500);
        }
    }

    /**
     * Get products with low stock
     */
    public function getLowStockProducts(Request $request)
    {
        try {
            $tenantId = $this->tenantId($request);

            if (!$tenantId) {
                return $this->sendError('Tenant ID required', [], 400);
            }

            $query = Product::with('category', 'unit')
                ->whereRaw('stock_quantity <= low_stock_threshold')
                ->where('status', 'ACTIVE');
            
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }

            $products = $query->orderBy('stock_quantity', 'asc')->get();
            
            return $this->sendResponse($products, 'Low stock products retrieved successfully');
            
        } catch (\Exception $e) {
            \Log::error('Error retrieving low stock products: ' . $e->getMessage());
            return $this->sendError('Error retrieving low stock products', [], 500);
        }
    }

    /**
     * Search product by barcode
     */
    public function searchByBarcode(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'barcode' => 'required|string'
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            $user = Auth::user();
            $tenantId = $user->tenant_id ?? $request->get('tenant_id');
            
            $query = Product::with('category', 'unit')
                ->where('barcode', $request->get('barcode'));
            
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }

            $product = $query->first();
            
            if (!$product) {
                return $this->sendError('Product not found with this barcode', [], 404);
            }

            return $this->sendResponse($product, 'Product found successfully');
            
        } catch (\Exception $e) {
            \Log::error('Error searching product by barcode: ' . $e->getMessage());
            return $this->sendError('Error searching product', [], 500);
        }
    }

    /**
     * Get product statistics
     */
    public function getStatistics(Request $request)
    {
        try {
            $tenantId = $this->tenantId($request);

            if (!$tenantId) {
                return $this->sendError('Tenant ID required', [], 400);
            }

            // Build separate queries for each stat to avoid query state issues
            $baseQuery = function() use ($tenantId) {
                $q = Product::query();
                if ($tenantId) {
                    $q->where('tenant_id', $tenantId);
                }
                return $q;
            };

            $stats = [
                'total_products' => $baseQuery()->count(),
                'active_products' => $baseQuery()->where('status', 'ACTIVE')->count(),
                'inactive_products' => $baseQuery()->where('status', 'INACTIVE')->count(),
                'discontinued_products' => $baseQuery()->where('status', 'DISCONTINUED')->count(),
                'low_stock_products' => $baseQuery()->whereRaw('stock_quantity <= low_stock_threshold')->count(),
                'out_of_stock_products' => $baseQuery()->where('stock_quantity', 0)->count(),
                'total_stock_value' => $baseQuery()->selectRaw('SUM(stock_quantity * purchase_price) as total')->first()->total ?? 0,
                'categories_count' => $baseQuery()->distinct('product_category_id')->count('product_category_id')
            ];

            return $this->sendResponse($stats, 'Product statistics retrieved successfully');
            
        } catch (\Exception $e) {
            \Log::error('Error retrieving product statistics: ' . $e->getMessage());
            return $this->sendError('Error retrieving statistics', [], 500);
        }
    }

    public function bulkUpdateStatus(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'product_ids' => 'required|array',
                'product_ids.*' => 'integer',
                'status' => 'required|in:ACTIVE,INACTIVE'
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            $user = Auth::user();
            $tenantId = $user->tenant_id ?? $request->get('tenant_id');

            if (!$tenantId && !$user->hasRole('SUPER_ADMIN')) {
                return $this->sendError('Tenant ID required', [], 400);
            }

            $query = Product::whereIn('id', $request->product_ids);
            
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }

            $updatedCount = $query->update(['status' => $request->status]);

            return $this->sendResponse([
                'updated_count' => $updatedCount,
                'status' => $request->status
            ], 'Products status updated successfully');

        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }

    public function bulkDelete(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'product_ids' => 'required|array',
                'product_ids.*' => 'integer',
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            $tenantId = $this->tenantId($request);

            if (!$tenantId) {
                return $this->sendError('Tenant ID required', [], 400);
            }

            $deletedCount = Product::whereIn('id', $request->product_ids)
                ->where('tenant_id', $tenantId)
                ->delete();

            return $this->sendResponse([
                'deleted_count' => $deletedCount,
            ], 'Products moved to trash successfully');
        } catch (\Exception $e) {
            \Log::error('Error bulk deleting products: ' . $e->getMessage());
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }

    public function export(Request $request)
    {
        try {
            $user = Auth::user();
            $tenantId = $user->tenant_id ?? $request->get('tenant_id');
            
            if (!$tenantId && !$user->hasRole('SUPER_ADMIN')) {
                return $this->sendError('Tenant ID required', [], 400);
            }

            $validator = Validator::make($request->all(), [
                'format' => 'required|in:csv,excel,pdf',
                'category_id' => 'nullable|exists:product_categories,id',
                'status' => 'nullable|in:ACTIVE,INACTIVE,DISCONTINUED',
                'low_stock' => 'nullable|boolean',
                'sort_by' => 'nullable|string',
                'sort_order' => 'nullable|in:asc,desc'
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            $query = Product::with('tenant', 'category', 'unit');
            
            // Filter by tenant for non-super-admin users
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }

            // Apply filters
            if ($request->has('category_id')) {
                $query->where('product_category_id', $request->get('category_id'));
            }

            if ($request->has('status')) {
                $query->where('status', $request->get('status'));
            }

            if ($request->has('low_stock') && $request->get('low_stock')) {
                $query->whereRaw('stock_quantity <= low_stock_threshold');
            }

            // Sort options
            $query->orderBy($this->sortBy($request), $this->sortOrder($request));

            $products = $query->get();

            $format = $request->get('format', 'csv');
            
            switch ($format) {
                case 'csv':
                    return $this->exportCSV($products);
                case 'excel':
                    return $this->exportExcel($products);
                case 'pdf':
                    return $this->exportPDF($products);
                default:
                    return $this->sendError('Unsupported format', [], 400);
            }

        } catch (\Exception $e) {
            \Log::error('Error exporting products: ' . $e->getMessage());
            return $this->sendError('Error exporting products', [], 500);
        }
    }

    private function exportCSV($products)
    {
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="products_export_' . date('Y-m-d') . '.csv"'
        ];

        $callback = function() use ($products) {
            $file = fopen('php://output', 'w');
            
            // CSV Header
            fputcsv($file, [
                'ID',
                'Name',
                'Description',
                'SKU',
                'Category',
                'Unit',
                'Purchase Price',
                'Selling Price',
                'Stock Quantity',
                'Low Stock Threshold',
                'Status',
                'Barcode',
                'Created At'
            ]);

            // CSV Data
            foreach ($products as $product) {
                fputcsv($file, [
                    $product->id,
                    $product->name,
                    $product->description,
                    $product->sku,
                    $product->category ? $product->category->name : '',
                    $product->unit ? $product->unit->name : '',
                    $product->purchase_price,
                    $product->selling_price,
                    $product->stock_quantity,
                    $product->low_stock_threshold,
                    $product->status,
                    $product->barcode,
                    $product->created_at
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    private function exportExcel($products)
    {
        // For now, return CSV format for Excel export as well
        // You can implement proper Excel export using Laravel Excel package
        return $this->exportCSV($products);
    }

    private function exportPDF($products)
    {
        // For now, return error for PDF export
        // You can implement PDF export using DOMPDF or similar package
        return $this->sendError('PDF export not implemented yet', [], 501);
    }

    public function salesHistory(Request $request, $id)
    {
        try {
            $product = $this->productQuery($request)->find($id);
            
            if (!$product) {
                return $this->sendError('Product not found', [], 404);
            }

            // Get sales history from invoice_items table
            $salesHistory = \DB::table('invoice_items')
                ->join('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')
                ->leftJoin('clients', 'invoices.client_id', '=', 'clients.id')
                ->where('invoice_items.product_id', $id)
                ->select([
                    'invoices.invoice_date as date',
                    'invoices.invoice_number',
                    'clients.name as client_name',
                    'invoice_items.quantity',
                    'invoice_items.unit_price',
                    \DB::raw('invoice_items.quantity * invoice_items.unit_price as total')
                ])
                ->orderBy('invoices.invoice_date', 'desc')
                ->limit(100)
                ->get();

            return $this->sendResponse($salesHistory, 'Sales history retrieved successfully');
            
        } catch (\Exception $e) {
            \Log::error('Error retrieving sales history: ' . $e->getMessage());
            // Return empty array if table doesn't exist or other error
            return $this->sendResponse([], 'Sales history retrieved successfully');
        }
    }
}
