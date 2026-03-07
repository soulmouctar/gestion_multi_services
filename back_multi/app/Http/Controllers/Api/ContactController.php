<?php

namespace App\Http\Controllers\Api;

use App\Models\Contact;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ContactController extends BaseController
{
    /**
     * Display a listing of contacts for the authenticated user's tenant.
     */
    public function index(Request $request)
    {
        try {
            $tenantId = Auth::user()->tenant_id ?? $request->get('tenant_id');
            
            if (!$tenantId && !Auth::user()->hasRole('SUPER_ADMIN')) {
                return $this->sendError('Tenant ID requis', [], 400);
            }

            $query = Contact::query();
            
            if ($tenantId) {
                $query->forTenant($tenantId);
            }

            // Filtres
            if ($request->has('type')) {
                $query->ofType($request->get('type'));
            }

            if ($request->has('active')) {
                if ($request->get('active') === 'true') {
                    $query->active();
                }
            }

            // Tri
            $sortBy = $request->get('sort_by', 'created_at');
            $sortOrder = $request->get('sort_order', 'desc');
            $query->orderBy($sortBy, $sortOrder);

            // Pagination
            $perPage = $request->get('per_page', 15);
            $contacts = $query->with('tenant')->paginate($perPage);

            return $this->sendResponse($contacts, 'Contacts récupérés avec succès');

        } catch (\Exception $e) {
            \Log::error('Erreur lors de la récupération des contacts: ' . $e->getMessage());
            return $this->sendError('Erreur lors de la récupération des contacts', [], 500);
        }
    }

    /**
     * Store a newly created contact.
     */
    public function store(Request $request)
    {
        try {
            $tenantId = Auth::user()->tenant_id ?? $request->get('tenant_id');
            
            if (!$tenantId && !Auth::user()->hasRole('SUPER_ADMIN')) {
                return $this->sendError('Tenant ID requis', [], 400);
            }

            $validator = Validator::make($request->all(), [
                'type' => 'required|string|in:phone,email,address,website,fax,whatsapp,telegram',
                'name' => 'required|string|max:100',
                'value' => 'required|string|max:255',
                'description' => 'nullable|string|max:255',
                'is_default' => 'boolean',
                'is_active' => 'boolean'
            ]);

            if ($validator->fails()) {
                return $this->sendError('Erreur de validation', $validator->errors()->toArray(), 422);
            }

            DB::beginTransaction();

            $contactData = $validator->validated();
            $contactData['tenant_id'] = $tenantId;

            // Si ce contact est défini comme par défaut, désactiver les autres contacts par défaut du même type
            if ($contactData['is_default'] ?? false) {
                Contact::forTenant($tenantId)
                    ->ofType($contactData['type'])
                    ->where('is_default', true)
                    ->update(['is_default' => false]);
            }

            $contact = Contact::create($contactData);

            DB::commit();

            return $this->sendResponse($contact->load('tenant'), 'Contact créé avec succès', 201);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Erreur lors de la création du contact: ' . $e->getMessage());
            return $this->sendError('Erreur lors de la création du contact', [], 500);
        }
    }

    /**
     * Display the specified contact.
     */
    public function show($id)
    {
        try {
            $tenantId = Auth::user()->tenant_id;
            
            $query = Contact::with('tenant');
            
            if ($tenantId && !Auth::user()->hasRole('SUPER_ADMIN')) {
                $query->forTenant($tenantId);
            }
            
            $contact = $query->findOrFail($id);

            return $this->sendResponse($contact, 'Contact récupéré avec succès');

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->sendError('Contact non trouvé', [], 404);
        } catch (\Exception $e) {
            \Log::error('Erreur lors de la récupération du contact: ' . $e->getMessage());
            return $this->sendError('Erreur lors de la récupération du contact', [], 500);
        }
    }

    /**
     * Update the specified contact.
     */
    public function update(Request $request, $id)
    {
        try {
            $tenantId = Auth::user()->tenant_id;
            
            $query = Contact::query();
            
            if ($tenantId && !Auth::user()->hasRole('SUPER_ADMIN')) {
                $query->forTenant($tenantId);
            }
            
            $contact = $query->findOrFail($id);

            $validator = Validator::make($request->all(), [
                'type' => 'sometimes|required|string|in:phone,email,address,website,fax,whatsapp,telegram',
                'name' => 'sometimes|required|string|max:100',
                'value' => 'sometimes|required|string|max:255',
                'description' => 'nullable|string|max:255',
                'is_default' => 'boolean',
                'is_active' => 'boolean'
            ]);

            if ($validator->fails()) {
                return $this->sendError('Erreur de validation', $validator->errors()->toArray(), 422);
            }

            DB::beginTransaction();

            $contactData = $validator->validated();

            // Si ce contact est défini comme par défaut, désactiver les autres contacts par défaut du même type
            if (($contactData['is_default'] ?? false) && $contact->type === ($contactData['type'] ?? $contact->type)) {
                Contact::forTenant($contact->tenant_id)
                    ->ofType($contactData['type'] ?? $contact->type)
                    ->where('id', '!=', $contact->id)
                    ->where('is_default', true)
                    ->update(['is_default' => false]);
            }

            $contact->update($contactData);

            DB::commit();

            return $this->sendResponse($contact->load('tenant'), 'Contact mis à jour avec succès');

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->sendError('Contact non trouvé', [], 404);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Erreur lors de la mise à jour du contact: ' . $e->getMessage());
            return $this->sendError('Erreur lors de la mise à jour du contact', [], 500);
        }
    }

    /**
     * Remove the specified contact.
     */
    public function destroy($id)
    {
        try {
            $tenantId = Auth::user()->tenant_id;
            
            $query = Contact::query();
            
            if ($tenantId && !Auth::user()->hasRole('SUPER_ADMIN')) {
                $query->forTenant($tenantId);
            }
            
            $contact = $query->findOrFail($id);
            $contact->delete();

            return $this->sendResponse(null, 'Contact supprimé avec succès');

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->sendError('Contact non trouvé', [], 404);
        } catch (\Exception $e) {
            \Log::error('Erreur lors de la suppression du contact: ' . $e->getMessage());
            return $this->sendError('Erreur lors de la suppression du contact', [], 500);
        }
    }

    /**
     * Set a contact as default for its type.
     */
    public function setAsDefault($id)
    {
        try {
            $tenantId = Auth::user()->tenant_id;
            
            $query = Contact::query();
            
            if ($tenantId && !Auth::user()->hasRole('SUPER_ADMIN')) {
                $query->forTenant($tenantId);
            }
            
            $contact = $query->findOrFail($id);

            DB::beginTransaction();

            // Désactiver tous les autres contacts par défaut du même type
            Contact::forTenant($contact->tenant_id)
                ->ofType($contact->type)
                ->where('id', '!=', $contact->id)
                ->update(['is_default' => false]);

            // Activer ce contact comme par défaut
            $contact->update(['is_default' => true]);

            DB::commit();

            return $this->sendResponse($contact->load('tenant'), 'Contact défini comme par défaut avec succès');

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->sendError('Contact non trouvé', [], 404);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Erreur lors de la définition du contact par défaut: ' . $e->getMessage());
            return $this->sendError('Erreur lors de la définition du contact par défaut', [], 500);
        }
    }

    /**
     * Get available contact types.
     */
    public function getContactTypes()
    {
        try {
            $types = Contact::getContactTypes();
            return $this->sendResponse($types, 'Types de contact récupérés avec succès');
        } catch (\Exception $e) {
            \Log::error('Erreur lors de la récupération des types de contact: ' . $e->getMessage());
            return $this->sendError('Erreur lors de la récupération des types de contact', [], 500);
        }
    }
}
