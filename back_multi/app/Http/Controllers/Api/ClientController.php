<?php

namespace App\Http\Controllers\Api;

use App\Models\Client;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;

class ClientController extends BaseController
{
    public function index(Request $request)
    {
        $user = Auth::user();
        $tenantId = $user->tenant_id ?? $request->get('tenant_id');
        
        if (!$tenantId && !$user->hasRole('SUPER_ADMIN')) {
            return $this->sendError('Tenant ID required', [], 400);
        }

        $query = Client::with('tenant', 'invoices');

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        $clients = $query->paginate(15);
        return $this->sendResponse($clients, 'Clients retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tenant_id' => 'required|exists:tenants,id',
            'name' => 'required|string|max:150',
            'phone1' => 'nullable|string|max:50',
            'phone2' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $client = Client::create($request->all());

        return $this->sendResponse($client, 'Client created successfully', 201);
    }

    public function show($id)
    {
        $client = Client::with('tenant', 'invoices')->find($id);

        if (!$client) {
            return $this->sendError('Client not found');
        }

        return $this->sendResponse($client, 'Client retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $client = Client::find($id);

        if (!$client) {
            return $this->sendError('Client not found');
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:150',
            'phone1' => 'sometimes|string|max:50',
            'phone2' => 'sometimes|string|max:50',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $client->update($request->all());

        return $this->sendResponse($client, 'Client updated successfully');
    }

    public function destroy($id)
    {
        $client = Client::find($id);

        if (!$client) {
            return $this->sendError('Client not found');
        }

        $client->delete();

        return $this->sendResponse([], 'Client deleted successfully');
    }

    /**
     * Get client statistics
     */
    public function getStatistics(Request $request)
    {
        try {
            $user = Auth::user();
            $tenantId = $user->tenant_id ?? $request->get('tenant_id');
            
            if (!$tenantId && !$user->hasRole('SUPER_ADMIN')) {
                return $this->sendError('Tenant ID required', [], 400);
            }

            $query = Client::query();
            
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }

            $stats = [
                'total_clients' => $query->count(),
                'active_clients' => $query->whereHas('invoices', function($q) {
                    $q->where('created_at', '>=', now()->subMonths(6));
                })->count(),
                'new_clients_this_month' => $query->where('created_at', '>=', now()->startOfMonth())->count(),
                'new_clients_this_year' => $query->where('created_at', '>=', now()->startOfYear())->count()
            ];

            return $this->sendResponse($stats, 'Client statistics retrieved successfully');
            
        } catch (\Exception $e) {
            \Log::error('Error retrieving client statistics: ' . $e->getMessage());
            return $this->sendError('Error retrieving statistics', [], 500);
        }
    }
}
