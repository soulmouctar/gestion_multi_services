<?php

namespace App\Http\Controllers\Api;

use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Models\ContainerArrival;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class SupplierController extends BaseController
{
    // ─────────────────────────────────────────────────────── CRUD fournisseurs ──

    public function index(Request $request)
    {
        $user     = Auth::user();
        $tenantId = $user->hasRole('SUPER_ADMIN') ? $request->get('tenant_id') : $user->tenant_id;

        $query = Supplier::query();

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('email', 'like', "%{$s}%")
                  ->orWhere('phone1', 'like', "%{$s}%")
                  ->orWhere('category', 'like', "%{$s}%");
            });
        }

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        $suppliers = $query->orderBy('name')->paginate($request->get('per_page', 15));
        return $this->sendResponse($suppliers, 'Suppliers retrieved successfully');
    }

    public function store(Request $request)
    {
        $user     = Auth::user();
        $tenantId = $user->hasRole('SUPER_ADMIN')
            ? ($request->get('tenant_id') ?? $user->tenant_id)
            : $user->tenant_id;

        if (!$tenantId) {
            return $this->sendError('Tenant ID requis pour créer un fournisseur.', [], 422);
        }

        $validator = Validator::make($request->all(), [
            'name'     => 'required|string|max:150',
            'category' => 'nullable|string|max:100',
            'email'    => 'nullable|email|max:150',
            'phone1'   => 'nullable|string|max:50',
            'phone2'   => 'nullable|string|max:50',
            'address'  => 'nullable|string|max:255',
            'notes'    => 'nullable|string|max:1000',
            'currency' => 'nullable|string|max:10',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $supplier = Supplier::create([
            'tenant_id' => $tenantId,
            'name'      => $request->name,
            'category'  => $request->category,
            'email'     => $request->email,
            'phone1'    => $request->phone1,
            'phone2'    => $request->phone2,
            'address'   => $request->address,
            'notes'     => $request->notes,
            'currency'  => $request->currency ?? 'GNF',
        ]);

        return $this->sendResponse($supplier, 'Supplier created successfully', 201);
    }

    public function show($id)
    {
        $user     = Auth::user();
        $supplier = Supplier::find($id);

        if (!$supplier) {
            return $this->sendError('Supplier not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $supplier->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        return $this->sendResponse($supplier, 'Supplier retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $user     = Auth::user();
        $supplier = Supplier::find($id);

        if (!$supplier) {
            return $this->sendError('Supplier not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $supplier->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $validator = Validator::make($request->all(), [
            'name'     => 'sometimes|string|max:150',
            'category' => 'nullable|string|max:100',
            'email'    => 'nullable|email|max:150',
            'phone1'   => 'nullable|string|max:50',
            'phone2'   => 'nullable|string|max:50',
            'address'  => 'nullable|string|max:255',
            'notes'    => 'nullable|string|max:1000',
            'currency' => 'nullable|string|max:10',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $supplier->update($request->only(['name', 'category', 'email', 'phone1', 'phone2', 'address', 'notes', 'currency']));

        return $this->sendResponse($supplier, 'Supplier updated successfully');
    }

    public function destroy($id)
    {
        $user     = Auth::user();
        $supplier = Supplier::find($id);

        if (!$supplier) {
            return $this->sendError('Supplier not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $supplier->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        if ($supplier->photo) {
            Storage::disk('public')->delete($supplier->photo);
        }

        $supplier->delete();
        return $this->sendResponse([], 'Supplier deleted successfully');
    }

    public function uploadPhoto(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'photo' => 'required|image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $user     = Auth::user();
        $supplier = Supplier::find($id);

        if (!$supplier || (!$user->hasRole('SUPER_ADMIN') && $supplier->tenant_id !== $user->tenant_id)) {
            return $this->sendError('Supplier not found', [], 404);
        }

        if ($supplier->photo) {
            Storage::disk('public')->delete($supplier->photo);
        }

        $path = $request->file('photo')->store('suppliers', 'public');
        $supplier->update(['photo' => $path]);

        return $this->sendResponse($supplier, 'Photo uploaded successfully');
    }

    public function deletePhoto($id)
    {
        $user     = Auth::user();
        $supplier = Supplier::find($id);

        if (!$supplier || (!$user->hasRole('SUPER_ADMIN') && $supplier->tenant_id !== $user->tenant_id)) {
            return $this->sendError('Supplier not found', [], 404);
        }

        if ($supplier->photo) {
            Storage::disk('public')->delete($supplier->photo);
            $supplier->update(['photo' => null]);
        }

        return $this->sendResponse($supplier, 'Photo deleted successfully');
    }

    // ──────────────────────────────────────────────────── Paiements fournisseur ──

    public function getPayments(Request $request, $id)
    {
        $user     = Auth::user();
        $supplier = Supplier::find($id);

        if (!$supplier) {
            return $this->sendError('Supplier not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $supplier->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $payments = SupplierPayment::where('supplier_id', $id)
            ->where('tenant_id', $supplier->tenant_id)
            ->orderBy('payment_date', 'desc')
            ->get();

        return $this->sendResponse([
            'payments' => $payments,
            'count'    => $payments->count(),
            'total_gnf' => $payments->sum(fn ($p) => $p->amount_gnf ?? ($p->currency === 'GNF' ? $p->amount : 0)),
        ], 'Payments retrieved successfully');
    }

    public function storePayment(Request $request, $id)
    {
        $user     = Auth::user();
        $supplier = Supplier::find($id);

        if (!$supplier) {
            return $this->sendError('Supplier not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $supplier->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $validator = Validator::make($request->all(), [
            'amount'         => 'required|numeric|min:0.01',
            'currency'       => 'required|string|max:10',
            'exchange_rate'  => 'nullable|numeric|min:0',
            'payment_method' => 'required|string|max:50',
            'payment_date'   => 'required|date',
            'reference'      => 'nullable|string|max:100',
            'description'    => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $amount       = (float) $request->amount;
        $currency     = $request->currency;
        $exchangeRate = $request->exchange_rate ? (float) $request->exchange_rate : null;

        $amountGnf = null;
        if ($currency === 'GNF') {
            $amountGnf = $amount;
        } elseif ($exchangeRate) {
            $amountGnf = round($amount * $exchangeRate, 2);
        }

        $payment = SupplierPayment::create([
            'tenant_id'      => $supplier->tenant_id,
            'supplier_id'    => $id,
            'amount'         => $amount,
            'currency'       => $currency,
            'exchange_rate'  => $exchangeRate,
            'amount_gnf'     => $amountGnf,
            'payment_method' => $request->payment_method,
            'payment_date'   => $request->payment_date,
            'reference'      => $request->reference,
            'description'    => $request->description,
            'status'         => 'COMPLETED',
        ]);

        // Recalculer et retourner la balance mise à jour
        $balance = $this->computeBalance($id, $supplier->tenant_id);

        return $this->sendResponse([
            'payment' => $payment,
            'balance' => $balance,
        ], 'Payment recorded successfully', 201);
    }

    public function deletePayment($supplierId, $paymentId)
    {
        $user    = Auth::user();
        $payment = SupplierPayment::where('id', $paymentId)
            ->where('supplier_id', $supplierId)
            ->first();

        if (!$payment) {
            return $this->sendError('Payment not found', [], 404);
        }

        $supplier = Supplier::find($supplierId);
        if (!$user->hasRole('SUPER_ADMIN') && $supplier && $supplier->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $payment->delete();
        return $this->sendResponse([], 'Payment deleted successfully');
    }

    // ────────────────────────────────────────────────── Historique FIFO complet ──

    public function getHistory(Request $request, $id)
    {
        $user     = Auth::user();
        $supplier = Supplier::find($id);

        if (!$supplier) {
            return $this->sendError('Supplier not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $supplier->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $tid = $supplier->tenant_id;

        // ── Arrivages triés du plus ancien au plus récent (FIFO)
        $arrivals = ContainerArrival::where('supplier_id', $id)
            ->where('tenant_id', $tid)
            ->with('container:id,container_number')
            ->orderBy('arrival_date', 'asc')
            ->get();

        // ── Versements triés du plus ancien au plus récent
        $payments = SupplierPayment::where('supplier_id', $id)
            ->where('tenant_id', $tid)
            ->orderBy('payment_date', 'asc')
            ->get();

        // ── Normalisation GNF de chaque arrivage
        $arrivalsWithCost = $arrivals->map(function ($a) {
            $costGnf = $this->resolveGnf($a->purchase_price, $a->currency, $a->purchase_price_gnf, $a->exchange_rate);
            return [
                'model'    => $a,
                'cost_gnf' => $costGnf,
            ];
        });

        // ── Pool de versements en GNF (cumulé chronologiquement)
        $totalPaidGnf = $payments->sum(function ($p) {
            return $this->resolveGnf($p->amount, $p->currency, $p->amount_gnf, $p->exchange_rate);
        });

        $totalDebtGnf = $arrivalsWithCost->sum('cost_gnf');

        // ── Algorithme FIFO : imputer les versements sur les arrivages les plus anciens
        $remainingPool = $totalPaidGnf;
        $arrivalsFormatted = $arrivalsWithCost->map(function ($item) use (&$remainingPool) {
            $a       = $item['model'];
            $costGnf = $item['cost_gnf'];

            if ($costGnf <= 0) {
                $status      = 'SOLDE';
                $paidGnf     = 0;
                $remainingGnf = 0;
                $pct          = 100;
            } elseif ($remainingPool >= $costGnf) {
                $paidGnf     = $costGnf;
                $remainingGnf = 0;
                $status      = 'SOLDE';
                $pct          = 100;
                $remainingPool -= $costGnf;
            } elseif ($remainingPool > 0) {
                $paidGnf     = $remainingPool;
                $remainingGnf = $costGnf - $remainingPool;
                $status      = 'PARTIEL';
                $pct          = round($paidGnf / $costGnf * 100);
                $remainingPool = 0;
            } else {
                $paidGnf     = 0;
                $remainingGnf = $costGnf;
                $status      = 'IMPAYE';
                $pct          = 0;
            }

            return [
                'id'               => $a->id,
                'arrival_date'     => $a->arrival_date ? $a->arrival_date->format('Y-m-d') : null,
                'product_type'     => $a->product_type ?? $a->description ?? "Arrivage #{$a->id}",
                'description'      => $a->description,
                'total_quantity'   => $a->total_quantity,
                'remaining_quantity' => $a->remaining_quantity,
                'purchase_price'   => $a->purchase_price,
                'currency'         => $a->currency,
                'exchange_rate'    => $a->exchange_rate,
                'purchase_price_gnf' => $costGnf,
                'paid_gnf'         => round($paidGnf, 2),
                'remaining_gnf'    => round($remainingGnf, 2),
                'payment_pct'      => $pct,
                'payment_status'   => $status,
                'container_number' => $a->container?->container_number ?? null,
                'arrival_status'   => $a->status,
            ];
        });

        // ── Versements avec solde décroissant
        $runningDebt = $totalDebtGnf;
        $paymentsFormatted = $payments->sortByDesc('payment_date')->map(function ($p) use (&$runningDebt) {
            $paidGnf     = $this->resolveGnf($p->amount, $p->currency, $p->amount_gnf, $p->exchange_rate);
            $runningDebt -= $paidGnf;

            return [
                'id'             => $p->id,
                'date'           => $p->payment_date->format('Y-m-d'),
                'amount'         => $p->amount,
                'currency'       => $p->currency,
                'exchange_rate'  => $p->exchange_rate,
                'amount_gnf'     => round($paidGnf, 2),
                'payment_method' => $p->payment_method,
                'reference'      => $p->reference,
                'description'    => $p->description,
                'running_debt_gnf' => round(max(0, $runningDebt), 2),
            ];
        })->values();

        $balanceGnf   = max(0, $totalDebtGnf - $totalPaidGnf);
        $excessGnf    = max(0, $totalPaidGnf - $totalDebtGnf);
        $settlePct    = $totalDebtGnf > 0 ? min(100, round($totalPaidGnf / $totalDebtGnf * 100)) : 100;
        $nbSolde      = $arrivalsFormatted->where('payment_status', 'SOLDE')->count();
        $nbPartiel    = $arrivalsFormatted->where('payment_status', 'PARTIEL')->count();
        $nbImpaye     = $arrivalsFormatted->where('payment_status', 'IMPAYE')->count();

        return $this->sendResponse([
            'supplier' => [
                'id'        => $supplier->id,
                'name'      => $supplier->name,
                'category'  => $supplier->category,
                'email'     => $supplier->email,
                'phone1'    => $supplier->phone1,
                'photo_url' => $supplier->photo_url,
                'currency'  => $supplier->currency,
            ],
            'summary' => [
                'total_debt_gnf'    => round($totalDebtGnf, 2),
                'total_paid_gnf'    => round($totalPaidGnf, 2),
                'balance_gnf'       => round($balanceGnf, 2),
                'excess_gnf'        => round($excessGnf, 2),
                'settle_pct'        => $settlePct,
                'payment_count'     => $payments->count(),
                'arrival_count'     => $arrivals->count(),
                'nb_solde'          => $nbSolde,
                'nb_partiel'        => $nbPartiel,
                'nb_impaye'         => $nbImpaye,
                'is_fully_settled'  => $balanceGnf <= 0 && $arrivals->count() > 0,
                'currency'          => 'GNF',
            ],
            'arrivals' => $arrivalsFormatted->sortByDesc('arrival_date')->values(),
            'payments' => $paymentsFormatted,
        ], 'History retrieved successfully');
    }

    // ────────────────────────────────────────────────────── Helpers privés ──────

    /**
     * Résoudre le montant GNF : utilise la valeur stockée si disponible,
     * sinon calcule via le taux, sinon retourne le montant brut si déjà en GNF.
     */
    private function resolveGnf(float $amount, string $currency, ?float $storedGnf, ?float $rate): float
    {
        if ($storedGnf !== null && $storedGnf > 0) {
            return $storedGnf;
        }
        if ($currency === 'GNF') {
            return $amount;
        }
        if ($rate && $rate > 0) {
            return $amount * $rate;
        }
        // Devise étrangère sans taux : on retourne le montant brut (à corriger par l'utilisateur)
        return $amount;
    }

    private function computeBalance(int $supplierId, int $tenantId): array
    {
        $totalDebt = ContainerArrival::where('supplier_id', $supplierId)
            ->where('tenant_id', $tenantId)
            ->get()
            ->sum(fn ($a) => $this->resolveGnf($a->purchase_price, $a->currency, $a->purchase_price_gnf, $a->exchange_rate));

        $totalPaid = SupplierPayment::where('supplier_id', $supplierId)
            ->where('tenant_id', $tenantId)
            ->get()
            ->sum(fn ($p) => $this->resolveGnf($p->amount, $p->currency, $p->amount_gnf, $p->exchange_rate));

        $balance = max(0, $totalDebt - $totalPaid);

        return [
            'total_debt_gnf'   => round($totalDebt, 2),
            'total_paid_gnf'   => round($totalPaid, 2),
            'balance_gnf'      => round($balance, 2),
            'settle_pct'       => $totalDebt > 0 ? min(100, round($totalPaid / $totalDebt * 100)) : 100,
            'is_fully_settled' => $balance <= 0 && $totalDebt > 0,
        ];
    }

    // ─────────────────────────────────────────── (legacy) Relations financières ──

    public function getFinancialRelations(Request $request, $id)
    {
        return $this->getHistory($request, $id);
    }

    // ────────────────────────────────────────── Résumé de tous les fournisseurs ──

    public function getBalanceSummary(Request $request)
    {
        $user     = Auth::user();
        $tenantId = $user->hasRole('SUPER_ADMIN')
            ? ($request->get('tenant_id') ?? $user->tenant_id)
            : $user->tenant_id;

        $suppliers = Supplier::where('tenant_id', $tenantId)->orderBy('name')->get();

        $rows = $suppliers->map(function ($supplier) use ($tenantId) {
            $b = $this->computeBalance($supplier->id, $tenantId);
            return [
                'id'               => $supplier->id,
                'name'             => $supplier->name,
                'category'         => $supplier->category,
                'email'            => $supplier->email,
                'phone1'           => $supplier->phone1,
                'currency'         => $supplier->currency ?? 'GNF',
                'total_debt_gnf'   => $b['total_debt_gnf'],
                'total_paid_gnf'   => $b['total_paid_gnf'],
                'balance_gnf'      => $b['balance_gnf'],
                'settle_pct'       => $b['settle_pct'],
                'is_fully_settled' => $b['is_fully_settled'],
            ];
        });

        return $this->sendResponse([
            'suppliers' => $rows,
            'totals'    => [
                'total_debt_gnf' => round($rows->sum('total_debt_gnf'), 2),
                'total_paid_gnf' => round($rows->sum('total_paid_gnf'), 2),
                'balance_gnf'    => round($rows->sum('balance_gnf'), 2),
                'supplier_count' => $rows->count(),
            ],
        ], 'Balance summary retrieved successfully');
    }
}
