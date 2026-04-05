<?php

namespace App\Http\Controllers\Api;

use App\Models\Tenant;
use App\Models\Module;
use App\Services\UserModulePermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TenantController extends BaseController
{
    public function __construct(
        private readonly UserModulePermissionService $modulePermissionService
    ) {}

    public function index()
    {
        $tenants = Tenant::with('modules', 'subscriptions')->paginate(15);
        return $this->sendResponse($tenants, 'Tenants retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:150',
            'email' => 'nullable|email|max:150',
            'phone' => 'nullable|string|max:50',
            'subscription_status' => 'nullable|in:ACTIVE,SUSPENDED',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $tenant = Tenant::create($request->all());

        return $this->sendResponse($tenant, 'Tenant created successfully', 201);
    }

    public function show($id)
    {
        $tenant = Tenant::with('modules', 'subscriptions', 'users')->find($id);

        if (!$tenant) {
            return $this->sendError('Tenant not found');
        }

        return $this->sendResponse($tenant, 'Tenant retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $user   = auth()->user();
        $tenant = Tenant::find($id);

        if (!$tenant) {
            return $this->sendError('Tenant not found');
        }

        // ADMIN ne peut modifier que son propre tenant
        if ($user->hasRole('ADMIN') && !$user->hasRole('SUPER_ADMIN')) {
            if ((int) $user->tenant_id !== (int) $id) {
                return $this->sendError('Accès non autorisé.', [], 403);
            }

            $validator = Validator::make($request->all(), [
                'name'  => 'sometimes|string|max:150',
                'email' => 'nullable|email|max:150',
                'phone' => 'nullable|string|max:50',
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            $tenant->update($request->only(['name', 'email', 'phone']));

            return $this->sendResponse($tenant->fresh(), 'Tenant updated successfully');
        }

        // SUPER_ADMIN : mise à jour complète
        $validator = Validator::make($request->all(), [
            'name'                => 'sometimes|string|max:150',
            'email'               => 'nullable|email|max:150',
            'phone'               => 'nullable|string|max:50',
            'subscription_status' => 'nullable|in:ACTIVE,SUSPENDED',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $tenant->update($request->all());

        return $this->sendResponse($tenant->fresh(), 'Tenant updated successfully');
    }

    public function destroy($id)
    {
        $tenant = Tenant::find($id);

        if (!$tenant) {
            return $this->sendError('Tenant not found');
        }

        $tenant->delete();

        return $this->sendResponse([], 'Tenant deleted successfully');
    }

    /**
     * Retourne les infos du tenant de l'utilisateur connecté.
     */
    public function getMyTenant(Request $request)
    {
        $user = auth()->user();

        if ($user->hasRole('SUPER_ADMIN') && !$user->tenant_id) {
            return $this->sendResponse(null, 'Super administrateur sans tenant.');
        }

        $tenant = Tenant::with('modules')->find($user->tenant_id);

        if (!$tenant) {
            return $this->sendError('Organisation introuvable.', [], 404);
        }

        return $this->sendResponse($tenant, 'Organisation récupérée avec succès');
    }

    /**
     * Permet à un ADMIN de mettre à jour les infos de son propre tenant.
     * Accessible également par SUPER_ADMIN (qui doit passer tenant_id).
     */
    public function updateMyTenant(Request $request)
    {
        $user = auth()->user();

        if ($user->hasRole('ADMIN') && !$user->hasRole('SUPER_ADMIN')) {
            if (!$user->tenant_id) {
                return $this->sendError('Aucune organisation associée à votre compte.', [], 404);
            }
            $tenant = Tenant::find($user->tenant_id);
            if (!$tenant) {
                return $this->sendError('Organisation introuvable.', [], 404);
            }
        } elseif ($user->hasRole('SUPER_ADMIN')) {
            $tenantId = $request->input('tenant_id') ?? $user->tenant_id;
            if (!$tenantId) {
                return $this->sendError('Veuillez spécifier un tenant_id.', [], 422);
            }
            $tenant = Tenant::find($tenantId);
            if (!$tenant) {
                return $this->sendError('Organisation introuvable.', [], 404);
            }
        } else {
            return $this->sendError('Accès non autorisé.', [], 403);
        }

        $validator = Validator::make($request->all(), [
            'name'  => 'sometimes|string|max:150',
            'email' => 'nullable|email|max:150',
            'phone' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $tenant->update($request->only(['name', 'email', 'phone']));

        return $this->sendResponse($tenant->fresh(), 'Organisation mise à jour avec succès');
    }

    public function assignModule(Request $request, $id)
    {
        $tenant = Tenant::find($id);

        if (!$tenant) {
            return $this->sendError('Tenant not found');
        }

        $validator = Validator::make($request->all(), [
            'module_id' => 'required|exists:modules,id',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $tenant->modules()->syncWithoutDetaching([
            $request->module_id => ['is_active' => $request->get('is_active', true)]
        ]);

        // Propager le module à tous les ADMINs du tenant
        $module = Module::find($request->module_id);
        if ($module && $request->get('is_active', true)) {
            $permissions = is_array($module->permissions) ? $module->permissions : [];
            $this->modulePermissionService->propagateModuleToAdmins(
                $tenant->id,
                $module->code,
                $module->name,
                $permissions
            );
        }

        return $this->sendResponse($tenant->load('modules'), 'Module assigned successfully');
    }

    public function removeModule(Request $request, $id)
    {
        $tenant = Tenant::find($id);

        if (!$tenant) {
            return $this->sendError('Tenant not found');
        }

        $validator = Validator::make($request->all(), [
            'module_id' => 'required|exists:modules,id',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $module = Module::find($request->module_id);
        $tenant->modules()->detach($request->module_id);

        // Révoquer le module pour tous les utilisateurs du tenant
        if ($module) {
            $this->modulePermissionService->revokeModuleFromTenantUsers($tenant->id, $module->code);
        }

        return $this->sendResponse($tenant->load('modules'), 'Module removed successfully');
    }

    public function getTenantModules($tenantId)
    {
        $tenant = Tenant::find($tenantId);

        if (!$tenant) {
            return $this->sendError('Tenant not found');
        }

        // Get only activated modules for this tenant
        $modules = $tenant->modules()
            ->wherePivot('is_active', true)
            ->get()
            ->map(function($module) {
                return [
                    'id' => $module->id,
                    'code' => $module->code,
                    'name' => $module->name,
                    'description' => $module->description,
                    'is_active' => true
                ];
            });

        return $this->sendResponse($modules, 'Tenant modules retrieved successfully');
    }
}
