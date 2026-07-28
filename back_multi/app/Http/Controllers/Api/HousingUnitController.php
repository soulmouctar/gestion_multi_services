<?php

namespace App\Http\Controllers\Api;

use App\Models\Floor;
use App\Models\HousingUnit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class HousingUnitController extends BaseController
{
    private function tenantId(Request $request): ?int
    {
        $user = Auth::user();
        return $user->hasRole('SUPER_ADMIN') ? $request->get('tenant_id') : $user->tenant_id;
    }

    private function unitQuery(Request $request)
    {
        $tenantId = $this->tenantId($request);
        $query = HousingUnit::query();

        if ($tenantId) {
            $query->whereHas('floor.building.location', fn($q) => $q->where('tenant_id', $tenantId));
        }

        return $query;
    }

    private function floorBelongsToTenant(int $floorId, ?int $tenantId): bool
    {
        $query = Floor::whereKey($floorId);

        if ($tenantId) {
            $query->whereHas('building.location', fn($q) => $q->where('tenant_id', $tenantId));
        }

        return $query->exists();
    }

    public function index(Request $request)
    {
        $query = $this->unitQuery($request)->with('floor.building', 'configuration');

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

        if (!$this->floorBelongsToTenant((int) $request->floor_id, $this->tenantId($request))) {
            return $this->sendError('Accès refusé : étage invalide', [], 403);
        }

        $unit = HousingUnit::create($request->only([
            'floor_id',
            'unit_configuration_id',
            'rent_amount',
            'status',
        ]));

        return $this->sendResponse($unit->load('floor', 'configuration'), 'Housing unit created successfully', 201);
    }

    public function show(Request $request, $id)
    {
        $unit = $this->unitQuery($request)
            ->with('floor.building.location', 'configuration')
            ->find($id);

        if (!$unit) {
            return $this->sendError('Housing unit not found');
        }

        return $this->sendResponse($unit, 'Housing unit retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $unit = $this->unitQuery($request)->find($id);

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

        $floorId = (int) $request->get('floor_id', $unit->floor_id);
        if (!$this->floorBelongsToTenant($floorId, $this->tenantId($request))) {
            return $this->sendError('Accès refusé : étage invalide', [], 403);
        }

        $unit->update($request->only([
            'floor_id',
            'unit_configuration_id',
            'rent_amount',
            'status',
        ]));

        return $this->sendResponse($unit->load('floor', 'configuration'), 'Housing unit updated successfully');
    }

    public function destroy(Request $request, $id)
    {
        $unit = $this->unitQuery($request)->find($id);

        if (!$unit) {
            return $this->sendError('Housing unit not found');
        }

        $unit->delete();

        return $this->sendResponse([], 'Housing unit deleted successfully');
    }

    public function publicIndex(Request $request)
    {
        $perPage = $request->get('per_page', 15);
        $query = $this->unitQuery($request)->with('floor.building', 'configuration');

        if ($request->has('floor_id')) {
            $query->where('floor_id', $request->floor_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $units = $query->paginate($perPage);
        return $this->sendResponse($units, 'Housing units retrieved successfully');
    }

    public function publicStore(Request $request)
    {
        return $this->store($request);
    }

    public function publicUpdate(Request $request, $id)
    {
        return $this->update($request, $id);
    }

    public function publicDestroy(Request $request, $id)
    {
        return $this->destroy($request, $id);
    }
}
