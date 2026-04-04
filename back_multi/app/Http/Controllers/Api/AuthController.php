<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Auth\Events\PasswordReset;

class AuthController extends BaseController
{
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:150',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|min:8|confirmed',
            'tenant_id' => 'nullable|exists:tenants,id',
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

        $user->assignRole('USER');

        $token = $user->createToken('auth_token')->plainTextToken;

        return $this->sendResponse([
            'user' => $user,
            'token' => $token,
            'token_type' => 'Bearer',
        ], 'User registered successfully', 201);
    }

    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        try {
            if (!Auth::attempt($request->only('email', 'password'))) {
                return $this->sendError('Invalid credentials', [], 401);
            }

            $user = User::where('email', $request->email)->firstOrFail();
            
            // Check if user is active
            if (isset($user->is_active) && !$user->is_active) {
                return $this->sendError('Account is deactivated', [], 403);
            }

            $token = $user->createToken('auth_token')->plainTextToken;

            // Load relationships with error handling
            $userData = $user->load(['tenant.modules', 'roles', 'permissions']);

            // Get active modules for the tenant
            $activeModules = [];
            if ($userData->tenant) {
                $activeModules = $userData->tenant->modules()
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
            }

            // Get user's module permissions
            $userModulePermissions = DB::table('user_module_permissions')
                ->where('user_id', $user->id)
                ->where('is_active', true)
                ->get()
                ->map(function($perm) {
                    return [
                        'module_code' => $perm->module_code,
                        'module_name' => $perm->module_name,
                        'permissions' => json_decode($perm->permissions, true),
                        'is_active' => (bool) $perm->is_active
                    ];
                });

            return $this->sendResponse([
                'user' => $userData,
                'token' => $token,
                'token_type' => 'Bearer',
                'isAuthenticated' => true,
                'tenant_active_modules' => $activeModules,
                'user_module_permissions' => $userModulePermissions
            ], 'Login successful');
            
        } catch (\Exception $e) {
            \Log::error('Login error: ' . $e->getMessage());
            return $this->sendError('Login failed', ['error' => $e->getMessage()], 500);
        }
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return $this->sendResponse([], 'Logged out successfully');
    }

    public function me(Request $request)
    {
        $user = $request->user()->load('tenant.modules', 'roles', 'permissions');

        return $this->sendResponse($user, 'User profile retrieved');
    }

    public function refresh(Request $request)
    {
        $user = $request->user();
        $user->currentAccessToken()->delete();
        $token = $user->createToken('auth_token')->plainTextToken;

        return $this->sendResponse([
            'token' => $token,
            'token_type' => 'Bearer',
        ], 'Token refreshed');
    }

    public function forgotPassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|exists:users,email',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $status = Password::sendResetLink(
            $request->only('email')
        );

        if ($status === Password::RESET_LINK_SENT) {
            return $this->sendResponse([], 'Lien de réinitialisation envoyé par email');
        }

        return $this->sendError('Erreur lors de l\'envoi du lien de réinitialisation', [], 500);
    }

    public function resetPassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'token' => 'required',
            'email' => 'required|email',
            'password' => 'required|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => Hash::make($password)
                ])->setRememberToken(Str::random(60));

                $user->save();

                event(new PasswordReset($user));
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return $this->sendResponse([], 'Mot de passe réinitialisé avec succès');
        }

        return $this->sendError('Erreur lors de la réinitialisation du mot de passe', ['email' => [__($status)]], 400);
    }
}
