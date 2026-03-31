<?php

namespace App\Http\Controllers\Api;

use App\Models\Currency;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;

class CurrencyController extends BaseController
{
    public function index(Request $request)
    {
        $user = Auth::user();
        $tenantId = $user->tenant_id;

        $query = Currency::where('tenant_id', $tenantId);

        // Filtrer par statut actif si spécifié
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        // Filtrer par défaut si spécifié
        if ($request->has('is_default')) {
            $query->where('is_default', $request->boolean('is_default'));
        }

        $currencies = $query->orderBy('is_default', 'desc')
                           ->orderBy('code')
                           ->get();

        return $this->sendResponse($currencies, 'Currencies retrieved successfully');
    }

    public function store(Request $request)
    {
        $user = Auth::user();
        $tenantId = $user->tenant_id;

        $validator = Validator::make($request->all(), [
            'code' => 'required|string|max:3|min:3',
            'name' => 'required|string|max:255',
            'symbol' => 'required|string|max:10',
            'exchange_rate' => 'required|numeric|min:0.0001',
            'is_default' => 'boolean',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $data = $request->all();
        $data['tenant_id'] = $tenantId;
        $data['code'] = strtoupper($data['code']);

        // Vérifier l'unicité du code pour ce tenant
        $existingCurrency = Currency::where('tenant_id', $tenantId)
                                   ->where('code', $data['code'])
                                   ->first();

        if ($existingCurrency) {
            return $this->sendError('Currency code already exists for this tenant', [], 422);
        }

        // Si cette devise est définie comme par défaut, retirer le statut par défaut des autres
        if ($request->boolean('is_default')) {
            Currency::where('tenant_id', $tenantId)
                    ->update(['is_default' => false]);
        }

        $currency = Currency::create($data);

        return $this->sendResponse($currency, 'Currency created successfully', 201);
    }

    public function show($id)
    {
        $user = Auth::user();
        $tenantId = $user->tenant_id;

        $currency = Currency::where('tenant_id', $tenantId)->find($id);

        if (!$currency) {
            return $this->sendError('Currency not found', [], 404);
        }

        return $this->sendResponse($currency, 'Currency retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $user = Auth::user();
        $tenantId = $user->tenant_id;

        $currency = Currency::where('tenant_id', $tenantId)->find($id);

        if (!$currency) {
            return $this->sendError('Currency not found', [], 404);
        }

        $validator = Validator::make($request->all(), [
            'code' => 'sometimes|string|max:3|min:3',
            'name' => 'sometimes|string|max:255',
            'symbol' => 'sometimes|string|max:10',
            'exchange_rate' => 'sometimes|numeric|min:0.0001',
            'is_default' => 'boolean',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $data = $request->all();
        if (isset($data['code'])) {
            $data['code'] = strtoupper($data['code']);
            
            // Vérifier l'unicité du code pour ce tenant (sauf pour la devise actuelle)
            $existingCurrency = Currency::where('tenant_id', $tenantId)
                                       ->where('code', $data['code'])
                                       ->where('id', '!=', $id)
                                       ->first();

            if ($existingCurrency) {
                return $this->sendError('Currency code already exists for this tenant', [], 422);
            }
        }

        // Si cette devise est définie comme par défaut, retirer le statut par défaut des autres
        if ($request->boolean('is_default')) {
            Currency::where('tenant_id', $tenantId)
                    ->where('id', '!=', $id)
                    ->update(['is_default' => false]);
        }

        $currency->update($data);

        return $this->sendResponse($currency, 'Currency updated successfully');
    }

    public function destroy($id)
    {
        $user = Auth::user();
        $tenantId = $user->tenant_id;

        $currency = Currency::where('tenant_id', $tenantId)->find($id);

        if (!$currency) {
            return $this->sendError('Currency not found', [], 404);
        }

        // Empêcher la suppression de la devise par défaut s'il n'y en a qu'une
        if ($currency->is_default) {
            $currencyCount = Currency::where('tenant_id', $tenantId)->count();
            if ($currencyCount <= 1) {
                return $this->sendError('Cannot delete the only currency', [], 400);
            }
        }

        $currency->delete();

        return $this->sendResponse([], 'Currency deleted successfully');
    }

    public function setAsDefault($id)
    {
        $user = Auth::user();
        $tenantId = $user->tenant_id;

        $currency = Currency::where('tenant_id', $tenantId)->find($id);

        if (!$currency) {
            return $this->sendError('Currency not found', [], 404);
        }

        // Retirer le statut par défaut des autres devises
        Currency::where('tenant_id', $tenantId)
                ->update(['is_default' => false]);

        // Définir cette devise comme par défaut et l'activer
        $currency->update(['is_default' => true, 'is_active' => true]);

        return $this->sendResponse($currency, 'Currency set as default successfully');
    }

    public function toggleStatus($id)
    {
        $user = Auth::user();
        $tenantId = $user->tenant_id;

        $currency = Currency::where('tenant_id', $tenantId)->find($id);

        if (!$currency) {
            return $this->sendError('Currency not found', [], 404);
        }

        // Empêcher la désactivation de la devise par défaut
        if ($currency->is_default && $currency->is_active) {
            return $this->sendError('Cannot deactivate the default currency', [], 400);
        }

        $currency->update(['is_active' => !$currency->is_active]);

        return $this->sendResponse($currency, 'Currency status updated successfully');
    }

    public function publicToggleStatus($id)
    {
        // Use fixed tenant_id for public testing
        $tenantId = 1;

        $currency = Currency::where('tenant_id', $tenantId)->find($id);

        if (!$currency) {
            return $this->sendError('Currency not found', [], 404);
        }

        // Allow toggling for testing, but warn about default currency
        if ($currency->is_default && $currency->is_active) {
            return $this->sendError('Cannot deactivate the default currency. Please set another currency as default first.', [], 400);
        }

        $currency->update(['is_active' => !$currency->is_active]);

        return $this->sendResponse($currency, 'Currency status updated successfully');
    }

    public function publicIndex(Request $request)
    {
        // Use fixed tenant_id for public testing
        $tenantId = 1;

        $query = Currency::where('tenant_id', $tenantId);

        // Filtrer par statut actif si spécifié
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        // Filtrer par défaut si spécifié
        if ($request->has('is_default')) {
            $query->where('is_default', $request->boolean('is_default'));
        }

        $currencies = $query->orderBy('is_default', 'desc')
                           ->orderBy('code')
                           ->get();

        return $this->sendResponse($currencies, 'Currencies retrieved successfully');
    }

    public function publicStore(Request $request)
    {
        $tenantId = $request->get('tenant_id', 1);
        
        $validator = Validator::make($request->all(), [
            'code' => 'required|string|max:10',
            'name' => 'required|string|max:100',
            'symbol' => 'required|string|max:10',
            'exchange_rate' => 'required|numeric|min:0',
            'is_default' => 'boolean',
            'is_active' => 'boolean'
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $code = strtoupper($request->code);
        
        // Check uniqueness per tenant
        $existingCurrency = Currency::where('tenant_id', $tenantId)
                                   ->where('code', $code)
                                   ->first();

        if ($existingCurrency) {
            return $this->sendError('Ce code devise existe déjà', [], 422);
        }

        // If this is set as default, unset other defaults for this tenant
        if ($request->get('is_default', false)) {
            Currency::where('tenant_id', $tenantId)->update(['is_default' => false]);
        }

        $data = $request->all();
        $data['tenant_id'] = $tenantId;
        $data['code'] = $code;
        
        $currency = Currency::create($data);

        return $this->sendResponse($currency, 'Currency created successfully', 201);
    }

    public function publicSetAsDefault($id)
    {
        // Use fixed tenant_id for public testing
        $tenantId = 1;

        $currency = Currency::where('tenant_id', $tenantId)->find($id);

        if (!$currency) {
            return $this->sendError('Currency not found', [], 404);
        }

        // Unset all other defaults for this tenant
        Currency::where('tenant_id', $tenantId)->update(['is_default' => false]);

        // Set this currency as default
        $currency->update(['is_default' => true, 'is_active' => true]);

        return $this->sendResponse($currency, 'Currency set as default successfully');
    }

    public function publicUpdate(Request $request, $id)
    {
        $tenantId = $request->get('tenant_id', 1);

        $currency = Currency::where('tenant_id', $tenantId)->find($id);

        if (!$currency) {
            return $this->sendError('Currency not found', [], 404);
        }

        $validator = Validator::make($request->all(), [
            'code' => 'sometimes|string|max:10',
            'name' => 'sometimes|string|max:100',
            'symbol' => 'sometimes|string|max:10',
            'exchange_rate' => 'sometimes|numeric|min:0',
            'is_default' => 'boolean',
            'is_active' => 'boolean'
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $data = $request->all();
        if (isset($data['code'])) {
            $data['code'] = strtoupper($data['code']);
            
            // Check uniqueness per tenant (except current)
            $existingCurrency = Currency::where('tenant_id', $tenantId)
                                       ->where('code', $data['code'])
                                       ->where('id', '!=', $id)
                                       ->first();

            if ($existingCurrency) {
                return $this->sendError('Ce code devise existe déjà', [], 422);
            }
        }

        // If this is set as default, unset other defaults
        if ($request->boolean('is_default')) {
            Currency::where('tenant_id', $tenantId)
                    ->where('id', '!=', $id)
                    ->update(['is_default' => false]);
        }

        $currency->update($data);

        return $this->sendResponse($currency, 'Currency updated successfully');
    }

    public function publicDestroy($id)
    {
        $tenantId = 1;

        $currency = Currency::where('tenant_id', $tenantId)->find($id);

        if (!$currency) {
            return $this->sendError('Currency not found', [], 404);
        }

        // Prevent deleting default currency if it's the only one
        if ($currency->is_default) {
            $currencyCount = Currency::where('tenant_id', $tenantId)->count();
            if ($currencyCount <= 1) {
                return $this->sendError('Impossible de supprimer la seule devise', [], 400);
            }
        }

        $currency->delete();

        return $this->sendResponse([], 'Currency deleted successfully');
    }
}
