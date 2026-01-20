<?php

namespace App\Http\Controllers\Api;

use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TenantController extends BaseController
{
    public function index()
    {
        $tenants = Tenant::with('modules', 'subscriptions')->paginate(15);
        return $this->sendResponse($tenants, 'Tenants retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:150',
            'email' => 'nullable|email|max:150',
            'phone' => 'nullable|string|max:50',
            'subscription_status' => 'nullable|in:ACTIVE,SUSPENDED',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $tenant = Tenant::create($request->all());

        return $this->sendResponse($tenant, 'Tenant created successfully', 201);
    }

    public function show($id)
    {
        $tenant = Tenant::with('modules', 'subscriptions', 'users')->find($id);

        if (!$tenant) {
            return $this->sendError('Tenant not found');
        }

        return $this->sendResponse($tenant, 'Tenant retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $tenant = Tenant::find($id);

        if (!$tenant) {
            return $this->sendError('Tenant not found');
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:150',
            'email' => 'nullable|email|max:150',
            'phone' => 'nullable|string|max:50',
            'subscription_status' => 'nullable|in:ACTIVE,SUSPENDED',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $tenant->update($request->all());

        return $this->sendResponse($tenant, 'Tenant updated successfully');
    }

    public function destroy($id)
    {
        $tenant = Tenant::find($id);

        if (!$tenant) {
            return $this->sendError('Tenant not found');
        }

        $tenant->delete();

        return $this->sendResponse([], 'Tenant deleted successfully');
    }

    public function assignModule(Request $request, $id)
    {
        $tenant = Tenant::find($id);

        if (!$tenant) {
            return $this->sendError('Tenant not found');
        }

        $validator = Validator::make($request->all(), [
            'module_id' => 'required|exists:modules,id',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $tenant->modules()->syncWithoutDetaching([
            $request->module_id => ['is_active' => $request->get('is_active', true)]
        ]);

        return $this->sendResponse($tenant->load('modules'), 'Module assigned successfully');
    }

    public function removeModule(Request $request, $id)
    {
        $tenant = Tenant::find($id);

        if (!$tenant) {
            return $this->sendError('Tenant not found');
        }

        $validator = Validator::make($request->all(), [
            'module_id' => 'required|exists:modules,id',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $tenant->modules()->detach($request->module_id);

        return $this->sendResponse($tenant->load('modules'), 'Module removed successfully');
    }
}
