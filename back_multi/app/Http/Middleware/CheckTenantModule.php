<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CheckTenantModule
{
    public function handle(Request $request, Closure $next, string $moduleCode)
    {
        $user = $request->user();

        if ($user && $user->hasRole('SUPER_ADMIN')) {
            return $next($request);
        }

        if (!$user || !$user->tenant_id) {
            return response()->json([
                'success' => false,
                'message' => 'Accès refusé: Aucun tenant associé',
            ], 403);
        }

        // Vérifier en une seule requête si le tenant a souscrit au module ET que l'utilisateur a la permission
        $tenantHasModule = DB::table('tenant_modules')
            ->join('modules', 'tenant_modules.module_id', '=', 'modules.id')
            ->where('tenant_modules.tenant_id', $user->tenant_id)
            ->where('modules.code', $moduleCode)
            ->where('tenant_modules.is_active', true)
            ->exists();

        if (!$tenantHasModule) {
            return response()->json([
                'success'     => false,
                'message'     => "Accès refusé: Votre organisation n'a pas souscrit au module $moduleCode",
                'module_code' => $moduleCode,
            ], 403);
        }

        // ADMIN peut accéder à tous les modules actifs du tenant (pour la gestion des utilisateurs)
        if ($user->hasRole('ADMIN')) {
            return $next($request);
        }

        $userHasPermission = DB::table('user_module_permissions')
            ->where('user_id', $user->id)
            ->where('module_code', $moduleCode)
            ->where('is_active', true)
            ->exists();

        if (!$userHasPermission) {
            return response()->json([
                'success'     => false,
                'message'     => "Accès refusé: Vous n'avez pas la permission d'accéder au module $moduleCode",
                'module_code' => $moduleCode,
            ], 403);
        }

        return $next($request);
    }
}