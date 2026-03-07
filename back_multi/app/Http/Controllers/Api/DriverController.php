<?php

namespace App\Http\Controllers\Api;

use App\Models\Driver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class DriverController extends BaseController
{
    public function index(Request $request)
    {
        $query = Driver::with('tenant', 'taxiAssignments');

        if ($request->has('tenant_id')) {
            $query->where('tenant_id', $request->tenant_id);
        }

        $drivers = $query->paginate(15);
        return $this->sendResponse($drivers, 'Drivers retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tenant_id' => 'required|exists:tenants,id',
            'name' => 'required|string|max:150',
            'phone' => 'nullable|string|max:50',
            'contract_end' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $driver = Driver::create($request->all());

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
            'tenant_id' => 'sometimes|exists:tenants,id',
            'name' => 'sometimes|string|max:150',
            'phone' => 'nullable|string|max:50',
            'contract_end' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $driver->update($request->all());

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
        $tenantId = $request->get('tenant_id', 1);

        $totalDrivers = Driver::where('tenant_id', $tenantId)->count();
        $activeDrivers = Driver::where('tenant_id', $tenantId)->where('status', 'ACTIVE')->count();
        $inactiveDrivers = Driver::where('tenant_id', $tenantId)->where('status', 'INACTIVE')->count();
        $suspendedDrivers = Driver::where('tenant_id', $tenantId)->where('status', 'SUSPENDED')->count();

        // Drivers with active assignments
        $driversWithAssignments = Driver::where('tenant_id', $tenantId)
            ->whereHas('taxiAssignments', function ($q) {
                $q->whereNull('end_date')->orWhere('end_date', '>=', now());
            })
            ->count();

        return $this->sendResponse([
            'total_drivers' => $totalDrivers,
            'active_drivers' => $activeDrivers,
            'inactive_drivers' => $inactiveDrivers,
            'suspended_drivers' => $suspendedDrivers,
            'drivers_with_assignments' => $driversWithAssignments,
        ], 'Driver statistics retrieved successfully');
    }
}
