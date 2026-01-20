<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class TenantMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if ($user && $user->tenant_id) {
            // Store tenant_id in request for use in controllers
            $request->merge(['current_tenant_id' => $user->tenant_id]);
        }

        return $next($request);
    }
}
