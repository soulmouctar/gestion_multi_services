<?php

namespace App\Http\Controllers\Api;

use App\Models\Client;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ClientController extends BaseController
{
    public function index(Request $request)
    {
        $query = Client::with('tenant', 'invoices');

        if ($request->has('tenant_id')) {
            $query->where('tenant_id', $request->tenant_id);
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
            'tenant_id' => 'sometimes|exists:tenants,id',
            'name' => 'sometimes|string|max:150',
            'phone1' => 'nullable|string|max:50',
            'phone2' => 'nullable|string|max:50',
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
}
