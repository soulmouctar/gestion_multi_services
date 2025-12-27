<?php

namespace App\Http\Controllers\Api;

use App\Models\Container;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ContainerController extends BaseController
{
    public function index(Request $request)
    {
        $query = Container::with('tenant', 'photos');

        if ($request->has('tenant_id')) {
            $query->where('tenant_id', $request->tenant_id);
        }

        $containers = $query->paginate(15);
        return $this->sendResponse($containers, 'Containers retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tenant_id' => 'required|exists:tenants,id',
            'container_number' => 'required|string|max:50',
            'capacity_min' => 'nullable|integer|min:0',
            'capacity_max' => 'nullable|integer|min:0',
            'interest_rate' => 'nullable|numeric|min:0|max:100',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $container = Container::create($request->all());

        return $this->sendResponse($container, 'Container created successfully', 201);
    }

    public function show($id)
    {
        $container = Container::with('tenant', 'photos')->find($id);

        if (!$container) {
            return $this->sendError('Container not found');
        }

        return $this->sendResponse($container, 'Container retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $container = Container::find($id);

        if (!$container) {
            return $this->sendError('Container not found');
        }

        $validator = Validator::make($request->all(), [
            'tenant_id' => 'sometimes|exists:tenants,id',
            'container_number' => 'sometimes|string|max:50',
            'capacity_min' => 'nullable|integer|min:0',
            'capacity_max' => 'nullable|integer|min:0',
            'interest_rate' => 'nullable|numeric|min:0|max:100',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $container->update($request->all());

        return $this->sendResponse($container, 'Container updated successfully');
    }

    public function destroy($id)
    {
        $container = Container::find($id);

        if (!$container) {
            return $this->sendError('Container not found');
        }

        $container->delete();

        return $this->sendResponse([], 'Container deleted successfully');
    }
}
