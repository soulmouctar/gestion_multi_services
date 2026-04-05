<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Models\Module;
use App\Services\UserModulePermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class UserController extends BaseController
{
    public function __construct(
        private readonly UserModulePermissionService $modulePermissionService
    ) {}

    public function index(Request $request)
    {
        $currentUser = auth()->user();
        $perPage = $request->get('per_page', 15);

        $query = User::with('tenant', 'roles');

        // ADMIN ne voit que les utilisateurs de son tenant
        if ($currentUser && $currentUser->hasRole('ADMIN') && !$currentUser->hasRole('SUPER_ADMIN')) {
            $query->where('tenant_id', $currentUser->tenant_id);
        } elseif ($request->has('tenant_id')) {
            $query->where('tenant_id', $request->tenant_id);
        }

        $users = $query->paginate($perPage);

        return $this->sendResponse($users, 'Users retrieved successfully');
    }

    public function publicIndex(Request $request)
    {
        $currentUser = auth()->user();
        $perPage = $request->get('per_page', 15);

        $query = User::with('tenant', 'roles');

        // ADMIN ne voit que les utilisateurs de son tenant
        if ($currentUser && $currentUser->hasRole('ADMIN') && !$currentUser->hasRole('SUPER_ADMIN')) {
            $query->where('tenant_id', $currentUser->tenant_id);
        } elseif ($request->has('tenant_id')) {
            $query->where('tenant_id', $request->tenant_id);
        }

        $users = $query->paginate($perPage);
        return $this->sendResponse($users, 'Users retrieved successfully');
    }

    public function store(Request $request)
    {
        $currentUser = auth()->user();

        $validator = Validator::make($request->all(), [
            'name'      => 'required|string|max:150',
            'email'     => 'required|email|unique:users,email',
            'password'  => 'required|min:8',
            'tenant_id' => 'nullable|exists:tenants,id',
            'role'      => 'nullable|string|exists:roles,name',
            'avatar'    => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $requestedRole = $request->get('role', 'USER');

        if ($requestedRole === 'SUPER_ADMIN' && !$currentUser->hasRole('SUPER_ADMIN')) {
            return $this->sendError('Vous n\'avez pas l\'autorisation de créer un utilisateur SUPER_ADMIN', [], 403);
        }

        if ($currentUser->hasRole('ADMIN') && !$currentUser->hasRole('SUPER_ADMIN')) {
            $request->merge(['tenant_id' => $currentUser->tenant_id]);
            if ($requestedRole !== 'USER') {
                return $this->sendError('Vous ne pouvez créer que des utilisateurs avec le rôle USER', [], 403);
            }
        }

        $avatarPath = null;
        if ($request->hasFile('avatar')) {
            $avatarPath = $request->file('avatar')->store('avatars', 'public');
        }

        $user = User::create([
            'name'      => $request->name,
            'email'     => $request->email,
            'password'  => Hash::make($request->password),
            'tenant_id' => $request->tenant_id,
            'avatar'    => $avatarPath,
        ]);

        $user->assignRole($requestedRole);

        // Accorder automatiquement tous les modules du tenant à l'administrateur
        $user->load('roles');
        $this->modulePermissionService->grantAllTenantModules($user);


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
        $currentUser = auth()->user();
        $user = User::find($id);

        if (!$user) {
            return $this->sendError('User not found');
        }

        $validator = Validator::make($request->all(), [
            'name'      => 'sometimes|string|max:150',
            'email'     => 'sometimes|email|unique:users,email,' . $id,
            'password'  => 'nullable|min:8',
            'tenant_id' => 'nullable|exists:tenants,id',
            'role'      => 'nullable|string|exists:roles,name',
            'avatar'    => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        if ($request->has('role')) {
            $requestedRole = $request->role;

            if ($requestedRole === 'SUPER_ADMIN' && !$currentUser->hasRole('SUPER_ADMIN')) {
                return $this->sendError('Vous n\'avez pas l\'autorisation d\'assigner le rôle SUPER_ADMIN', [], 403);
            }

            if ($currentUser->hasRole('ADMIN') && !$currentUser->hasRole('SUPER_ADMIN')) {
                if ($user->tenant_id !== $currentUser->tenant_id) {
                    return $this->sendError('Vous ne pouvez gérer que les utilisateurs de votre organisation', [], 403);
                }
                if ($requestedRole !== 'USER') {
                    return $this->sendError('Vous ne pouvez assigner que le rôle USER', [], 403);
                }
            }
        }

        if ($currentUser->hasRole('ADMIN') && !$currentUser->hasRole('SUPER_ADMIN')) {
            if ($user->tenant_id !== $currentUser->tenant_id) {
                return $this->sendError('Vous ne pouvez gérer que les utilisateurs de votre organisation', [], 403);
            }
            if ($request->has('tenant_id') && $request->tenant_id !== $currentUser->tenant_id) {
                return $this->sendError('Vous ne pouvez pas déplacer un utilisateur vers une autre organisation', [], 403);
            }
        }

        $previousTenantId = $user->tenant_id;

        $data = $request->only(['name', 'email', 'tenant_id', 'is_active']);

        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->password);
        }

        if ($request->hasFile('avatar')) {
            if ($user->avatar) {
                Storage::disk('public')->delete($user->avatar);
            }
            $data['avatar'] = $request->file('avatar')->store('avatars', 'public');
        }

        $user->update($data);

        if ($request->has('role')) {
            $user->syncRoles([$request->role]);
        }

        // Resynchroniser les permissions si le tenant ou le rôle a changé
        $user->load('roles');
        $this->modulePermissionService->syncAfterUserUpdate($user, $previousTenantId);


        return $this->sendResponse($user->load('roles'), 'User updated successfully');
    }

    public function destroy($id)
    {
        $currentUser = auth()->user();
        $user = User::find($id);

        if (!$user) {
            return $this->sendError('User not found');
        }

        if ($user->id === $currentUser->id) {
            return $this->sendError('Vous ne pouvez pas supprimer votre propre compte', [], 403);
        }

        if ($user->hasRole('SUPER_ADMIN') && !$currentUser->hasRole('SUPER_ADMIN')) {
            return $this->sendError('Vous n\'avez pas l\'autorisation de supprimer un utilisateur SUPER_ADMIN', [], 403);
        }

        if ($currentUser->hasRole('ADMIN') && !$currentUser->hasRole('SUPER_ADMIN')) {
            if ($user->tenant_id !== $currentUser->tenant_id) {
                return $this->sendError('Vous ne pouvez gérer que les utilisateurs de votre organisation', [], 403);
            }
            if (!$user->hasRole('USER')) {
                return $this->sendError('Vous ne pouvez supprimer que des utilisateurs avec le rôle USER', [], 403);
            }
        }

        $user->delete();

        return $this->sendResponse([], 'User deleted successfully');
    }

    public function assignRole(Request $request, $id)
    {
        $currentUser = auth()->user();
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

        $requestedRole = $request->role;

        if ($requestedRole === 'SUPER_ADMIN' && !$currentUser->hasRole('SUPER_ADMIN')) {
            return $this->sendError('Vous n\'avez pas l\'autorisation d\'assigner le rôle SUPER_ADMIN', [], 403);
        }

        if ($currentUser->hasRole('ADMIN') && !$currentUser->hasRole('SUPER_ADMIN')) {
            if ($user->tenant_id !== $currentUser->tenant_id) {
                return $this->sendError('Vous ne pouvez gérer que les utilisateurs de votre organisation', [], 403);
            }
            if ($requestedRole !== 'USER') {
                return $this->sendError('Vous ne pouvez assigner que le rôle USER', [], 403);
            }
        }

        if ($user->id === $currentUser->id && $requestedRole === 'SUPER_ADMIN') {
            return $this->sendError('Vous ne pouvez pas vous auto-promouvoir au rôle SUPER_ADMIN', [], 403);
        }

        $user->assignRole($requestedRole);

        return $this->sendResponse($user->load('roles'), 'Role assigned successfully');
    }

    public function removeRole(Request $request, $id)
    {
        $currentUser = auth()->user();
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

        $roleToRemove = $request->role;

        if ($roleToRemove === 'SUPER_ADMIN' && !$currentUser->hasRole('SUPER_ADMIN')) {
            return $this->sendError('Vous n\'avez pas l\'autorisation de supprimer le rôle SUPER_ADMIN', [], 403);
        }

        if ($currentUser->hasRole('ADMIN') && !$currentUser->hasRole('SUPER_ADMIN')) {
            if ($user->tenant_id !== $currentUser->tenant_id) {
                return $this->sendError('Vous ne pouvez gérer que les utilisateurs de votre organisation', [], 403);
            }
            if ($roleToRemove !== 'USER') {
                return $this->sendError('Vous ne pouvez supprimer que le rôle USER', [], 403);
            }
        }

        if ($user->id === $currentUser->id && $roleToRemove === 'SUPER_ADMIN') {
            return $this->sendError('Vous ne pouvez pas supprimer votre propre rôle SUPER_ADMIN', [], 403);
        }

        $user->removeRole($roleToRemove);

        return $this->sendResponse($user->load('roles'), 'Role removed successfully');
    }

    public function toggleStatus($id)
    {
        $currentUser = auth()->user();
        $user = User::find($id);

        if (!$user) {
            return $this->sendError('User not found');
        }

        if ($user->id === $currentUser->id) {
            return $this->sendError('Vous ne pouvez pas désactiver votre propre compte', [], 403);
        }

        if ($currentUser->hasRole('ADMIN') && !$currentUser->hasRole('SUPER_ADMIN')) {
            if ($user->tenant_id !== $currentUser->tenant_id) {
                return $this->sendError('Vous ne pouvez gérer que les utilisateurs de votre organisation', [], 403);
            }
        }

        $user->update(['is_active' => !$user->is_active]);

        return $this->sendResponse($user->load('roles'), 'User status updated successfully');
    }

    public function getModulePermissions($id)
    {
        $currentUser = auth()->user();
        $user = User::find($id);

        if (!$user) {
            return $this->sendError('User not found', [], 404);
        }

        // ADMIN can only view permissions of users in their own tenant
        if ($currentUser->hasRole('ADMIN') && !$currentUser->hasRole('SUPER_ADMIN')) {
            if ($user->tenant_id !== $currentUser->tenant_id) {
                return $this->sendError('Accès non autorisé', [], 403);
            }
        }

        return $this->getUserModulePermissions($id);
    }

    public function updateModulePermissions(Request $request, $id)
    {
        $currentUser = auth()->user();
        $user = User::find($id);
        if (!$user) {
            return $this->sendError('User not found', [], 404);
        }

        // ADMIN can only update permissions of users in their own tenant
        if ($currentUser->hasRole('ADMIN') && !$currentUser->hasRole('SUPER_ADMIN')) {
            if ($user->tenant_id !== $currentUser->tenant_id) {
                return $this->sendError('Accès non autorisé', [], 403);
            }
        }

        $validator = Validator::make($request->all(), [
            'module_permissions'                  => 'required|array',
            'module_permissions.*.module_code'    => 'required|string',
            'module_permissions.*.module_name'    => 'required|string',
            'module_permissions.*.permissions'    => 'present|array',
            'module_permissions.*.is_active'      => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        DB::beginTransaction();
        try {
            DB::table('user_module_permissions')->where('user_id', $user->id)->delete();

            foreach ($request->module_permissions as $modulePermission) {
                if ($modulePermission['is_active']) {
                    DB::table('user_module_permissions')->insert([
                        'user_id'     => $user->id,
                        'module_code' => $modulePermission['module_code'],
                        'module_name' => $modulePermission['module_name'],
                        'permissions' => json_encode($modulePermission['permissions'] ?? []),
                        'is_active'   => $modulePermission['is_active'],
                        'created_at'  => now(),
                        'updated_at'  => now(),
                    ]);
                }
            }

            DB::commit();

            return $this->sendResponse([], 'Module permissions updated successfully');
        } catch (\Exception $e) {
            DB::rollback();
            \Log::error('Error updating module permissions', [
                'user_id' => $user->id,
                'error'   => $e->getMessage(),
            ]);
            return $this->sendError('Error updating module permissions', [], 500);
        }
    }

    public function getUserModulePermissions($id)
    {
        $user = User::find($id);

        if (!$user) {
            return $this->sendError('User not found', [], 404);
        }

        // Récupérer les modules disponibles depuis la base de données
        $availableModules = Module::all()->map(function ($module) {
            return [
                'module_code' => $module->code,
                'module_name' => $module->name,
                'permissions' => [],
                'is_active'   => false,
            ];
        })->toArray();

        // Récupérer les permissions existantes de l'utilisateur
        $userPermissions = DB::table('user_module_permissions')
            ->where('user_id', $user->id)
            ->get()
            ->keyBy('module_code');

        // Fusionner avec les permissions utilisateur
        foreach ($availableModules as &$module) {
            if ($userPermissions->has($module['module_code'])) {
                $userPerm = $userPermissions->get($module['module_code']);
                $module['permissions'] = json_decode($userPerm->permissions, true) ?: [];
                $module['is_active']   = (bool) $userPerm->is_active;
            }
        }

        return $this->sendResponse($availableModules, 'User module permissions retrieved successfully');
    }
}