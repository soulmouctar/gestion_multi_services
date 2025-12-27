<?php

namespace App\Http\Controllers\Api;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ProductController extends BaseController
{
    public function index(Request $request)
    {
        $query = Product::with('tenant', 'category', 'unit');

        if ($request->has('tenant_id')) {
            $query->where('tenant_id', $request->tenant_id);
        }

        $products = $query->paginate(15);
        return $this->sendResponse($products, 'Products retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tenant_id' => 'required|exists:tenants,id',
            'name' => 'required|string|max:150',
            'product_category_id' => 'nullable|exists:product_categories,id',
            'unit_id' => 'nullable|exists:units,id',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $product = Product::create($request->all());

        return $this->sendResponse($product->load('category', 'unit'), 'Product created successfully', 201);
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
            'tenant_id' => 'sometimes|exists:tenants,id',
            'name' => 'sometimes|string|max:150',
            'product_category_id' => 'nullable|exists:product_categories,id',
            'unit_id' => 'nullable|exists:units,id',
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
}
