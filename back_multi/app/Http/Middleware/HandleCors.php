<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class HandleCors
{
    protected array $allowedOrigins = [
        'http://localhost:4200',
        'http://127.0.0.1:4200',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://matkolla.ddevstock.com',
    ];

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
        if ($origin && in_array($origin, $this->allowedOrigins)) {
            $response->headers->set('Access-Control-Allow-Origin', $origin);
        }

        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
        $response->headers->set('Access-Control-Allow-Credentials', 'true');
        $response->headers->set('Access-Control-Max-Age', '86400');
    }
}
