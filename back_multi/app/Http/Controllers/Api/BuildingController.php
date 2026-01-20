<?php

namespace App\Http\Controllers\Api;

use App\Models\Building;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class BuildingController extends BaseController
{
    public function index(Request $request)
    {
        $query = Building::with('location', 'floors');

        if ($request->has('location_id')) {
            $query->where('location_id', $request->location_id);
        }

        $buildings = $query->paginate(15);
        return $this->sendResponse($buildings, 'Buildings retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'location_id' => 'required|exists:locations,id',
            'name' => 'required|string|max:150',
            'type' => 'nullable|string|max:50',
            'total_floors' => 'nullable|integer|min:1',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $building = Building::create($request->all());

        return $this->sendResponse($building->load('location'), 'Building created successfully', 201);
    }

    public function show($id)
    {
        $building = Building::with('location', 'floors.housingUnits')->find($id);

        if (!$building) {
            return $this->sendError('Building not found');
        }

        return $this->sendResponse($building, 'Building retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $building = Building::find($id);

        if (!$building) {
            return $this->sendError('Building not found');
        }

        $validator = Validator::make($request->all(), [
            'location_id' => 'sometimes|exists:locations,id',
            'name' => 'sometimes|string|max:150',
            'type' => 'nullable|string|max:50',
            'total_floors' => 'nullable|integer|min:1',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $building->update($request->all());

        return $this->sendResponse($building->load('location'), 'Building updated successfully');
    }

    public function destroy($id)
    {
        $building = Building::find($id);

        if (!$building) {
            return $this->sendError('Building not found');
        }

        $building->delete();

        return $this->sendResponse([], 'Building deleted successfully');
    }
}
