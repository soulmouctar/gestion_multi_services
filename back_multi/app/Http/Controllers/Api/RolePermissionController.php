<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RolePermissionController extends BaseController
{
    // ─── Rôles ────────────────────────────────────────────────────────────────

    public function indexRoles()
    {
        $roles = Role::with('permissions')->get();
        return $this->sendResponse($roles, 'Roles retrieved successfully');
    }

    public function storeRole(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name'           => 'required|string|max:125|unique:roles,name',
            'guard_name'     => 'sometimes|string',
            'permission_ids' => 'nullable|array',
            'permission_ids.*' => 'exists:permissions,id',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $role = Role::create([
            'name'       => $request->name,
            'guard_name' => $request->guard_name ?? 'web',
        ]);

        if ($request->filled('permission_ids')) {
            $permissions = Permission::whereIn('id', $request->permission_ids)->get();
            $role->syncPermissions($permissions);
        }

        return $this->sendResponse($role->load('permissions'), 'Role created successfully', 201);
    }

    public function showRole($id)
    {
        $role = Role::with('permissions')->find($id);

        if (!$role) {
            return $this->sendError('Role not found');
        }

        return $this->sendResponse($role, 'Role retrieved successfully');
    }

    public function updateRole(Request $request, $id)
    {
        $role = Role::find($id);

        if (!$role) {
            return $this->sendError('Role not found');
        }

        $validator = Validator::make($request->all(), [
            'name'           => 'sometimes|string|max:125|unique:roles,name,' . $id,
            'guard_name'     => 'sometimes|string',
            'permission_ids' => 'nullable|array',
            'permission_ids.*' => 'exists:permissions,id',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        if ($request->has('name')) {
            $role->update(['name' => $request->name]);
        }

        if ($request->has('permission_ids')) {
            $permissions = Permission::whereIn('id', $request->permission_ids)->get();
            $role->syncPermissions($permissions);
        }

        return $this->sendResponse($role->load('permissions'), 'Role updated successfully');
    }

    public function destroyRole($id)
    {
        $role = Role::find($id);

        if (!$role) {
            return $this->sendError('Role not found');
        }

        // Protéger les rôles système
        if (in_array($role->name, ['SUPER_ADMIN', 'ADMIN', 'USER'])) {
            return $this->sendError('Ce rôle système ne peut pas être supprimé.', [], 403);
        }

        $role->delete();

        return $this->sendResponse([], 'Role deleted successfully');
    }

    // ─── Permissions ─────────────────────────────────────────────────────────

    public function indexPermissions()
    {
        $permissions = Permission::orderBy('name')->get();
        return $this->sendResponse($permissions, 'Permissions retrieved successfully');
    }

    public function storePermission(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name'       => 'required|string|max:125|unique:permissions,name',
            'guard_name' => 'sometimes|string',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $permission = Permission::create([
            'name'       => $request->name,
            'guard_name' => $request->guard_name ?? 'web',
        ]);

        return $this->sendResponse($permission, 'Permission created successfully', 201);
    }

    public function destroyPermission($id)
    {
        $permission = Permission::find($id);

        if (!$permission) {
            return $this->sendError('Permission not found');
        }

        $permission->delete();

        return $this->sendResponse([], 'Permission deleted successfully');
    }
}
