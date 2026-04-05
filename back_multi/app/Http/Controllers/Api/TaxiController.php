<?php

namespace App\Http\Controllers\Api;

use App\Models\Taxi;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TaxiController extends BaseController
{
    public function index(Request $request)
    {
        $tenantId = auth()->user()->tenant_id;

        $query = $tenantId
            ? Taxi::where('tenant_id', $tenantId)
            : Taxi::query();

        $taxis = $query->orderBy('plate_number')->paginate(15);

        return $this->sendResponse($taxis, 'Taxis retrieved successfully');
    }

    public function store(Request $request)
    {
        $tenantId = auth()->user()->tenant_id;

        $validator = Validator::make($request->all(), [
            'plate_number' => 'required|string|max:50',
            'brand'        => 'nullable|string|max:50',
            'vehicle_model'=> 'nullable|string|max:50',
            'year'         => 'nullable|integer|min:1990|max:2100',
            'color'        => 'nullable|string|max:30',
            'mileage'      => 'nullable|integer|min:0',
            'status'       => 'nullable|in:ACTIVE,MAINTENANCE,INACTIVE',
            'insurance_expiry'            => 'nullable|date',
            'technical_inspection_expiry' => 'nullable|date',
            'circulation_permit_expiry'   => 'nullable|date',
            'notes'        => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $data = $request->only([
            'plate_number', 'brand', 'vehicle_model', 'year', 'color', 'mileage', 'status',
            'insurance_expiry', 'technical_inspection_expiry', 'circulation_permit_expiry', 'notes',
        ]);
        $data['tenant_id'] = $tenantId;

        $taxi = Taxi::create($data);

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
            'plate_number' => 'sometimes|string|max:50',
            'brand'        => 'nullable|string|max:50',
            'vehicle_model'=> 'nullable|string|max:50',
            'year'         => 'nullable|integer|min:1990|max:2100',
            'color'        => 'nullable|string|max:30',
            'mileage'      => 'nullable|integer|min:0',
            'status'       => 'nullable|in:ACTIVE,MAINTENANCE,INACTIVE',
            'insurance_expiry'            => 'nullable|date',
            'technical_inspection_expiry' => 'nullable|date',
            'circulation_permit_expiry'   => 'nullable|date',
            'notes'        => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $taxi->update($request->only([
            'plate_number', 'brand', 'vehicle_model', 'year', 'color', 'mileage', 'status',
            'insurance_expiry', 'technical_inspection_expiry', 'circulation_permit_expiry', 'notes',
        ]));

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
