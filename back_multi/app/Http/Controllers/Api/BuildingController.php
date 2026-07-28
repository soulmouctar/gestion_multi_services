<?php

namespace App\Http\Controllers\Api;

use App\Models\Building;
use App\Http\Requests\StoreBuildingRequest;
use App\Http\Requests\UpdateBuildingRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class BuildingController extends BaseController
{
    private function tenantId(Request $request): ?int
    {
        $user = Auth::user();
        return $user->hasRole('SUPER_ADMIN') ? $request->get('tenant_id') : $user->tenant_id;
    }

    private function locationBelongsToTenant(int $locationId, ?int $tenantId): bool
    {
        $query = \App\Models\Location::whereKey($locationId);

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        return $query->exists();
    }

    public function index(Request $request)
    {
        $user     = Auth::user();
        $tenantId = $user->hasRole('SUPER_ADMIN')
            ? $request->get('tenant_id')
            : $user->tenant_id;

        $query = Building::with('location', 'floors');

        if ($tenantId) {
            $query->whereHas('location', fn($q) => $q->where('tenant_id', $tenantId));
        }

        if ($request->has('location_id')) {
            $query->where('location_id', $request->location_id);
        }

        $buildings = $query->paginate(15);
        return $this->sendResponse($buildings, 'Buildings retrieved successfully');
    }

    public function store(StoreBuildingRequest $request)
    {
        $tenantId = $this->tenantId($request);

        if (!$this->locationBelongsToTenant((int) $request->location_id, $tenantId)) {
            return $this->sendError('Accès refusé : location invalide', [], 403);
        }

        $building = Building::create($request->only(['location_id', 'name', 'type', 'total_floors']));

        return $this->sendResponse($building->load('location'), 'Building created successfully', 201);
    }

    public function show($id)
    {
        $user     = Auth::user();
        $building = Building::with('location', 'floors.housingUnits')->find($id);

        if (!$building) {
            return $this->sendError('Building not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $building->location->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        return $this->sendResponse($building, 'Building retrieved successfully');
    }

    public function update(UpdateBuildingRequest $request, $id)
    {
        $user     = Auth::user();
        $building = Building::with('location')->find($id);

        if (!$building) {
            return $this->sendError('Building not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $building->location->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $targetLocationId = (int) $request->get('location_id', $building->location_id);
        $tenantId = $this->tenantId($request);
        if (!$this->locationBelongsToTenant($targetLocationId, $tenantId)) {
            return $this->sendError('Accès refusé : location invalide', [], 403);
        }

        $building->update($request->only(['location_id', 'name', 'type', 'total_floors']));

        return $this->sendResponse($building->load('location'), 'Building updated successfully');
    }

    public function destroy($id)
    {
        $user     = Auth::user();
        $building = Building::with('location')->find($id);

        if (!$building) {
            return $this->sendError('Building not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $building->location->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $building->delete();

        return $this->sendResponse([], 'Building deleted successfully');
    }
}
