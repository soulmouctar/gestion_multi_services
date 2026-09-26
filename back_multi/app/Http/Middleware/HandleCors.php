<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class HandleCors
{
    public function handle(Request $request, Closure $next)
    {
        $origin = $request->headers->get('Origin');

        if ($request->isMethod('OPTIONS')) {
            $response = response('', 204);
            $this->addCorsHeaders($response, $origin);
            return $response;
        }

        $response = $next($request);
        $this->addCorsHeaders($response, $origin);

        return $response;
    }

    private function addCorsHeaders($response, ?string $origin): void
    {
        if ($origin && $this->isOriginAllowed($origin)) {
            $response->headers->set('Access-Control-Allow-Origin', $origin);
            $response->headers->set('Vary', 'Origin');
        }

        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
        $response->headers->set('Access-Control-Allow-Credentials', 'true');
        $response->headers->set('Access-Control-Max-Age', '86400');
    }

    private function isOriginAllowed(string $origin): bool
    {
        $allowed = config('cors.allowed_origins', []);

        if (in_array('*', $allowed, true) || in_array($origin, $allowed, true)) {
            return true;
        }

        foreach (config('cors.allowed_origins_patterns', []) as $pattern) {
            if (preg_match($pattern, $origin)) {
                return true;
            }
        }

        // En dev, tout port local est accepte (ng serve peut utiliser un port aleatoire).
        if (!app()->environment('production')
            && preg_match('#^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$#', $origin)) {
            return true;
        }

        return false;
    }
}
