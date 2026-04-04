<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CheckTenantModule
{
    /**
     * Handle an incoming request.
     * Vérifie si le tenant a accès au module demandé
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @param  string  $moduleCode
     * @return mixed
     */
    public function handle(Request $request, Closure $next, string $moduleCode)
    {
        $user = $request->user();

        // Super Admin a accès à tout
        if ($user && $user->hasRole('SUPER_ADMIN')) {
            return $next($request);
        }

        // Vérifier si l'utilisateur a un tenant
        if (!$user || !$user->tenant_id) {
            return response()->json([
                'success' => false,
                'message' => 'Accès refusé: Aucun tenant associé',
            ], 403);
        }

        // Vérifier si le tenant a souscrit au module et qu'il est actif
        $hasModuleAccess = DB::table('tenant_modules')
            ->join('modules', 'tenant_modules.module_id', '=', 'modules.id')
            ->where('tenant_modules.tenant_id', $user->tenant_id)
            ->where('modules.code', $moduleCode)
            ->where('tenant_modules.is_active', true)
            ->exists();

        if (!$hasModuleAccess) {
            return response()->json([
                'success' => false,
                'message' => "Accès refusé: Votre organisation n'a pas souscrit au module $moduleCode",
                'module_code' => $moduleCode,
            ], 403);
        }

        // Vérifier si l'utilisateur a la permission d'accéder au module
        $userHasPermission = DB::table('user_module_permissions')
            ->where('user_id', $user->id)
            ->where('module_code', $moduleCode)
            ->where('is_active', true)
            ->exists();

        if (!$userHasPermission) {
            return response()->json([
                'success' => false,
                'message' => "Accès refusé: Vous n'avez pas la permission d'accéder au module $moduleCode",
                'module_code' => $moduleCode,
            ], 403);
        }

        return $next($request);
    }
}
