<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RolePermissionController extends BaseController
{
    public function indexRoles()
    {
        $roles = Role::with('permissions')->paginate(15);
        return $this->sendResponse($roles, 'Roles retrieved successfully');
    }

    public function storeRole(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|unique:roles,name',
            'permissions' => 'nullable|array',
            'permissions.*' => 'exists:permissions,name',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $role = Role::create(['name' => $request->name, 'guard_name' => 'web']);

        if ($request->has('permissions')) {
            $role->syncPermissions($request->permissions);
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
            'name' => 'sometimes|string|unique:roles,name,' . $id,
            'permissions' => 'nullable|array',
            'permissions.*' => 'exists:permissions,name',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        if ($request->has('name')) {
            $role->update(['name' => $request->name]);
        }

        if ($request->has('permissions')) {
            $role->syncPermissions($request->permissions);
        }

        return $this->sendResponse($role->load('permissions'), 'Role updated successfully');
    }

    public function destroyRole($id)
    {
        $role = Role::find($id);

        if (!$role) {
            return $this->sendError('Role not found');
        }

        $role->delete();

        return $this->sendResponse([], 'Role deleted successfully');
    }

    public function indexPermissions()
    {
        $permissions = Permission::paginate(15);
        return $this->sendResponse($permissions, 'Permissions retrieved successfully');
    }

    public function storePermission(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|unique:permissions,name',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $permission = Permission::create(['name' => $request->name, 'guard_name' => 'web']);

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
