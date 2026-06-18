<?php

namespace App\Http\Controllers\Api;

use App\Models\Client;
use App\Models\ClientInterestCharge;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class ClientInterestController extends BaseController
{
    private function tenantId(): ?int
    {
        $user = Auth::user();
        return $user->hasRole('SUPER_ADMIN') ? request()->get('tenant_id') : $user->tenant_id;
    }

    /** Liste des frais d'intérêts d'un client (compte "SALL") */
    public function indexForClient(Request $request, $clientId)
    {
        $client = Client::find($clientId);
        if (!$client) return $this->sendError('Client introuvable', [], 404);

        $user = Auth::user();
        if (!$user->hasRole('SUPER_ADMIN') && $client->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $charges = ClientInterestCharge::where('client_id', $clientId)
            ->where('tenant_id', $client->tenant_id)
            ->orderBy('charge_date', 'desc')
            ->get();

        $summary = [
            'total_charged'  => (float) $charges->sum('amount'),
            'total_paid'     => (float) $charges->sum('paid_amount'),
            'remaining'      => (float) ($charges->sum('amount') - $charges->sum('paid_amount')),
            'pending_count'  => $charges->whereIn('status', ['PENDING', 'PARTIAL'])->count(),
        ];

        return $this->sendResponse([
            'charges' => $charges,
            'summary' => $summary,
        ], 'Interest charges retrieved');
    }

    /** Crée un frais d'intérêt manuel sur un client (mode T.B.SALL) */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'client_id'        => 'required|exists:clients,id',
            'invoice_id'       => 'nullable|exists:invoices,id',
            'principal_amount' => 'nullable|numeric|min:0',
            'interest_rate'    => 'nullable|numeric|min:0|max:100',
            'amount'           => 'required|numeric|min:0.01',
            'currency'         => 'nullable|string|max:10',
            'charge_date'      => 'required|date',
            'reference'        => 'nullable|string|max:100',
            'notes'            => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $client = Client::find($request->client_id);
        $user   = Auth::user();
        if (!$user->hasRole('SUPER_ADMIN') && $client->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $charge = ClientInterestCharge::create([
            'tenant_id'        => $client->tenant_id,
            'client_id'        => $client->id,
            'invoice_id'       => $request->invoice_id,
            'principal_amount' => $request->principal_amount ?? 0,
            'interest_rate'    => $request->interest_rate ?? 0,
            'amount'           => $request->amount,
            'paid_amount'      => 0,
            'currency'         => $request->currency ?? 'GNF',
            'charge_date'      => $request->charge_date,
            'status'           => 'PENDING',
            'reference'        => $request->reference,
            'notes'            => $request->notes,
        ]);

        return $this->sendResponse($charge, 'Frais d\'intérêt enregistré', 201);
    }

    /** Met à jour un frais (notes/montant/paid_amount) */
    public function update(Request $request, $id)
    {
        $charge = ClientInterestCharge::find($id);
        if (!$charge) return $this->sendError('Frais introuvable', [], 404);

        $user = Auth::user();
        if (!$user->hasRole('SUPER_ADMIN') && $charge->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $validator = Validator::make($request->all(), [
            'amount'      => 'nullable|numeric|min:0.01',
            'paid_amount' => 'nullable|numeric|min:0',
            'status'      => 'nullable|in:PENDING,PARTIAL,PAID,CANCELLED',
            'notes'       => 'nullable|string|max:1000',
            'charge_date' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $charge->fill($request->only(['amount', 'paid_amount', 'status', 'notes', 'charge_date']));

        // Auto-compute status if paid_amount changed
        if ($request->has('paid_amount')) {
            if ($charge->paid_amount <= 0) {
                $charge->status = 'PENDING';
            } elseif ($charge->paid_amount >= $charge->amount) {
                $charge->status = 'PAID';
                $charge->paid_amount = $charge->amount;
            } else {
                $charge->status = 'PARTIAL';
            }
        }

        $charge->save();

        return $this->sendResponse($charge, 'Frais mis à jour');
    }

    public function destroy($id)
    {
        $charge = ClientInterestCharge::find($id);
        if (!$charge) return $this->sendError('Frais introuvable', [], 404);

        $user = Auth::user();
        if (!$user->hasRole('SUPER_ADMIN') && $charge->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $charge->delete();
        return $this->sendResponse([], 'Frais supprimé');
    }
}
