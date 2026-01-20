<?php

namespace App\Http\Controllers\Api;

use App\Models\ProductCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ProductCategoryController extends BaseController
{
    public function index()
    {
        $categories = ProductCategory::paginate(15);
        return $this->sendResponse($categories, 'Product categories retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $category = ProductCategory::create($request->all());

        return $this->sendResponse($category, 'Product category created successfully', 201);
    }

    public function show($id)
    {
        $category = ProductCategory::with('products')->find($id);

        if (!$category) {
            return $this->sendError('Product category not found');
        }

        return $this->sendResponse($category, 'Product category retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $category = ProductCategory::find($id);

        if (!$category) {
            return $this->sendError('Product category not found');
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:100',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $category->update($request->all());

        return $this->sendResponse($category, 'Product category updated successfully');
    }

    public function destroy($id)
    {
        $category = ProductCategory::find($id);

        if (!$category) {
            return $this->sendError('Product category not found');
        }

        $category->delete();

        return $this->sendResponse([], 'Product category deleted successfully');
    }
}
