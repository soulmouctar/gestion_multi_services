<?php

namespace App\Http\Controllers\Api;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;

class ProductController extends BaseController
{
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
            if ($request->has('low_stock')) {
                $query->whereRaw('stock_quantity <= low_stock_threshold');
            }

            // Sort options
            $sortBy = $request->get('sort_by', 'created_at');
            $sortOrder = $request->get('sort_order', 'desc');
            $query->orderBy($sortBy, $sortOrder);

            $perPage = $request->get('per_page', 15);
            $products = $query->paginate($perPage);
            
            return $this->sendResponse($products, 'Products retrieved successfully');
            
        } catch (\Exception $e) {
            \Log::error('Error retrieving products: ' . $e->getMessage());
            return $this->sendError('Error retrieving products', [], 500);
        }
    }

    public function publicIndex(Request $request)
    {
        try {
            // Use fixed tenant_id for public testing
            $tenantId = $request->get('tenant_id', 1);
            
            $query = Product::with('tenant', 'category', 'unit');
            
            // Filter by tenant
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
            if ($request->has('low_stock')) {
                $lowStock = $request->get('low_stock');
                if ($lowStock === 'true' || $lowStock === true || $lowStock === '1') {
                    $query->whereRaw('stock_quantity <= low_stock_threshold');
                }
                // If low_stock is false, we don't apply any filter (show all products)
            }

            // Sorting
            $sortBy = $request->get('sort_by', 'created_at');
            $sortOrder = $request->get('sort_order', 'desc');
            $query->orderBy($sortBy, $sortOrder);

            // Pagination
            $perPage = $request->get('per_page', 15);
            $products = $query->paginate($perPage);

            return $this->sendResponse($products, 'Products retrieved successfully');
        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $user = Auth::user();
            $tenantId = $user->tenant_id ?? $request->get('tenant_id');
            
            if (!$tenantId && !$user->hasRole('SUPER_ADMIN')) {
                return $this->sendError('Tenant ID required', [], 400);
            }

            $validator = Validator::make($request->all(), [
                'name' => 'required|string|max:150',
                'description' => 'nullable|string|max:1000',
                'sku' => 'nullable|string|max:50|unique:products,sku',
                'product_category_id' => 'nullable|exists:product_categories,id',
                'unit_id' => 'nullable|exists:units,id',
                'purchase_price' => 'nullable|numeric|min:0',
                'selling_price' => 'nullable|numeric|min:0',
                'stock_quantity' => 'nullable|integer|min:0',
                'low_stock_threshold' => 'nullable|integer|min:0',
                'status' => 'nullable|in:ACTIVE,INACTIVE,DISCONTINUED',
                'barcode' => 'nullable|string|max:100',
                'weight' => 'nullable|numeric|min:0',
                'dimensions' => 'nullable|string|max:100',
                'supplier_info' => 'nullable|string|max:500',
                'notes' => 'nullable|string|max:1000'
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            $productData = $request->all();
            $productData['tenant_id'] = $tenantId;
            $productData['status'] = $productData['status'] ?? 'ACTIVE';

            $product = Product::create($productData);

            return $this->sendResponse($product->load('category', 'unit'), 'Product created successfully', 201);
            
        } catch (\Exception $e) {
            \Log::error('Error creating product: ' . $e->getMessage());
            return $this->sendError('Error creating product', [], 500);
        }
    }

    public function show($id)
    {
        $product = Product::with('tenant', 'category', 'unit')->find($id);

        if (!$product) {
            return $this->sendError('Product not found');
        }

        return $this->sendResponse($product, 'Product retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $product = Product::find($id);

        if (!$product) {
            return $this->sendError('Product not found');
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:150',
            'description' => 'nullable|string|max:1000',
            'sku' => 'nullable|string|max:50|unique:products,sku,' . $id,
            'product_category_id' => 'nullable|exists:product_categories,id',
            'unit_id' => 'nullable|exists:units,id',
            'purchase_price' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
            'stock_quantity' => 'nullable|integer|min:0',
            'low_stock_threshold' => 'nullable|integer|min:0',
            'status' => 'nullable|in:ACTIVE,INACTIVE,DISCONTINUED',
            'barcode' => 'nullable|string|max:100',
            'weight' => 'nullable|numeric|min:0',
            'dimensions' => 'nullable|string|max:100',
            'supplier_info' => 'nullable|string|max:500',
            'notes' => 'nullable|string|max:1000'
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $product->update($request->all());

        return $this->sendResponse($product->load('category', 'unit'), 'Product updated successfully');
    }

    public function destroy($id)
    {
        $product = Product::find($id);

        if (!$product) {
            return $this->sendError('Product not found');
        }

        $product->delete();

        return $this->sendResponse([], 'Product deleted successfully');
    }

    /**
     * Update product stock
     */
    public function updateStock(Request $request, $id)
    {
        try {
            $product = Product::find($id);
            
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
            $user = Auth::user();
            $tenantId = $request->get('tenant_id');
            
            // For authenticated users, use their tenant_id if not provided
            if ($user) {
                $tenantId = $tenantId ?? $user->tenant_id;
                if (!$tenantId && !$user->hasRole('SUPER_ADMIN')) {
                    return $this->sendError('Tenant ID required', [], 400);
                }
            } else {
                // For public routes, tenant_id defaults to 1
                $tenantId = $tenantId ?? 1;
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
            $user = Auth::user();
            $tenantId = $request->get('tenant_id');
            
            // For authenticated users, use their tenant_id if not provided
            if ($user) {
                $tenantId = $tenantId ?? $user->tenant_id;
                if (!$tenantId && !$user->hasRole('SUPER_ADMIN')) {
                    return $this->sendError('Tenant ID required', [], 400);
                }
            } else {
                // For public routes, tenant_id defaults to 1
                $tenantId = $tenantId ?? 1;
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
                'product_ids.*' => 'exists:products,id',
                'status' => 'required|in:ACTIVE,INACTIVE'
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            $user = Auth::user();
            $tenantId = $user->tenant_id ?? $request->get('tenant_id');

            $query = Product::whereIn('id', $request->product_ids);
            
            if ($tenantId && !$user->hasRole('SUPER_ADMIN')) {
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

    public function publicBulkUpdateStatus(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'product_ids' => 'required|array',
                'product_ids.*' => 'exists:products,id',
                'status' => 'required|in:ACTIVE,INACTIVE'
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            // Use fixed tenant_id for public testing
            $tenantId = $request->get('tenant_id', 1);

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

    public function publicStore(Request $request)
    {
        try {
            $tenantId = $request->get('tenant_id', 1);

            $validator = Validator::make($request->all(), [
                'name' => 'required|string|max:150',
                'description' => 'nullable|string|max:1000',
                'sku' => 'nullable|string|max:50|unique:products,sku',
                'product_category_id' => 'nullable|exists:product_categories,id',
                'unit_id' => 'nullable|exists:units,id',
                'purchase_price' => 'nullable|numeric|min:0',
                'selling_price' => 'nullable|numeric|min:0',
                'stock_quantity' => 'nullable|integer|min:0',
                'low_stock_threshold' => 'nullable|integer|min:0',
                'status' => 'nullable|in:ACTIVE,INACTIVE,DISCONTINUED',
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            $productData = $request->all();
            $productData['tenant_id'] = $tenantId;
            $productData['status'] = $productData['status'] ?? 'ACTIVE';

            $product = Product::create($productData);

            return $this->sendResponse($product->load('category', 'unit'), 'Product created successfully', 201);
            
        } catch (\Exception $e) {
            \Log::error('Error creating product: ' . $e->getMessage());
            return $this->sendError('Error creating product', ['error' => $e->getMessage()], 500);
        }
    }

    public function publicUpdate(Request $request, $id)
    {
        $product = Product::find($id);

        if (!$product) {
            return $this->sendError('Product not found', [], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:150',
            'description' => 'nullable|string|max:1000',
            'sku' => 'nullable|string|max:50|unique:products,sku,' . $id,
            'product_category_id' => 'nullable|exists:product_categories,id',
            'unit_id' => 'nullable|exists:units,id',
            'purchase_price' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
            'stock_quantity' => 'nullable|integer|min:0',
            'low_stock_threshold' => 'nullable|integer|min:0',
            'status' => 'nullable|in:ACTIVE,INACTIVE,DISCONTINUED',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $product->update($request->all());

        return $this->sendResponse($product->load('category', 'unit'), 'Product updated successfully');
    }

    public function publicDestroy($id)
    {
        $product = Product::find($id);

        if (!$product) {
            return $this->sendError('Product not found', [], 404);
        }

        $product->delete();

        return $this->sendResponse([], 'Product deleted successfully');
    }

    public function publicUpdateStock(Request $request, $id)
    {
        try {
            $product = Product::find($id);
            
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

    public function publicSalesHistory($id)
    {
        try {
            $product = Product::find($id);
            
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
