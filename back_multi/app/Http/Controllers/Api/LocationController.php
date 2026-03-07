<?php

namespace App\Http\Controllers\Api;

use App\Models\Location;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class LocationController extends BaseController
{
    public function index(Request $request)
    {
        $query = Location::with('tenant', 'buildings');

        if ($request->has('tenant_id')) {
            $query->where('tenant_id', $request->tenant_id);
        }

        $locations = $query->paginate(15);
        return $this->sendResponse($locations, 'Locations retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tenant_id' => 'required|exists:tenants,id',
            'name' => 'required|string|max:150',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $location = Location::create($request->all());

        return $this->sendResponse($location, 'Location created successfully', 201);
    }

    public function show($id)
    {
        $location = Location::with('tenant', 'buildings.floors.housingUnits')->find($id);

        if (!$location) {
            return $this->sendError('Location not found');
        }

        return $this->sendResponse($location, 'Location retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $location = Location::find($id);

        if (!$location) {
            return $this->sendError('Location not found');
        }

        $validator = Validator::make($request->all(), [
            'tenant_id' => 'sometimes|exists:tenants,id',
            'name' => 'sometimes|string|max:150',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $location->update($request->all());

        return $this->sendResponse($location, 'Location updated successfully');
    }

    public function destroy($id)
    {
        $location = Location::find($id);

        if (!$location) {
            return $this->sendError('Location not found');
        }

        $location->delete();

        return $this->sendResponse([], 'Location deleted successfully');
    }

    public function publicIndex(Request $request)
    {
        $query = Location::with('tenant', 'buildings');

        // Use fixed tenant_id for testing
        $tenantId = $request->get('tenant_id', 1);
        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        $locations = $query->orderBy('created_at', 'desc')->paginate(15);
        return $this->sendResponse($locations, 'Locations retrieved successfully');
    }

    public function publicStore(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tenant_id' => 'required|exists:tenants,id',
            'name' => 'required|string|max:150',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $location = Location::create($request->all());

        return $this->sendResponse($location->load('tenant', 'buildings'), 'Location created successfully', 201);
    }

    public function publicStatistics(Request $request)
    {
        $tenantId = $request->get('tenant_id', 1);
        
        $totalLocations = Location::where('tenant_id', $tenantId)->count();
        $totalBuildings = \App\Models\Building::whereHas('location', function($q) use ($tenantId) {
            $q->where('tenant_id', $tenantId);
        })->count();
        
        $totalFloors = \App\Models\Floor::whereHas('building.location', function($q) use ($tenantId) {
            $q->where('tenant_id', $tenantId);
        })->count();
        
        $totalHousingUnits = \App\Models\HousingUnit::whereHas('floor.building.location', function($q) use ($tenantId) {
            $q->where('tenant_id', $tenantId);
        })->count();

        $statistics = [
            'total_locations' => $totalLocations,
            'total_buildings' => $totalBuildings,
            'total_floors' => $totalFloors,
            'total_housing_units' => $totalHousingUnits,
        ];

        return $this->sendResponse($statistics, 'Location statistics retrieved successfully');
    }
}
