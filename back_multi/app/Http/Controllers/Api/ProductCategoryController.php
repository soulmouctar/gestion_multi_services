<?php

namespace App\Http\Controllers\Api;

use App\Models\ProductCategory;
use App\Http\Requests\StoreProductCategoryRequest;
use Illuminate\Http\Request;

class ProductCategoryController extends BaseController
{
    public function index()
    {
        $categories = ProductCategory::paginate(15);
        return $this->sendResponse($categories, 'Product categories retrieved successfully');
    }

    public function store(StoreProductCategoryRequest $request)
    {
        $category = ProductCategory::create($request->only(['name']));

        return $this->sendResponse($category, 'Product category created successfully', 201);
    }

    public function show($id)
    {
        $category = ProductCategory::with('products')->find($id);

        if (!$category) {
            return $this->sendError('Product category not found', [], 404);
        }

        return $this->sendResponse($category, 'Product category retrieved successfully');
    }

    public function update(StoreProductCategoryRequest $request, $id)
    {
        $category = ProductCategory::find($id);

        if (!$category) {
            return $this->sendError('Product category not found', [], 404);
        }

        $category->update($request->only(['name']));

        return $this->sendResponse($category, 'Product category updated successfully');
    }

    public function destroy($id)
    {
        $category = ProductCategory::find($id);

        if (!$category) {
            return $this->sendError('Product category not found', [], 404);
        }

        $category->delete();

        return $this->sendResponse([], 'Product category deleted successfully');
    }
}
