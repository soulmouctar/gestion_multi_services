<?php

namespace App\Http\Controllers\Api;

use App\Models\Client;
use App\Models\ClientInterestCharge;
use App\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class ClientInterestController extends BaseController
{
    private function normalizeCurrency(?string $currency): string
    {
        $currency = strtoupper(trim((string) ($currency ?: 'GNF')));
        return $currency !== '' ? $currency : 'GNF';
    }

    private function statusFromPayment(float $paidAmount, float $amount): string
    {
        if ($paidAmount <= 0) {
            return 'PENDING';
        }

        return $paidAmount >= $amount ? 'PAID' : 'PARTIAL';
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

        $activeCharges = $charges->whereIn('status', ['PENDING', 'PARTIAL', 'PAID']);

        $summary = [
            'total_charged'  => (float) $activeCharges->sum('amount'),
            'total_paid'     => (float) $activeCharges->sum('paid_amount'),
            'remaining'      => max(0, (float) ($activeCharges->sum('amount') - $activeCharges->sum('paid_amount'))),
            'pending_count'  => $activeCharges->whereIn('status', ['PENDING', 'PARTIAL'])->count(),
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
            'amount'           => 'nullable|numeric|min:0.01',
            'paid_amount'      => 'nullable|numeric|min:0',
            'status'           => 'nullable|in:PENDING,PARTIAL,PAID,CANCELLED',
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

        $invoice = null;
        if ($request->filled('invoice_id')) {
            $invoice = Invoice::where('tenant_id', $client->tenant_id)
                ->where('client_id', $client->id)
                ->whereKey($request->invoice_id)
                ->first();

            if (!$invoice) {
                return $this->sendError('Facture invalide pour ce client.', [], 422);
            }
        }

        $principal = $request->filled('principal_amount')
            ? round((float) $request->principal_amount, 2)
            : ($invoice ? round((float) $invoice->remaining_balance, 2) : 0.0);
        $rate = $request->filled('interest_rate') ? round((float) $request->interest_rate, 3) : 0.0;

        if ($request->filled('amount')) {
            $amount = round((float) $request->amount, 2);
        } else {
            if ($principal <= 0 || $rate <= 0) {
                return $this->sendError(
                    'Montant d\'intérêt requis.',
                    ['amount' => ['Renseignez amount ou un principal_amount avec interest_rate.']],
                    422
                );
            }
            $amount = round(($principal * $rate) / 100, 2);
        }

        if ($amount < 0.01) {
            return $this->sendError('Montant d\'intérêt invalide.', ['amount' => ['Le montant calculé doit être supérieur à 0.']], 422);
        }

        $paidAmount = min(max(round((float) $request->input('paid_amount', 0), 2), 0), $amount);
        $status = $request->status === 'CANCELLED'
            ? 'CANCELLED'
            : $this->statusFromPayment($paidAmount, $amount);

        $charge = ClientInterestCharge::create([
            'tenant_id'        => $client->tenant_id,
            'client_id'        => $client->id,
            'invoice_id'       => $invoice?->id,
            'principal_amount' => $principal,
            'interest_rate'    => $rate,
            'amount'           => $amount,
            'paid_amount'      => $paidAmount,
            'currency'         => $this->normalizeCurrency($request->currency ?? $invoice?->currency),
            'charge_date'      => $request->charge_date,
            'status'           => $status,
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

        if ($request->has('amount')) {
            $charge->amount = round((float) $request->amount, 2);
        }
        if ($request->has('paid_amount')) {
            $charge->paid_amount = round((float) $request->paid_amount, 2);
        }
        if ($request->has('notes')) {
            $charge->notes = $request->notes;
        }
        if ($request->has('charge_date')) {
            $charge->charge_date = $request->charge_date;
        }

        $charge->paid_amount = min(max((float) $charge->paid_amount, 0), (float) $charge->amount);
        $charge->status = $request->status === 'CANCELLED'
            ? 'CANCELLED'
            : $this->statusFromPayment((float) $charge->paid_amount, (float) $charge->amount);

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
