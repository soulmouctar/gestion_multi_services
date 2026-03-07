<?php

namespace App\Http\Controllers\Api;

use App\Models\InvoiceHeader;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class InvoiceHeaderController extends BaseController
{
    /**
     * Display a listing of invoice headers for the authenticated user's tenant.
     */
    public function index(Request $request)
    {
        try {
            $tenantId = Auth::user()->tenant_id ?? $request->get('tenant_id');
            
            if (!$tenantId && !Auth::user()->hasRole('SUPER_ADMIN')) {
                return $this->sendError('Tenant ID requis', [], 400);
            }

            $query = InvoiceHeader::query();
            
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }

            // Filtrer par défaut si spécifié
            if ($request->has('is_default')) {
                $query->where('is_default', $request->boolean('is_default'));
            }

            $headers = $query->orderBy('is_default', 'desc')
                             ->orderBy('name')
                             ->get();

            return $this->sendResponse($headers, 'En-têtes de factures récupérés avec succès');

        } catch (\Exception $e) {
            \Log::error('Erreur lors de la récupération des en-têtes: ' . $e->getMessage());
            return $this->sendError('Erreur lors de la récupération des en-têtes', [], 500);
        }
    }

    public function store(Request $request)
    {
        $user = Auth::user();
        $tenantId = $user->tenant_id;

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'logo_url' => 'nullable|string|max:500',
            'company_name' => 'required|string|max:255',
            'address' => 'required|string',
            'city' => 'required|string|max:100',
            'postal_code' => 'required|string|max:20',
            'country' => 'required|string|max:100',
            'phone' => 'required|string|max:50',
            'email' => 'required|email|max:255',
            'website' => 'nullable|string|max:255',
            'tax_number' => 'nullable|string|max:50',
            'registration_number' => 'nullable|string|max:50',
            'bank_details' => 'nullable|string',
            'footer_text' => 'nullable|string',
            'is_default' => 'boolean',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $data = $request->all();
        $data['tenant_id'] = $tenantId;

        // Si cet en-tête est défini comme par défaut, retirer le statut par défaut des autres
        if ($request->boolean('is_default')) {
            InvoiceHeader::where('tenant_id', $tenantId)
                         ->update(['is_default' => false]);
        }

        $header = InvoiceHeader::create($data);

        return $this->sendResponse($header, 'Invoice header created successfully', 201);
    }

    public function show($id)
    {
        $user = Auth::user();
        $tenantId = $user->tenant_id;

        $header = InvoiceHeader::where('tenant_id', $tenantId)->find($id);

        if (!$header) {
            return $this->sendError('Invoice header not found', [], 404);
        }

        return $this->sendResponse($header, 'Invoice header retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $user = Auth::user();
        $tenantId = $user->tenant_id;

        $header = InvoiceHeader::where('tenant_id', $tenantId)->find($id);

        if (!$header) {
            return $this->sendError('Invoice header not found', [], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'logo_url' => 'nullable|string|max:500',
            'company_name' => 'sometimes|string|max:255',
            'address' => 'sometimes|string',
            'city' => 'sometimes|string|max:100',
            'postal_code' => 'sometimes|string|max:20',
            'country' => 'sometimes|string|max:100',
            'phone' => 'sometimes|string|max:50',
            'email' => 'sometimes|email|max:255',
            'website' => 'nullable|string|max:255',
            'tax_number' => 'nullable|string|max:50',
            'registration_number' => 'nullable|string|max:50',
            'bank_details' => 'nullable|string',
            'footer_text' => 'nullable|string',
            'is_default' => 'boolean',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        // Si cet en-tête est défini comme par défaut, retirer le statut par défaut des autres
        if ($request->boolean('is_default')) {
            InvoiceHeader::where('tenant_id', $tenantId)
                         ->where('id', '!=', $id)
                         ->update(['is_default' => false]);
        }

        $header->update($request->all());

        return $this->sendResponse($header, 'Invoice header updated successfully');
    }

    public function destroy($id)
    {
        $user = Auth::user();
        $tenantId = $user->tenant_id;

        $header = InvoiceHeader::where('tenant_id', $tenantId)->find($id);

        if (!$header) {
            return $this->sendError('Invoice header not found', [], 404);
        }

        // Empêcher la suppression de l'en-tête par défaut s'il n'y en a qu'un
        if ($header->is_default) {
            $headerCount = InvoiceHeader::where('tenant_id', $tenantId)->count();
            if ($headerCount <= 1) {
                return $this->sendError('Cannot delete the only invoice header', [], 400);
            }
        }

        $header->delete();

        return $this->sendResponse([], 'Invoice header deleted successfully');
    }

    public function setAsDefault($id)
    {
        $user = Auth::user();
        $tenantId = $user->tenant_id;

        $header = InvoiceHeader::where('tenant_id', $tenantId)->find($id);

        if (!$header) {
            return $this->sendError('Invoice header not found', [], 404);
        }

        // Retirer le statut par défaut des autres en-têtes
        InvoiceHeader::where('tenant_id', $tenantId)
                     ->update(['is_default' => false]);

        // Définir cet en-tête comme par défaut
        $header->update(['is_default' => true]);

        return $this->sendResponse($header, 'Invoice header set as default successfully');
    }

    public function duplicate($id)
    {
        $user = Auth::user();
        $tenantId = $user->tenant_id;

        $originalHeader = InvoiceHeader::where('tenant_id', $tenantId)->find($id);

        if (!$originalHeader) {
            return $this->sendError('Invoice header not found', [], 404);
        }

        // Créer une copie
        $duplicateData = $originalHeader->toArray();
        unset($duplicateData['id'], $duplicateData['created_at'], $duplicateData['updated_at']);
        $duplicateData['name'] = $originalHeader->name . ' (Copie)';
        $duplicateData['is_default'] = false;

        $duplicateHeader = InvoiceHeader::create($duplicateData);

        return $this->sendResponse($duplicateHeader, 'Invoice header duplicated successfully', 201);
    }
}
