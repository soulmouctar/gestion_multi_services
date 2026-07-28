<?php

namespace App\Http\Controllers\Api;

use App\Models\Client;
use App\Models\ClientCurrencyAccount;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class ClientCurrencyAccountController extends BaseController
{
    /**
     * Liste tous les comptes-devises d'un client (GNF + USD + EUR…).
     */
    public function indexForClient(Request $request, $clientId)
    {
        $user   = Auth::user();
        $client = Client::find($clientId);
        if (!$client) {
            return $this->sendError('Client not found', [], 404);
        }
        if (!$user->hasRole('SUPER_ADMIN') && $client->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        // S'assurer que le client a au moins un compte GNF (principal) initialise
        $client->getAccount('GNF');

        $accounts = ClientCurrencyAccount::where('client_id', $client->id)
            ->orderByDesc('is_primary')
            ->orderBy('currency')
            ->get();

        return $this->sendResponse($accounts, 'Currency accounts retrieved successfully');
    }

    /**
     * Cree un compte-devise pour un client (ex. ouverture compte USD ou EUR).
     */
    public function store(Request $request)
    {
        $user = Auth::user();

        $validator = Validator::make($request->all(), [
            'client_id' => 'required|exists:clients,id',
            'currency'  => 'required|string|max:10',
            'label'     => 'nullable|string|max:150',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $client = Client::find($request->client_id);
        if (!$user->hasRole('SUPER_ADMIN') && $client->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $currency = strtoupper($request->currency);
        $account  = ClientCurrencyAccount::getOrCreate($client->id, $client->tenant_id, $currency);

        if ($request->filled('label')) {
            $account->label = $request->label;
            $account->save();
        }

        return $this->sendResponse($account->fresh(), 'Currency account ready', 201);
    }

    /**
     * Met a jour un compte (label uniquement, le solde se gere via les paiements).
     */
    public function update(Request $request, $id)
    {
        $user    = Auth::user();
        $account = ClientCurrencyAccount::find($id);
        if (!$account) return $this->sendError('Account not found', [], 404);
        if (!$user->hasRole('SUPER_ADMIN') && $account->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $validator = Validator::make($request->all(), [
            'label' => 'nullable|string|max:150',
        ]);
        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $account->update($request->only(['label']));
        return $this->sendResponse($account, 'Account updated');
    }

    /**
     * Supprime un compte-devise (seulement si solde a 0 et pas principal).
     */
    public function destroy($id)
    {
        $user    = Auth::user();
        $account = ClientCurrencyAccount::find($id);
        if (!$account) return $this->sendError('Account not found', [], 404);
        if (!$user->hasRole('SUPER_ADMIN') && $account->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }
        if ($account->is_primary) {
            return $this->sendError('Le compte principal ne peut etre supprime', [], 400);
        }
        if (abs((float) $account->current_balance) > 0.01) {
            return $this->sendError('Solder le compte avant suppression', [], 400);
        }

        $account->delete();
        return $this->sendResponse([], 'Account deleted');
    }
}
