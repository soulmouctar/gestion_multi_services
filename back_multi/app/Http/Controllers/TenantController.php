<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Tenant;
use App\Models\Module;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TenantController extends Controller
{
    /**
     * Display a listing of tenants with their modules.
     */
    public function index()
    {
        try {
            // Récupérer les tenants avec leurs modules
            $tenants = Tenant::with('modules')->get();
            
            // Formater les données pour le frontend
            $tenantData = $tenants->map(function ($tenant) {
                $modules = $tenant->modules->map(function ($module) {
                    return [
                        'id' => $module->id,
                        'code' => $module->code,
                        'name' => $module->name,
                        'icon' => 'cil-apps', // Icône par défaut
                        'enabled' => true,
                        'pivot' => [
                            'tenant_id' => $module->pivot->tenant_id,
                            'module_id' => $module->pivot->module_id,
                            'is_active' => $module->pivot->is_active
                        ]
                    ];
                });

                return [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                    'email' => $tenant->email,
                    'phone' => $tenant->phone,
                    'subscription_status' => $tenant->subscription_status,
                    'modules' => $modules,
                    'users' => [],
                    'subscriptions' => [],
                    'created_at' => $tenant->created_at,
                    'updated_at' => $tenant->updated_at
                ];
            });
            
            return response()->json([
                'success' => true,
                'data' => $tenantData,
                'message' => 'Tenants retrieved successfully from database'
            ]);
            
        } catch (\Exception $e) {
            Log::error('Error retrieving tenants: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Database error: ' . $e->getMessage(),
                'trace' => config('app.debug') ? $e->getTraceAsString() : null
            ], 500);
        }
    }

    /**
     * Store a newly created tenant in storage.
     */
    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'name' => 'required|string|max:150',
                'email' => 'required|email|max:150|unique:tenants,email',
                'phone' => 'nullable|string|max:50',
                'subscription_status' => 'required|in:ACTIVE,SUSPENDED,EXPIRED'
            ]);

            $tenant = Tenant::create($validated);
            
            return response()->json([
                'success' => true,
                'data' => $tenant,
                'message' => 'Tenant created successfully'
            ], 201);
            
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $e->errors()
            ], 422);
            
        } catch (\Exception $e) {
            Log::error('Error creating tenant: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Error creating tenant: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update the specified tenant in storage.
     */
    public function update(Request $request, $id)
    {
        try {
            $tenant = Tenant::findOrFail($id);
            
            $validated = $request->validate([
                'name' => 'required|string|max:150',
                'email' => 'required|email|max:150|unique:tenants,email,'.$id,
                'phone' => 'nullable|string|max:50',
                'subscription_status' => 'required|in:ACTIVE,SUSPENDED,EXPIRED'
            ]);

            $tenant->update($validated);
            
            return response()->json([
                'success' => true,
                'data' => $tenant,
                'message' => 'Tenant updated successfully'
            ]);
            
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant not found'
            ], 404);
            
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $e->errors()
            ], 422);
            
        } catch (\Exception $e) {
            Log::error('Error updating tenant: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Error updating tenant: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified tenant from storage.
     */
    public function destroy($id)
    {
        try {
            $tenant = Tenant::findOrFail($id);
            
            // Supprimer les relations avec les modules d'abord
            DB::table('tenant_modules')->where('tenant_id', $id)->delete();
            
            // Supprimer le tenant
            $tenant->delete();
            
            return response()->json([
                'success' => true,
                'message' => 'Tenant deleted successfully'
            ]);
            
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant not found'
            ], 404);
            
        } catch (\Exception $e) {
            Log::error('Error deleting tenant: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Error deleting tenant: ' . $e->getMessage()
            ], 500);
        }
    }
}
