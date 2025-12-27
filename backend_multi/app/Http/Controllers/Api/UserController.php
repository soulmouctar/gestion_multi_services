<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

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
}
