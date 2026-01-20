<?php

namespace App\Http\Controllers\Api;

use App\Models\HousingUnit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class HousingUnitController extends BaseController
{
    public function index(Request $request)
    {
        $query = HousingUnit::with('floor.building', 'configuration');

        if ($request->has('floor_id')) {
            $query->where('floor_id', $request->floor_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $units = $query->paginate(15);
        return $this->sendResponse($units, 'Housing units retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'floor_id' => 'required|exists:floors,id',
            'unit_configuration_id' => 'nullable|exists:unit_configurations,id',
            'rent_amount' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:LIBRE,OCCUPE',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $unit = HousingUnit::create($request->all());

        return $this->sendResponse($unit->load('floor', 'configuration'), 'Housing unit created successfully', 201);
    }

    public function show($id)
    {
        $unit = HousingUnit::with('floor.building.location', 'configuration')->find($id);

        if (!$unit) {
            return $this->sendError('Housing unit not found');
        }

        return $this->sendResponse($unit, 'Housing unit retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $unit = HousingUnit::find($id);

        if (!$unit) {
            return $this->sendError('Housing unit not found');
        }

        $validator = Validator::make($request->all(), [
            'floor_id' => 'sometimes|exists:floors,id',
            'unit_configuration_id' => 'nullable|exists:unit_configurations,id',
            'rent_amount' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:LIBRE,OCCUPE',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $unit->update($request->all());

        return $this->sendResponse($unit->load('floor', 'configuration'), 'Housing unit updated successfully');
    }

    public function destroy($id)
    {
        $unit = HousingUnit::find($id);

        if (!$unit) {
            return $this->sendError('Housing unit not found');
        }

        $unit->delete();

        return $this->sendResponse([], 'Housing unit deleted successfully');
    }
}
