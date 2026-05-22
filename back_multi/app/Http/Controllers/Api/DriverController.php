<?php

namespace App\Http\Controllers\Api;

use App\Models\Driver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class DriverController extends BaseController
{
    public function index(Request $request)
    {
        $user     = auth()->user();
        $tenantId = $user->hasRole('SUPER_ADMIN')
            ? $request->get('tenant_id')
            : $user->tenant_id;

        $query = Driver::with('tenant', 'taxiAssignments');

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        $drivers = $query->paginate(15);
        return $this->sendResponse($drivers, 'Drivers retrieved successfully');
    }

    public function store(Request $request)
    {
        $user     = auth()->user();
        $tenantId = $user->hasRole('SUPER_ADMIN')
            ? $request->get('tenant_id')
            : $user->tenant_id;

        if (!$tenantId) {
            return $this->sendError('Tenant ID requis.', [], 422);
        }

        $validator = Validator::make($request->all(), [
            'name'         => 'required|string|max:150',
            'phone'        => 'nullable|string|max:50',
            'contract_end' => 'nullable|date',
            'status'       => 'nullable|in:ACTIVE,INACTIVE,SUSPENDED',
            'daily_rate'   => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $driver = Driver::create([
            'tenant_id'    => $tenantId,
            'name'         => $request->name,
            'phone'        => $request->phone,
            'contract_end' => $request->contract_end,
            'status'       => $request->get('status', 'ACTIVE'),
            'daily_rate'   => $request->get('daily_rate', 0),
        ]);

        return $this->sendResponse($driver, 'Driver created successfully', 201);
    }

    public function show($id)
    {
        $driver = Driver::with('tenant', 'taxiAssignments.taxi')->find($id);

        if (!$driver) {
            return $this->sendError('Driver not found');
        }

        return $this->sendResponse($driver, 'Driver retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $driver = Driver::find($id);

        if (!$driver) {
            return $this->sendError('Driver not found');
        }

        $validator = Validator::make($request->all(), [
            'name'         => 'sometimes|string|max:150',
            'phone'        => 'nullable|string|max:50',
            'contract_end' => 'nullable|date',
            'status'       => 'nullable|in:ACTIVE,INACTIVE,SUSPENDED',
            'daily_rate'   => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $driver->update($request->only(['name', 'phone', 'contract_end', 'status', 'daily_rate']));

        return $this->sendResponse($driver, 'Driver updated successfully');
    }

    public function destroy($id)
    {
        $driver = Driver::find($id);

        if (!$driver) {
            return $this->sendError('Driver not found');
        }

        $driver->delete();
        return $this->sendResponse([], 'Driver deleted successfully');
    }

    public function toggleStatus($id)
    {
        $driver = Driver::find($id);

        if (!$driver) {
            return $this->sendError('Driver not found');
        }

        $newStatus = $driver->status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        $driver->update(['status' => $newStatus]);

        return $this->sendResponse($driver, 'Driver status updated successfully');
    }

    public function suspend($id)
    {
        $driver = Driver::find($id);

        if (!$driver) {
            return $this->sendError('Driver not found');
        }

        $driver->update(['status' => 'SUSPENDED']);
        return $this->sendResponse($driver, 'Driver suspended successfully');
    }

    public function activate($id)
    {
        $driver = Driver::find($id);

        if (!$driver) {
            return $this->sendError('Driver not found');
        }

        $driver->update(['status' => 'ACTIVE']);
        return $this->sendResponse($driver, 'Driver activated successfully');
    }

    public function statistics(Request $request)
    {
        $user     = auth()->user();
        $tenantId = $user->hasRole('SUPER_ADMIN')
            ? $request->get('tenant_id', null)
            : $user->tenant_id;

        $query = Driver::query();
        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        $totalDrivers     = (clone $query)->count();
        $activeDrivers    = (clone $query)->where('status', 'ACTIVE')->count();
        $inactiveDrivers  = (clone $query)->where('status', 'INACTIVE')->count();
        $suspendedDrivers = (clone $query)->where('status', 'SUSPENDED')->count();

        $driversWithAssignments = (clone $query)->whereHas('taxiAssignments', function ($q) {
            $q->whereNull('end_date')->orWhere('end_date', '>=', now());
        })->count();

        return $this->sendResponse([
            'total_drivers'             => $totalDrivers,
            'active_drivers'            => $activeDrivers,
            'inactive_drivers'          => $inactiveDrivers,
            'suspended_drivers'         => $suspendedDrivers,
            'drivers_with_assignments'  => $driversWithAssignments,
        ], 'Driver statistics retrieved successfully');
    }
}
