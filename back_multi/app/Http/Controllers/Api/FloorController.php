<?php

namespace App\Http\Controllers\Api;

use App\Models\Floor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class FloorController extends BaseController
{
    public function index(Request $request)
    {
        $query = Floor::with('building', 'housingUnits');

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

        $floor = Floor::create($request->all());

        return $this->sendResponse($floor->load('building'), 'Floor created successfully', 201);
    }

    public function show($id)
    {
        $floor = Floor::with('building', 'housingUnits.configuration')->find($id);

        if (!$floor) {
            return $this->sendError('Floor not found');
        }

        return $this->sendResponse($floor, 'Floor retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $floor = Floor::find($id);

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

        $floor->update($request->all());

        return $this->sendResponse($floor->load('building'), 'Floor updated successfully');
    }

    public function destroy($id)
    {
        $floor = Floor::find($id);

        if (!$floor) {
            return $this->sendError('Floor not found');
        }

        $floor->delete();

        return $this->sendResponse([], 'Floor deleted successfully');
    }
}
