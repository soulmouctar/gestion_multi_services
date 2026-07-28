<?php

namespace App\Http\Controllers\Api;

use App\Models\Floor;
use App\Models\Building;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class FloorController extends BaseController
{
    private function tenantId(Request $request): ?int
    {
        $user = Auth::user();
        return $user->hasRole('SUPER_ADMIN') ? $request->get('tenant_id') : $user->tenant_id;
    }

    private function floorQuery(Request $request)
    {
        $tenantId = $this->tenantId($request);
        $query = Floor::query();

        if ($tenantId) {
            $query->whereHas('building.location', fn($q) => $q->where('tenant_id', $tenantId));
        }

        return $query;
    }

    private function buildingBelongsToTenant(int $buildingId, ?int $tenantId): bool
    {
        $query = Building::whereKey($buildingId);

        if ($tenantId) {
            $query->whereHas('location', fn($q) => $q->where('tenant_id', $tenantId));
        }

        return $query->exists();
    }

    public function index(Request $request)
    {
        $query = $this->floorQuery($request)->with('building', 'housingUnits');

        if ($request->has('building_id')) {
            $query->where('building_id', $request->building_id);
        }

        $floors = $query->paginate(15);
        return $this->sendResponse($floors, 'Floors retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'building_id' => 'required|exists:buildings,id',
            'floor_number' => 'required|integer',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        if (!$this->buildingBelongsToTenant((int) $request->building_id, $this->tenantId($request))) {
            return $this->sendError('Accès refusé : bâtiment invalide', [], 403);
        }

        $floor = Floor::create($request->only(['building_id', 'floor_number']));

        return $this->sendResponse($floor->load('building'), 'Floor created successfully', 201);
    }

    public function show(Request $request, $id)
    {
        $floor = $this->floorQuery($request)
            ->with('building', 'housingUnits.configuration')
            ->find($id);

        if (!$floor) {
            return $this->sendError('Floor not found');
        }

        return $this->sendResponse($floor, 'Floor retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $floor = $this->floorQuery($request)->find($id);

        if (!$floor) {
            return $this->sendError('Floor not found');
        }

        $validator = Validator::make($request->all(), [
            'building_id' => 'sometimes|exists:buildings,id',
            'floor_number' => 'sometimes|integer',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $buildingId = (int) $request->get('building_id', $floor->building_id);
        if (!$this->buildingBelongsToTenant($buildingId, $this->tenantId($request))) {
            return $this->sendError('Accès refusé : bâtiment invalide', [], 403);
        }

        $floor->update($request->only(['building_id', 'floor_number']));

        return $this->sendResponse($floor->load('building'), 'Floor updated successfully');
    }

    public function destroy(Request $request, $id)
    {
        $floor = $this->floorQuery($request)->find($id);

        if (!$floor) {
            return $this->sendError('Floor not found');
        }

        $floor->delete();

        return $this->sendResponse([], 'Floor deleted successfully');
    }

    public function publicIndex(Request $request)
    {
        $perPage = $request->get('per_page', 200);
        $query = $this->floorQuery($request)->with('building');

        if ($request->has('building_id')) {
            $query->where('building_id', $request->building_id);
        }

        $floors = $query->paginate($perPage);
        return $this->sendResponse($floors, 'Floors retrieved successfully');
    }
}
