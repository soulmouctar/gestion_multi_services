<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RolePermissionController extends BaseController
{
    public function getRoles()
    {
        $roles = Role::with('permissions')->get();
        return $this->sendResponse($roles, 'Roles retrieved successfully');
    }

    public function createRole(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|unique:roles,name',
            'guard_name' => 'sometimes|string',
            'permission_ids' => 'nullable|array',
            'permission_ids.*' => 'exists:permissions,id',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $role = Role::create([
            'name' => $request->name, 
            'guard_name' => $request->guard_name ?? 'web'
        ]);

        if ($request->has('permission_ids')) {
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
            'name' => 'sometimes|string|unique:roles,name,' . $id,
            'guard_name' => 'sometimes|string',
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

    public function deleteRole($id)
    {
        $role = Role::find($id);

        if (!$role) {
            return $this->sendError('Role not found');
        }

        $role->delete();

        return $this->sendResponse([], 'Role deleted successfully');
    }

    public function getPermissions()
    {
        $permissions = Permission::all();
        return $this->sendResponse($permissions, 'Permissions retrieved successfully');
    }

    public function createPermission(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|unique:permissions,name',
            'guard_name' => 'sometimes|string',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $permission = Permission::create([
            'name' => $request->name, 
            'guard_name' => $request->guard_name ?? 'web'
        ]);

        return $this->sendResponse($permission, 'Permission created successfully', 201);
    }

    public function deletePermission($id)
    {
        $permission = Permission::find($id);

        if (!$permission) {
            return $this->sendError('Permission not found');
        }

        $permission->delete();

        return $this->sendResponse([], 'Permission deleted successfully');
    }
}
