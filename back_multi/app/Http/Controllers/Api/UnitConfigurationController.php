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

        $configuration = UnitConfiguration::create($this->unitConfigurationPayload($request));

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

        $configuration->update($this->unitConfigurationPayload($request, true));

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

    private function unitConfigurationPayload(Request $request, bool $partial = false): array
    {
        $payload = $partial
            ? $request->only(['name', 'bedrooms', 'living_rooms', 'bathrooms', 'has_terrace'])
            : $request->all();

        foreach (['bedrooms', 'living_rooms', 'bathrooms'] as $field) {
            if (!$partial || array_key_exists($field, $payload)) {
                $payload[$field] = (int) ($payload[$field] ?? 0);
            }
        }

        if (!$partial || array_key_exists('has_terrace', $payload)) {
            $payload['has_terrace'] = (bool) ($payload['has_terrace'] ?? false);
        }

        return $payload;
    }
}
