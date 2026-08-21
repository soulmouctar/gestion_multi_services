<?php

namespace App\Http\Controllers\Api;

use App\Models\Building;
use App\Models\Floor;
use App\Models\HousingUnit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

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
            $query->whereHas('building.location', fn($q) => $q->where('tenant_id', $tenantId));
        }

        return $query;
    }

    private function buildingBelongsToTenant(int $buildingId, ?int $tenantId): bool
    {
        $query = Building::whereKey($buildingId);

        if ($tenantId) {
            $query->whereHas('location', fn($q) => $q->where('tenant_id', $tenantId));
        }

        return $query->exists();
    }

    private function floorBelongsToTenant(int $floorId, ?int $tenantId): bool
    {
        $query = Floor::whereKey($floorId);

        if ($tenantId) {
            $query->whereHas('building.location', fn($q) => $q->where('tenant_id', $tenantId));
        }

        return $query->exists();
    }

    private function floorBelongsToBuilding(?int $floorId, int $buildingId): bool
    {
        if (!$floorId) {
            return true;
        }

        return Floor::whereKey($floorId)->where('building_id', $buildingId)->exists();
    }

    public function index(Request $request)
    {
        $query = $this->unitQuery($request)->with('building.location', 'floor.building', 'configuration');

        if ($request->has('building_id')) {
            $query->where('building_id', $request->building_id);
        }

        if ($request->has('floor_id')) {
            if ($request->floor_id === 'none') {
                $query->whereNull('floor_id');
            } else {
                $query->where('floor_id', $request->floor_id);
            }
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
            'building_id' => 'required|exists:buildings,id',
            'floor_id' => 'nullable|exists:floors,id',
            'unit_label' => [
                'required',
                'string',
                'max:50',
                Rule::unique('housing_units', 'unit_label')
                    ->where(fn($query) => $query->where('building_id', $request->building_id)->whereNull('deleted_at')),
            ],
            'unit_configuration_id' => 'nullable|exists:unit_configurations,id',
            'rent_amount' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:LIBRE,OCCUPE',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $tenantId = $this->tenantId($request);
        $buildingId = (int) $request->building_id;
        $floorId = $request->filled('floor_id') ? (int) $request->floor_id : null;

        if (!$this->buildingBelongsToTenant($buildingId, $tenantId)) {
            return $this->sendError('Accès refusé : bâtiment invalide', [], 403);
        }

        if ($floorId && !$this->floorBelongsToTenant($floorId, $tenantId)) {
            return $this->sendError('Accès refusé : étage invalide', [], 403);
        }

        if (!$this->floorBelongsToBuilding($floorId, $buildingId)) {
            return $this->sendError('L’étage sélectionné ne correspond pas au bâtiment.', [], 422);
        }

        $unit = HousingUnit::create([
            'building_id' => $buildingId,
            'floor_id' => $floorId,
            'unit_label' => trim($request->unit_label),
            'unit_configuration_id' => $request->unit_configuration_id,
            'rent_amount' => $request->rent_amount ?? 0,
            'status' => $request->status ?? 'LIBRE',
        ]);

        return $this->sendResponse($unit->load('building.location', 'floor', 'configuration'), 'Housing unit created successfully', 201);
    }

    public function show(Request $request, $id)
    {
        $unit = $this->unitQuery($request)
            ->with('building.location', 'floor.building.location', 'configuration')
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
            'building_id' => 'sometimes|exists:buildings,id',
            'floor_id' => 'nullable|exists:floors,id',
            'unit_label' => [
                'sometimes',
                'required',
                'string',
                'max:50',
                Rule::unique('housing_units', 'unit_label')
                    ->ignore($unit->id)
                    ->where(fn($query) => $query->where('building_id', $request->get('building_id', $unit->building_id))->whereNull('deleted_at')),
            ],
            'unit_configuration_id' => 'nullable|exists:unit_configurations,id',
            'rent_amount' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:LIBRE,OCCUPE',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $tenantId = $this->tenantId($request);
        $buildingId = (int) $request->get('building_id', $unit->building_id);
        $floorId = $request->has('floor_id')
            ? ($request->filled('floor_id') ? (int) $request->floor_id : null)
            : $unit->floor_id;

        if (!$this->buildingBelongsToTenant($buildingId, $tenantId)) {
            return $this->sendError('Accès refusé : bâtiment invalide', [], 403);
        }

        if ($floorId && !$this->floorBelongsToTenant((int) $floorId, $tenantId)) {
            return $this->sendError('Accès refusé : étage invalide', [], 403);
        }

        if (!$this->floorBelongsToBuilding($floorId ? (int) $floorId : null, $buildingId)) {
            return $this->sendError('L’étage sélectionné ne correspond pas au bâtiment.', [], 422);
        }

        $unit->update([
            'building_id' => $buildingId,
            'floor_id' => $floorId,
            'unit_label' => $request->has('unit_label') ? trim($request->unit_label) : $unit->unit_label,
            'unit_configuration_id' => $request->has('unit_configuration_id') ? $request->unit_configuration_id : $unit->unit_configuration_id,
            'rent_amount' => $request->has('rent_amount') ? $request->rent_amount : $unit->rent_amount,
            'status' => $request->has('status') ? $request->status : $unit->status,
        ]);

        return $this->sendResponse($unit->load('building.location', 'floor', 'configuration'), 'Housing unit updated successfully');
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
        $query = $this->unitQuery($request)->with('building.location', 'floor.building', 'configuration');

        if ($request->has('building_id')) {
            $query->where('building_id', $request->building_id);
        }

        if ($request->has('floor_id')) {
            if ($request->floor_id === 'none') {
                $query->whereNull('floor_id');
            } else {
                $query->where('floor_id', $request->floor_id);
            }
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
