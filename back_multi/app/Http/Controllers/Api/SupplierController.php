<?php

namespace App\Http\Controllers\Api;

use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SupplierController extends BaseController
{
    public function index(Request $request)
    {
        $query = Supplier::with('tenant');

        if ($request->has('tenant_id')) {
            $query->where('tenant_id', $request->tenant_id);
        }

        $suppliers = $query->paginate(15);
        return $this->sendResponse($suppliers, 'Suppliers retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tenant_id' => 'required|exists:tenants,id',
            'name' => 'required|string|max:150',
            'currency' => 'nullable|string|max:10',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $supplier = Supplier::create($request->all());

        return $this->sendResponse($supplier, 'Supplier created successfully', 201);
    }

    public function show($id)
    {
        $supplier = Supplier::with('tenant')->find($id);

        if (!$supplier) {
            return $this->sendError('Supplier not found');
        }

        return $this->sendResponse($supplier, 'Supplier retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $supplier = Supplier::find($id);

        if (!$supplier) {
            return $this->sendError('Supplier not found');
        }

        $validator = Validator::make($request->all(), [
            'tenant_id' => 'sometimes|exists:tenants,id',
            'name' => 'sometimes|string|max:150',
            'currency' => 'nullable|string|max:10',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $supplier->update($request->all());

        return $this->sendResponse($supplier, 'Supplier updated successfully');
    }

    public function destroy($id)
    {
        $supplier = Supplier::find($id);

        if (!$supplier) {
            return $this->sendError('Supplier not found');
        }

        $supplier->delete();

        return $this->sendResponse([], 'Supplier deleted successfully');
    }
}
