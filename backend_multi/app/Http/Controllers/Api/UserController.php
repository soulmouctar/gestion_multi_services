<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class UserController extends BaseController
{
    public function index(Request $request)
    {
        $query = User::with('tenant', 'roles');

        if ($request->has('tenant_id')) {
            $query->where('tenant_id', $request->tenant_id);
        }

        $users = $query->paginate(15);
        return $this->sendResponse($users, 'Users retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:150',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|min:8',
            'tenant_id' => 'nullable|exists:tenants,id',
            'role' => 'nullable|string|exists:roles,name',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'tenant_id' => $request->tenant_id,
        ]);

        if ($request->has('role')) {
            $user->assignRole($request->role);
        } else {
            $user->assignRole('USER');
        }

        return $this->sendResponse($user->load('roles'), 'User created successfully', 201);
    }

    public function show($id)
    {
        $user = User::with('tenant', 'roles', 'permissions')->find($id);

        if (!$user) {
            return $this->sendError('User not found');
        }

        return $this->sendResponse($user, 'User retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $user = User::find($id);

        if (!$user) {
            return $this->sendError('User not found');
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:150',
            'email' => 'sometimes|email|unique:users,email,' . $id,
            'password' => 'nullable|min:8',
            'tenant_id' => 'nullable|exists:tenants,id',
            'role' => 'nullable|string|exists:roles,name',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $data = $request->only(['name', 'email', 'tenant_id']);
        
        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->password);
        }

        $user->update($data);

        if ($request->has('role')) {
            $user->syncRoles([$request->role]);
        }

        return $this->sendResponse($user->load('roles'), 'User updated successfully');
    }

    public function destroy($id)
    {
        $user = User::find($id);

        if (!$user) {
            return $this->sendError('User not found');
        }

        $user->delete();

        return $this->sendResponse([], 'User deleted successfully');
    }

    public function assignRole(Request $request, $id)
    {
        $user = User::find($id);

        if (!$user) {
            return $this->sendError('User not found');
        }

        $validator = Validator::make($request->all(), [
            'role' => 'required|string|exists:roles,name',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $user->assignRole($request->role);

        return $this->sendResponse($user->load('roles'), 'Role assigned successfully');
    }

    public function removeRole(Request $request, $id)
    {
        $user = User::find($id);

        if (!$user) {
            return $this->sendError('User not found');
        }

        $validator = Validator::make($request->all(), [
            'role' => 'required|string|exists:roles,name',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $user->removeRole($request->role);

        return $this->sendResponse($user->load('roles'), 'Role removed successfully');
    }

    public function getModulePermissions($id)
    {
        $user = User::find($id);

        if (!$user) {
            return $this->sendError('User not found');
        }

        // Get user's module permissions from database or return default structure
        $modulePermissions = $this->getUserModulePermissions($user);

        return $this->sendResponse($modulePermissions, 'Module permissions retrieved successfully');
    }

    public function updateModulePermissions(Request $request, $id)
    {
        $user = User::find($id);

        if (!$user) {
            return $this->sendError('User not found');
        }

        $validator = Validator::make($request->all(), [
            'module_permissions' => 'required|array',
            'module_permissions.*.module_code' => 'required|string',
            'module_permissions.*.module_name' => 'required|string',
            'module_permissions.*.permissions' => 'required|array',
            'module_permissions.*.is_active' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        // Store module permissions in user_module_permissions table
        DB::beginTransaction();
        try {
            // Delete existing permissions for this user
            DB::table('user_module_permissions')->where('user_id', $user->id)->delete();

            // Insert new permissions
            foreach ($request->module_permissions as $modulePermission) {
                if ($modulePermission['is_active']) {
                    DB::table('user_module_permissions')->insert([
                        'user_id' => $user->id,
                        'module_code' => $modulePermission['module_code'],
                        'module_name' => $modulePermission['module_name'],
                        'permissions' => json_encode($modulePermission['permissions']),
                        'is_active' => $modulePermission['is_active'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            DB::commit();
            
            return $this->sendResponse([], 'Module permissions updated successfully');
        } catch (\Exception $e) {
            DB::rollback();
            return $this->sendError('Error updating module permissions', ['error' => $e->getMessage()], 500);
        }
    }

    private function getUserModulePermissions($user)
    {
        $availableModules = [
            ['module_code' => 'COMMERCIAL', 'module_name' => 'Gestion Commerciale', 'permissions' => [], 'is_active' => false],
            ['module_code' => 'FINANCE', 'module_name' => 'Gestion Financière', 'permissions' => [], 'is_active' => false],
            ['module_code' => 'CLIENTS_SUPPLIERS', 'module_name' => 'Clients & Fournisseurs', 'permissions' => [], 'is_active' => false],
            ['module_code' => 'PRODUCTS_STOCK', 'module_name' => 'Produits & Stock', 'permissions' => [], 'is_active' => false],
            ['module_code' => 'CONTAINERS', 'module_name' => 'Conteneurs', 'permissions' => [], 'is_active' => false],
            ['module_code' => 'RENTAL', 'module_name' => 'Location Immobilière', 'permissions' => [], 'is_active' => false],
            ['module_code' => 'TAXI', 'module_name' => 'Gestion Taxi', 'permissions' => [], 'is_active' => false],
            ['module_code' => 'STATISTICS', 'module_name' => 'Statistiques', 'permissions' => [], 'is_active' => false],
        ];

        // Get user's existing permissions
        $userPermissions = DB::table('user_module_permissions')
            ->where('user_id', $user->id)
            ->get();

        // Merge with available modules
        foreach ($userPermissions as $userPerm) {
            $moduleIndex = array_search($userPerm->module_code, array_column($availableModules, 'module_code'));
            if ($moduleIndex !== false) {
                $availableModules[$moduleIndex]['permissions'] = json_decode($userPerm->permissions, true);
                $availableModules[$moduleIndex]['is_active'] = $userPerm->is_active;
            }
        }

        return $availableModules;
    }
}
