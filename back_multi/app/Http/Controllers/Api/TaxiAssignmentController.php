<?php

namespace App\Http\Controllers\Api;

use App\Models\TaxiAssignment;
use App\Models\Driver;
use App\Models\Taxi;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TaxiAssignmentController extends BaseController
{
    private function tenantId(Request $request): ?int
    {
        $user = auth()->user();
        return $user->hasRole('SUPER_ADMIN') ? $request->get('tenant_id') : $user->tenant_id;
    }

    private function assignmentQuery(?int $tenantId)
    {
        $query = TaxiAssignment::query();

        if ($tenantId) {
            $query->whereHas('taxi', fn($q) => $q->where('tenant_id', $tenantId));
        }

        return $query;
    }

    private function validateTenantResources(int $tenantId, int $taxiId, int $driverId): ?array
    {
        $taxi = Taxi::where('tenant_id', $tenantId)->find($taxiId);
        if (!$taxi) {
            return ['Taxi introuvable pour ce tenant.', [], 422];
        }

        $driver = Driver::where('tenant_id', $tenantId)->find($driverId);
        if (!$driver) {
            return ['Conducteur introuvable pour ce tenant.', [], 422];
        }

        if ($taxi->status !== 'ACTIVE') {
            return ['Ce taxi doit être actif avant affectation.', [], 422];
        }

        if ($driver->status !== 'ACTIVE') {
            return ['Ce conducteur doit être actif avant affectation.', [], 422];
        }

        return null;
    }

    private function hasOverlappingAssignment(int $taxiId, int $driverId, string $startDate, ?string $endDate = null, ?int $exceptId = null): bool
    {
        $end = $endDate ?: '9999-12-31';

        return TaxiAssignment::query()
            ->when($exceptId, fn($q) => $q->where('id', '!=', $exceptId))
            ->where(function ($q) use ($taxiId, $driverId) {
                $q->where('taxi_id', $taxiId)
                  ->orWhere('driver_id', $driverId);
            })
            ->where('start_date', '<=', $end)
            ->where(function ($q) use ($startDate) {
                $q->whereNull('end_date')
                  ->orWhere('end_date', '>=', $startDate);
            })
            ->exists();
    }

    public function index(Request $request)
    {
        $tenantId = $this->tenantId($request);

        $query = $this->assignmentQuery($tenantId)->with('taxi', 'driver');

        if ($request->has('taxi_id')) {
            $query->where('taxi_id', $request->taxi_id);
        }

        if ($request->has('driver_id')) {
            $query->where('driver_id', $request->driver_id);
        }

        $assignments = $query->paginate(15);
        return $this->sendResponse($assignments, 'Taxi assignments retrieved successfully');
    }

    public function store(Request $request)
    {
        $tenantId = $this->tenantId($request);

        if (!$tenantId) {
            return $this->sendError('Tenant ID requis.', [], 422);
        }

        $validator = Validator::make($request->all(), [
            'taxi_id'    => 'required|exists:taxis,id',
            'driver_id'  => 'required|exists:drivers,id',
            'start_date' => 'required|date',
            'end_date'   => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $resourceError = $this->validateTenantResources($tenantId, (int) $request->taxi_id, (int) $request->driver_id);
        if ($resourceError) {
            return $this->sendError(...$resourceError);
        }

        if ($this->hasOverlappingAssignment((int) $request->taxi_id, (int) $request->driver_id, $request->start_date, $request->end_date)) {
            return $this->sendError('Une affectation active existe déjà pour ce taxi ou ce conducteur sur cette période.', [], 422);
        }

        $assignment = TaxiAssignment::create($request->only(['taxi_id', 'driver_id', 'start_date', 'end_date']));

        return $this->sendResponse($assignment->load('taxi', 'driver'), 'Taxi assignment created successfully', 201);
    }

    public function show(Request $request, $id)
    {
        $tenantId  = $this->tenantId($request);
        $assignment = $this->assignmentQuery($tenantId)
            ->with('taxi', 'driver')
            ->find($id);

        if (!$assignment) {
            return $this->sendError('Taxi assignment not found');
        }

        return $this->sendResponse($assignment, 'Taxi assignment retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $tenantId  = $this->tenantId($request);
        $assignment = $this->assignmentQuery($tenantId)->find($id);

        if (!$assignment) {
            return $this->sendError('Taxi assignment not found');
        }

        $validator = Validator::make($request->all(), [
            'taxi_id'    => 'sometimes|exists:taxis,id',
            'driver_id'  => 'sometimes|exists:drivers,id',
            'start_date' => 'sometimes|date',
            'end_date'   => 'nullable|date|after_or_equal:start_date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $taxiId = (int) $request->get('taxi_id', $assignment->taxi_id);
        $driverId = (int) $request->get('driver_id', $assignment->driver_id);
        $startDate = $request->get('start_date', $assignment->start_date->format('Y-m-d'));
        $endDate = $request->has('end_date') ? $request->get('end_date') : optional($assignment->end_date)->format('Y-m-d');

        if ($endDate && $endDate < $startDate) {
            return $this->sendError('La date de fin doit être supérieure ou égale à la date de début.', [], 422);
        }

        if ($tenantId) {
            $resourceError = $this->validateTenantResources($tenantId, $taxiId, $driverId);
            if ($resourceError) {
                return $this->sendError(...$resourceError);
            }
        }

        if ($this->hasOverlappingAssignment($taxiId, $driverId, $startDate, $endDate, (int) $assignment->id)) {
            return $this->sendError('Une affectation active existe déjà pour ce taxi ou ce conducteur sur cette période.', [], 422);
        }

        $assignment->update($request->only(['taxi_id', 'driver_id', 'start_date', 'end_date']));

        return $this->sendResponse($assignment->load('taxi', 'driver'), 'Taxi assignment updated successfully');
    }

    public function destroy(Request $request, $id)
    {
        $tenantId  = $this->tenantId($request);
        $assignment = $this->assignmentQuery($tenantId)->find($id);

        if (!$assignment) {
            return $this->sendError('Taxi assignment not found');
        }

        $assignment->delete();

        return $this->sendResponse([], 'Taxi assignment deleted successfully');
    }
}
