<?php

namespace App\Http\Controllers\Api;

use App\Models\UnitConfiguration;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class UnitConfigurationController extends BaseController
{
    public function index()
    {
        $configurations = UnitConfiguration::paginate(15);
        return $this->sendResponse($configurations, 'Unit configurations retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:150',
            'bedrooms' => 'nullable|integer|min:0',
            'living_rooms' => 'nullable|integer|min:0',
            'bathrooms' => 'nullable|integer|min:0',
            'has_terrace' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $configuration = UnitConfiguration::create($request->all());

        return $this->sendResponse($configuration, 'Unit configuration created successfully', 201);
    }

    public function show($id)
    {
        $configuration = UnitConfiguration::with('housingUnits')->find($id);

        if (!$configuration) {
            return $this->sendError('Unit configuration not found');
        }

        return $this->sendResponse($configuration, 'Unit configuration retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $configuration = UnitConfiguration::find($id);

        if (!$configuration) {
            return $this->sendError('Unit configuration not found');
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:150',
            'bedrooms' => 'nullable|integer|min:0',
            'living_rooms' => 'nullable|integer|min:0',
            'bathrooms' => 'nullable|integer|min:0',
            'has_terrace' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $configuration->update($request->all());

        return $this->sendResponse($configuration, 'Unit configuration updated successfully');
    }

    public function destroy($id)
    {
        $configuration = UnitConfiguration::find($id);

        if (!$configuration) {
            return $this->sendError('Unit configuration not found');
        }

        $configuration->delete();

        return $this->sendResponse([], 'Unit configuration deleted successfully');
    }
}
