<?php

namespace App\Http\Controllers\Api;

use App\Models\Unit;
use App\Http\Requests\StoreUnitRequest;
use Illuminate\Http\Request;

class UnitController extends BaseController
{
    public function index()
    {
        $units = Unit::orderBy('name')->paginate(15);
        return $this->sendResponse($units, 'Units retrieved successfully');
    }

    public function store(StoreUnitRequest $request)
    {
        $unit = Unit::create($request->only(['name', 'conversion_value']));

        return $this->sendResponse($unit, 'Unit created successfully', 201);
    }

    public function show($id)
    {
        $unit = Unit::find($id);

        if (!$unit) {
            return $this->sendError('Unit not found', [], 404);
        }

        return $this->sendResponse($unit, 'Unit retrieved successfully');
    }

    public function update(StoreUnitRequest $request, $id)
    {
        $unit = Unit::find($id);

        if (!$unit) {
            return $this->sendError('Unit not found', [], 404);
        }

        $unit->update($request->only(['name', 'conversion_value']));

        return $this->sendResponse($unit, 'Unit updated successfully');
    }

    public function destroy($id)
    {
        $unit = Unit::find($id);

        if (!$unit) {
            return $this->sendError('Unit not found', [], 404);
        }

        $unit->delete();

        return $this->sendResponse([], 'Unit deleted successfully');
    }
}
