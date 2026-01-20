<?php

namespace App\Http\Controllers\Api;

use App\Models\Taxi;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TaxiController extends BaseController
{
    public function index(Request $request)
    {
        $query = Taxi::with('tenant', 'assignments');

        if ($request->has('tenant_id')) {
            $query->where('tenant_id', $request->tenant_id);
        }

        $taxis = $query->paginate(15);
        return $this->sendResponse($taxis, 'Taxis retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tenant_id' => 'required|exists:tenants,id',
            'plate_number' => 'required|string|max:50',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $taxi = Taxi::create($request->all());

        return $this->sendResponse($taxi, 'Taxi created successfully', 201);
    }

    public function show($id)
    {
        $taxi = Taxi::with('tenant', 'assignments.driver')->find($id);

        if (!$taxi) {
            return $this->sendError('Taxi not found');
        }

        return $this->sendResponse($taxi, 'Taxi retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $taxi = Taxi::find($id);

        if (!$taxi) {
            return $this->sendError('Taxi not found');
        }

        $validator = Validator::make($request->all(), [
            'tenant_id' => 'sometimes|exists:tenants,id',
            'plate_number' => 'sometimes|string|max:50',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $taxi->update($request->all());

        return $this->sendResponse($taxi, 'Taxi updated successfully');
    }

    public function destroy($id)
    {
        $taxi = Taxi::find($id);

        if (!$taxi) {
            return $this->sendError('Taxi not found');
        }

        $taxi->delete();

        return $this->sendResponse([], 'Taxi deleted successfully');
    }
}
