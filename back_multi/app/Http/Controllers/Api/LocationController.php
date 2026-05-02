<?php

namespace App\Http\Controllers\Api;

use App\Models\Location;
use App\Http\Requests\StoreLocationRequest;
use App\Http\Requests\UpdateLocationRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LocationController extends BaseController
{
    public function index(Request $request)
    {
        $user     = Auth::user();
        $tenantId = $user->hasRole('SUPER_ADMIN')
            ? $request->get('tenant_id')
            : $user->tenant_id;

        $query = Location::with('tenant', 'buildings');

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        $locations = $query->orderBy('created_at', 'desc')->paginate(15);
        return $this->sendResponse($locations, 'Locations retrieved successfully');
    }

    public function store(StoreLocationRequest $request)
    {
        $user     = Auth::user();
        $tenantId = $user->hasRole('SUPER_ADMIN')
            ? $request->get('tenant_id')
            : $user->tenant_id;

        $location = Location::create([
            'tenant_id' => $tenantId,
            'name'      => $request->name,
        ]);

        return $this->sendResponse($location->load('tenant', 'buildings'), 'Location created successfully', 201);
    }

    public function show($id)
    {
        $user     = Auth::user();
        $location = Location::with('tenant', 'buildings.floors.housingUnits')->find($id);

        if (!$location) {
            return $this->sendError('Location not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $location->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        return $this->sendResponse($location, 'Location retrieved successfully');
    }

    public function update(UpdateLocationRequest $request, $id)
    {
        $user     = Auth::user();
        $location = Location::find($id);

        if (!$location) {
            return $this->sendError('Location not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $location->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $location->update($request->only(['name']));

        return $this->sendResponse($location, 'Location updated successfully');
    }

    public function destroy($id)
    {
        $user     = Auth::user();
        $location = Location::find($id);

        if (!$location) {
            return $this->sendError('Location not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $location->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $location->delete();

        return $this->sendResponse([], 'Location deleted successfully');
    }

    public function statistics(Request $request)
    {
        $user     = Auth::user();
        $tenantId = $user->hasRole('SUPER_ADMIN')
            ? $request->get('tenant_id', $user->tenant_id)
            : $user->tenant_id;

        $totalLocations  = Location::where('tenant_id', $tenantId)->count();
        $totalBuildings  = \App\Models\Building::whereHas('location', fn($q) => $q->where('tenant_id', $tenantId))->count();
        $totalFloors     = \App\Models\Floor::whereHas('building.location', fn($q) => $q->where('tenant_id', $tenantId))->count();
        $totalHousingUnits = \App\Models\HousingUnit::whereHas('floor.building.location', fn($q) => $q->where('tenant_id', $tenantId))->count();

        return $this->sendResponse([
            'total_locations'    => $totalLocations,
            'total_buildings'    => $totalBuildings,
            'total_floors'       => $totalFloors,
            'total_housing_units'=> $totalHousingUnits,
        ], 'Location statistics retrieved successfully');
    }
}
