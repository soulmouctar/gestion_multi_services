<?php

namespace App\Http\Controllers\Api;

use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class UnitController extends BaseController
{
    public function index()
    {
        $units = Unit::paginate(15);
        return $this->sendResponse($units, 'Units retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:50',
            'conversion_value' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $unit = Unit::create($request->all());

        return $this->sendResponse($unit, 'Unit created successfully', 201);
    }

    public function show($id)
    {
        $unit = Unit::find($id);

        if (!$unit) {
            return $this->sendError('Unit not found');
        }

        return $this->sendResponse($unit, 'Unit retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $unit = Unit::find($id);

        if (!$unit) {
            return $this->sendError('Unit not found');
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:50',
            'conversion_value' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $unit->update($request->all());

        return $this->sendResponse($unit, 'Unit updated successfully');
    }

    public function destroy($id)
    {
        $unit = Unit::find($id);

        if (!$unit) {
            return $this->sendError('Unit not found');
        }

        $unit->delete();

        return $this->sendResponse([], 'Unit deleted successfully');
    }
}
