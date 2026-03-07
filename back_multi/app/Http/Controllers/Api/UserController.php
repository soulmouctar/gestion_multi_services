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
        $currentUser = auth()->user();
        
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

        $requestedRole = $request->get('role', 'USER');
        
        // Vérification de la hiérarchie des rôles pour la création
        if ($requestedRole === 'SUPER_ADMIN' && !$currentUser->hasRole('SUPER_ADMIN')) {
            return $this->sendError('Vous n\'avez pas l\'autorisation de créer un utilisateur avec le rôle SUPER_ADMIN', [], 403);
        }
        
        // ADMIN ne peut créer que des utilisateurs USER dans son tenant
        if ($currentUser->hasRole('ADMIN') && !$currentUser->hasRole('SUPER_ADMIN')) {
            // Forcer le tenant_id à celui de l'ADMIN
            $request->merge(['tenant_id' => $currentUser->tenant_id]);
            
            // ADMIN ne peut créer que des utilisateurs avec le rôle USER
            if ($requestedRole !== 'USER') {
                return $this->sendError('Vous ne pouvez créer que des utilisateurs avec le rôle USER', [], 403);
            }
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'tenant_id' => $request->tenant_id,
        ]);

        $user->assignRole($requestedRole);

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
            'name' => 'sometimes|string|max:150',
            'email' => 'sometimes|email|unique:users,email,' . $id,
            'password' => 'nullable|min:8',
            'tenant_id' => 'nullable|exists:tenants,id',
            'role' => 'nullable|string|exists:roles,name',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        // Vérification de la hiérarchie des rôles pour la modification
        if ($request->has('role')) {
            $requestedRole = $request->role;
            
            // Seul SUPER_ADMIN peut assigner le rôle SUPER_ADMIN
            if ($requestedRole === 'SUPER_ADMIN' && !$currentUser->hasRole('SUPER_ADMIN')) {
                return $this->sendError('Vous n\'avez pas l\'autorisation d\'assigner le rôle SUPER_ADMIN', [], 403);
            }
            
            // ADMIN ne peut modifier que des utilisateurs USER dans son tenant
            if ($currentUser->hasRole('ADMIN') && !$currentUser->hasRole('SUPER_ADMIN')) {
                // Vérifier que l'utilisateur cible est dans le même tenant
                if ($user->tenant_id !== $currentUser->tenant_id) {
                    return $this->sendError('Vous ne pouvez gérer que les utilisateurs de votre organisation', [], 403);
                }
                
                // ADMIN ne peut assigner que le rôle USER
                if ($requestedRole !== 'USER') {
                    return $this->sendError('Vous ne pouvez assigner que le rôle USER', [], 403);
                }
            }
        }

        // ADMIN ne peut modifier que les utilisateurs de son tenant
        if ($currentUser->hasRole('ADMIN') && !$currentUser->hasRole('SUPER_ADMIN')) {
            if ($user->tenant_id !== $currentUser->tenant_id) {
                return $this->sendError('Vous ne pouvez gérer que les utilisateurs de votre organisation', [], 403);
            }
            
            // Empêcher la modification du tenant_id par un ADMIN
            if ($request->has('tenant_id') && $request->tenant_id !== $currentUser->tenant_id) {
                return $this->sendError('Vous ne pouvez pas déplacer un utilisateur vers une autre organisation', [], 403);
            }
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
        $currentUser = auth()->user();
        $user = User::find($id);

        if (!$user) {
            return $this->sendError('User not found');
        }

        // Empêcher l'auto-suppression
        if ($user->id === $currentUser->id) {
            return $this->sendError('Vous ne pouvez pas supprimer votre propre compte', [], 403);
        }

        // Seul SUPER_ADMIN peut supprimer des utilisateurs SUPER_ADMIN
        if ($user->hasRole('SUPER_ADMIN') && !$currentUser->hasRole('SUPER_ADMIN')) {
            return $this->sendError('Vous n\'avez pas l\'autorisation de supprimer un utilisateur SUPER_ADMIN', [], 403);
        }

        // ADMIN ne peut supprimer que des utilisateurs USER dans son tenant
        if ($currentUser->hasRole('ADMIN') && !$currentUser->hasRole('SUPER_ADMIN')) {
            // Vérifier que l'utilisateur cible est dans le même tenant
            if ($user->tenant_id !== $currentUser->tenant_id) {
                return $this->sendError('Vous ne pouvez gérer que les utilisateurs de votre organisation', [], 403);
            }
            
            // ADMIN ne peut supprimer que des utilisateurs avec le rôle USER
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

        // Vérification de la hiérarchie des rôles
        $requestedRole = $request->role;
        
        // Seul SUPER_ADMIN peut assigner le rôle SUPER_ADMIN
        if ($requestedRole === 'SUPER_ADMIN' && !$currentUser->hasRole('SUPER_ADMIN')) {
            return $this->sendError('Vous n\'avez pas l\'autorisation d\'assigner le rôle SUPER_ADMIN', [], 403);
        }
        
        // ADMIN ne peut assigner que des rôles USER dans son tenant
        if ($currentUser->hasRole('ADMIN') && !$currentUser->hasRole('SUPER_ADMIN')) {
            // Vérifier que l'utilisateur cible est dans le même tenant
            if ($user->tenant_id !== $currentUser->tenant_id) {
                return $this->sendError('Vous ne pouvez gérer que les utilisateurs de votre organisation', [], 403);
            }
            
            // ADMIN ne peut assigner que le rôle USER
            if ($requestedRole !== 'USER') {
                return $this->sendError('Vous ne pouvez assigner que le rôle USER', [], 403);
            }
        }
        
        // Empêcher l'auto-promotion
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

        // Vérification de la hiérarchie des rôles
        $roleToRemove = $request->role;
        
        // Seul SUPER_ADMIN peut supprimer le rôle SUPER_ADMIN
        if ($roleToRemove === 'SUPER_ADMIN' && !$currentUser->hasRole('SUPER_ADMIN')) {
            return $this->sendError('Vous n\'avez pas l\'autorisation de supprimer le rôle SUPER_ADMIN', [], 403);
        }
        
        // ADMIN ne peut supprimer que des rôles USER dans son tenant
        if ($currentUser->hasRole('ADMIN') && !$currentUser->hasRole('SUPER_ADMIN')) {
            // Vérifier que l'utilisateur cible est dans le même tenant
            if ($user->tenant_id !== $currentUser->tenant_id) {
                return $this->sendError('Vous ne pouvez gérer que les utilisateurs de votre organisation', [], 403);
            }
            
            // ADMIN ne peut supprimer que le rôle USER
            if ($roleToRemove !== 'USER') {
                return $this->sendError('Vous ne pouvez supprimer que le rôle USER', [], 403);
            }
        }
        
        // Empêcher l'auto-dégradation du SUPER_ADMIN
        if ($user->id === $currentUser->id && $roleToRemove === 'SUPER_ADMIN') {
            return $this->sendError('Vous ne pouvez pas supprimer votre propre rôle SUPER_ADMIN', [], 403);
        }

        $user->removeRole($roleToRemove);

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
            return $this->sendError('User not found', [], 404);
        }

        // Log the incoming request for debugging
        \Log::info('Update module permissions request', [
            'user_id' => $user->id,
            'request_data' => $request->all(),
            'content_type' => $request->header('Content-Type'),
            'raw_content' => $request->getContent()
        ]);

        $validator = Validator::make($request->all(), [
            'module_permissions' => 'required|array|min:1',
            'module_permissions.*.module_code' => 'required|string',
            'module_permissions.*.module_name' => 'required|string',
            'module_permissions.*.permissions' => 'present|array',
            'module_permissions.*.is_active' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            \Log::error('Validation failed for module permissions', [
                'user_id' => $user->id,
                'errors' => $validator->errors()->toArray(),
                'request_data' => $request->all(),
                'raw_input' => $request->getContent(),
                'validation_rules' => [
                    'module_permissions' => 'required|array|min:1',
                    'module_permissions.*.module_code' => 'required|string',
                    'module_permissions.*.module_name' => 'required|string',
                    'module_permissions.*.permissions' => 'present|array',
                    'module_permissions.*.is_active' => 'required|boolean',
                ]
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Validation Error',
                'errors' => $validator->errors()->toArray(),
                'debug_data' => [
                    'received_data' => $request->all(),
                    'expected_format' => [
                        'module_permissions' => [
                            [
                                'module_code' => 'string (required)',
                                'module_name' => 'string (required)',
                                'permissions' => 'array (can be empty)',
                                'is_active' => 'boolean (required)'
                            ]
                        ]
                    ]
                ]
            ], 422);
        }

        // Store module permissions in user_module_permissions table
        DB::beginTransaction();
        try {
            // Delete existing permissions for this user
            DB::table('user_module_permissions')->where('user_id', $user->id)->delete();

            // Insert new permissions
            $insertedCount = 0;
            foreach ($request->module_permissions as $modulePermission) {
                if ($modulePermission['is_active']) {
                    DB::table('user_module_permissions')->insert([
                        'user_id' => $user->id,
                        'module_code' => $modulePermission['module_code'],
                        'module_name' => $modulePermission['module_name'],
                        'permissions' => json_encode($modulePermission['permissions'] ?? []),
                        'is_active' => $modulePermission['is_active'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    $insertedCount++;
                }
            }

            DB::commit();
            
            \Log::info('Module permissions updated successfully', [
                'user_id' => $user->id,
                'inserted_count' => $insertedCount,
                'total_modules' => count($request->module_permissions)
            ]);
            
            return $this->sendResponse([], 'Module permissions updated successfully');
        } catch (\Exception $e) {
            DB::rollback();
            \Log::error('Error updating module permissions', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
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

        \Log::info('Getting user module permissions', [
            'user_id' => $user->id,
            'found_permissions' => $userPermissions->count(),
            'permissions_data' => $userPermissions->toArray()
        ]);

        // Merge with available modules
        foreach ($userPermissions as $userPerm) {
            $moduleIndex = array_search($userPerm->module_code, array_column($availableModules, 'module_code'));
            if ($moduleIndex !== false) {
                $availableModules[$moduleIndex]['permissions'] = json_decode($userPerm->permissions, true) ?: [];
                $availableModules[$moduleIndex]['is_active'] = (bool) $userPerm->is_active;
                
                \Log::info('Merged module permission', [
                    'module_code' => $userPerm->module_code,
                    'is_active' => $availableModules[$moduleIndex]['is_active'],
                    'permissions_count' => count($availableModules[$moduleIndex]['permissions'])
                ]);
            }
        }

        \Log::info('Final available modules', [
            'user_id' => $user->id,
            'modules' => array_map(function($module) {
                return [
                    'module_code' => $module['module_code'],
                    'is_active' => $module['is_active']
                ];
            }, $availableModules)
        ]);

        return $availableModules;
    }
}
