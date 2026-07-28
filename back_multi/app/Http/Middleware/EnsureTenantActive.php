<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Verifie que le tenant du user authentifie est ACTIVE.
 * Si le tenant est SUSPENDED, rejet 403 et revoque le token courant.
 * SUPER_ADMIN bypass.
 */
class EnsureTenantActive
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (!$user) {
            return $next($request);
        }

        if (method_exists($user, 'hasRole') && $user->hasRole('SUPER_ADMIN')) {
            return $next($request);
        }

        if ($user->tenant_id) {
            $tenant = $user->tenant()->first();
            if ($tenant && strtoupper($tenant->subscription_status) === 'SUSPENDED') {
                // Revocation immediate du token courant
                if ($request->user()->currentAccessToken()) {
                    $request->user()->currentAccessToken()->delete();
                }
                return response()->json([
                    'success' => false,
                    'message' => 'Organisation suspendue. Accès refusé.',
                    'data'    => ['tenant_status' => 'SUSPENDED'],
                ], 403);
            }
        }

        return $next($request);
    }
}
