<?php

namespace App\Http\Controllers\Api;

use App\Models\Taxi;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Validator;

class TaxiController extends BaseController
{
    private function tenantId(Request $request): ?int
    {
        $user = auth()->user();
        return $user->hasRole('SUPER_ADMIN') ? $request->get('tenant_id') : $user->tenant_id;
    }

    private function taxiQuery(Request $request)
    {
        $tenantId = $this->tenantId($request);
        $query = Taxi::query();

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        return $query;
    }

    public function index(Request $request)
    {
        $tenantId = $this->tenantId($request);

        $query = $tenantId
            ? Taxi::where('tenant_id', $tenantId)
            : Taxi::query();

        $taxis = $query->orderBy('plate_number')->paginate(15);

        return $this->sendResponse($taxis, 'Taxis retrieved successfully');
    }

    public function store(Request $request)
    {
        $tenantId = $this->tenantId($request);

        if (!$tenantId) {
            return $this->sendError('Tenant ID requis.', [], 422);
        }

        $validator = Validator::make($request->all(), [
            'plate_number' => [
                'required',
                'string',
                'max:50',
                Rule::unique('taxis', 'plate_number')->where(fn($q) => $q->where('tenant_id', $tenantId)),
            ],
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

    public function show(Request $request, $id)
    {
        $taxi = $this->taxiQuery($request)
            ->with('tenant', 'assignments.driver')
            ->find($id);

        if (!$taxi) {
            return $this->sendError('Taxi not found');
        }

        return $this->sendResponse($taxi, 'Taxi retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $taxi = $this->taxiQuery($request)->find($id);

        if (!$taxi) {
            return $this->sendError('Taxi not found');
        }

        $validator = Validator::make($request->all(), [
            'plate_number' => [
                'sometimes',
                'string',
                'max:50',
                Rule::unique('taxis', 'plate_number')
                    ->where(fn($q) => $q->where('tenant_id', $taxi->tenant_id))
                    ->ignore($taxi->id),
            ],
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

    public function destroy(Request $request, $id)
    {
        $taxi = $this->taxiQuery($request)->find($id);

        if (!$taxi) {
            return $this->sendError('Taxi not found');
        }

        $taxi->delete();

        return $this->sendResponse([], 'Taxi deleted successfully');
    }
}
