<?php

namespace App\Http\Controllers\Api;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class BankingController extends BaseController
{
    private function tenantId(): int
    {
        return (int) (auth()->user()?->tenant_id ?? 1);
    }

    // ==================== COMPTES ====================

    public function indexAccounts()
    {
        $accounts = BankAccount::where('tenant_id', $this->tenantId())
            ->withCount('transactions')
            ->orderBy('bank_name')
            ->orderBy('account_name')
            ->get()
            ->map(fn($a) => $this->appendAccountMeta($a));

        return $this->sendResponse($accounts, 'Accounts retrieved');
    }

    public function storeAccount(Request $request)
    {
        $v = Validator::make($request->all(), [
            'bank_name'       => 'required|string|max:100',
            'account_number'  => 'required|string|max:50',
            'account_name'    => 'required|string|max:200',
            'account_type'    => 'nullable|in:COURANT,EPARGNE,DEPOT_A_TERME',
            'currency'        => 'nullable|string|max:10',
            'opening_balance' => 'nullable|numeric|min:0',
            'description'     => 'nullable|string|max:1000',
        ]);
        if ($v->fails()) return $this->sendError('Validation Error', $v->errors()->toArray(), 422);

        $opening = (float) ($request->opening_balance ?? 0);
        $account = BankAccount::create([
            'tenant_id'       => $this->tenantId(),
            'bank_name'       => $request->bank_name,
            'account_number'  => $request->account_number,
            'account_name'    => $request->account_name,
            'account_type'    => $request->account_type ?? 'COURANT',
            'currency'        => $request->currency ?? 'GNF',
            'opening_balance' => $opening,
            'current_balance' => $opening,
            'is_active'       => true,
            'description'     => $request->description,
        ]);

        return $this->sendResponse($account, 'Account created', 201);
    }

    public function showAccount($id)
    {
        $account = BankAccount::where('tenant_id', $this->tenantId())
            ->withCount('transactions')
            ->find($id);
        if (!$account) return $this->sendError('Account not found', [], 404);

        return $this->sendResponse($this->appendAccountMeta($account), 'Account retrieved');
    }

    public function updateAccount(Request $request, $id)
    {
        $account = BankAccount::where('tenant_id', $this->tenantId())->find($id);
        if (!$account) return $this->sendError('Account not found', [], 404);

        $v = Validator::make($request->all(), [
            'bank_name'      => 'sometimes|string|max:100',
            'account_number' => 'sometimes|string|max:50',
            'account_name'   => 'sometimes|string|max:200',
            'account_type'   => 'nullable|in:COURANT,EPARGNE,DEPOT_A_TERME',
            'currency'       => 'nullable|string|max:10',
            'is_active'      => 'nullable|boolean',
            'description'    => 'nullable|string|max:1000',
        ]);
        if ($v->fails()) return $this->sendError('Validation Error', $v->errors()->toArray(), 422);

        $account->update($request->only([
            'bank_name', 'account_number', 'account_name',
            'account_type', 'currency', 'is_active', 'description',
        ]));

        return $this->sendResponse($account, 'Account updated');
    }

    public function destroyAccount($id)
    {
        $account = BankAccount::where('tenant_id', $this->tenantId())
            ->with('transactions')
            ->find($id);
        if (!$account) return $this->sendError('Account not found', [], 404);

        // Delete proof files
        foreach ($account->transactions as $t) {
            if ($t->proof_file) Storage::disk('public')->delete($t->proof_file);
        }

        $account->delete();
        return $this->sendResponse([], 'Account deleted');
    }

    // ==================== TRANSACTIONS ====================

    public function indexTransactions(Request $request)
    {
        $query = BankTransaction::with('bankAccount')
            ->where('bank_transactions.tenant_id', $this->tenantId());

        if ($request->filled('account_id'))       $query->where('bank_account_id', $request->account_id);
        if ($request->filled('transaction_type')) $query->where('transaction_type', $request->transaction_type);
        if ($request->filled('status'))           $query->where('status', $request->status);
        if ($request->filled('date_from'))        $query->where('transaction_date', '>=', $request->date_from);
        if ($request->filled('date_to'))          $query->where('transaction_date', '<=', $request->date_to);
        if ($request->filled('search')) {
            $q = $request->search;
            $query->where(fn($s) => $s->where('reference', 'like', "%$q%")->orWhere('description', 'like', "%$q%"));
        }

        $transactions = $query->orderBy('transaction_date', 'desc')
            ->orderBy('id', 'desc')
            ->paginate($request->get('per_page', 20));

        // Append proof URLs
        $transactions->getCollection()->transform(fn($t) => $this->appendProofUrl($t));

        return $this->sendResponse($transactions, 'Transactions retrieved');
    }

    public function storeTransaction(Request $request)
    {
        $v = Validator::make($request->all(), [
            'bank_account_id'  => 'required|integer',
            'transaction_type' => 'required|in:DEPOT,RETRAIT,REMISE_CHEQUE,VIREMENT_ENTRANT,VIREMENT_SORTANT',
            'amount'           => 'required|numeric|min:0.01',
            'currency'         => 'nullable|string|max:10',
            'transaction_date' => 'required|date',
            'reference'        => 'nullable|string|max:100',
            'description'      => 'nullable|string|max:1000',
            'proof_type'       => 'nullable|in:BORDEREAU,CHEQUE,RECU,AUTRE',
            'status'           => 'nullable|in:PENDING,COMPLETED,CANCELLED',
            'proof_file'       => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:1800',
        ]);
        if ($v->fails()) return $this->sendError('Validation Error', $v->errors()->toArray(), 422);

        $account = BankAccount::where('tenant_id', $this->tenantId())->find($request->bank_account_id);
        if (!$account) return $this->sendError('Account not found', [], 404);

        DB::beginTransaction();
        try {
            $proofPath = null;
            if ($request->hasFile('proof_file')) {
                $proofPath = $request->file('proof_file')->store('uploads/banking/proofs', 'public');
            }

            $status = $request->status ?? 'COMPLETED';
            $transaction = BankTransaction::create([
                'tenant_id'        => $this->tenantId(),
                'bank_account_id'  => $account->id,
                'user_id'          => auth()->id(),
                'transaction_type' => $request->transaction_type,
                'amount'           => $request->amount,
                'currency'         => $request->currency ?? $account->currency,
                'transaction_date' => $request->transaction_date,
                'reference'        => $request->reference,
                'description'      => $request->description,
                'proof_file'       => $proofPath,
                'proof_type'       => $request->proof_type,
                'status'           => $status,
                'balance_after'    => null,
            ]);

            if ($status === 'COMPLETED') {
                $newBalance = $account->recalculateBalance();
                $transaction->balance_after = $newBalance;
                $transaction->save();
            }

            DB::commit();
            return $this->sendResponse(
                $this->appendProofUrl($transaction->load('bankAccount')),
                'Transaction created',
                201
            );
        } catch (\Exception $e) {
            DB::rollBack();
            if ($proofPath) Storage::disk('public')->delete($proofPath);
            return $this->sendError('Error', ['error' => $e->getMessage()], 500);
        }
    }

    public function showTransaction($id)
    {
        $transaction = BankTransaction::with('bankAccount')
            ->where('tenant_id', $this->tenantId())
            ->find($id);
        if (!$transaction) return $this->sendError('Transaction not found', [], 404);

        return $this->sendResponse($this->appendProofUrl($transaction), 'Transaction retrieved');
    }

    public function updateTransaction(Request $request, $id)
    {
        $transaction = BankTransaction::where('tenant_id', $this->tenantId())->find($id);
        if (!$transaction) return $this->sendError('Transaction not found', [], 404);

        $v = Validator::make($request->all(), [
            'transaction_type' => 'sometimes|in:DEPOT,RETRAIT,REMISE_CHEQUE,VIREMENT_ENTRANT,VIREMENT_SORTANT',
            'amount'           => 'sometimes|numeric|min:0.01',
            'currency'         => 'nullable|string|max:10',
            'transaction_date' => 'sometimes|date',
            'reference'        => 'nullable|string|max:100',
            'description'      => 'nullable|string|max:1000',
            'proof_type'       => 'nullable|in:BORDEREAU,CHEQUE,RECU,AUTRE',
            'status'           => 'nullable|in:PENDING,COMPLETED,CANCELLED',
        ]);
        if ($v->fails()) return $this->sendError('Validation Error', $v->errors()->toArray(), 422);

        DB::beginTransaction();
        try {
            $transaction->update($request->only([
                'transaction_type', 'amount', 'currency', 'transaction_date',
                'reference', 'description', 'proof_type', 'status',
            ]));

            $newBalance = $transaction->bankAccount->recalculateBalance();
            $transaction->balance_after = $newBalance;
            $transaction->save();

            DB::commit();
            return $this->sendResponse(
                $this->appendProofUrl($transaction->load('bankAccount')),
                'Transaction updated'
            );
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->sendError('Error', ['error' => $e->getMessage()], 500);
        }
    }

    public function uploadProof(Request $request, $id)
    {
        $transaction = BankTransaction::where('tenant_id', $this->tenantId())->find($id);
        if (!$transaction) return $this->sendError('Transaction not found', [], 404);

        $v = Validator::make($request->all(), [
            'proof_file' => 'required|file|mimes:jpg,jpeg,png,pdf|max:1800',
            'proof_type' => 'nullable|in:BORDEREAU,CHEQUE,RECU,AUTRE',
        ]);
        if ($v->fails()) return $this->sendError('Validation Error', $v->errors()->toArray(), 422);

        // Delete old proof
        if ($transaction->proof_file) {
            Storage::disk('public')->delete($transaction->proof_file);
        }

        $proofPath = $request->file('proof_file')->store('uploads/banking/proofs', 'public');
        $transaction->update([
            'proof_file' => $proofPath,
            'proof_type' => $request->proof_type ?? $transaction->proof_type,
        ]);

        return $this->sendResponse($this->appendProofUrl($transaction), 'Proof uploaded');
    }

    public function destroyTransaction($id)
    {
        $transaction = BankTransaction::where('tenant_id', $this->tenantId())->find($id);
        if (!$transaction) return $this->sendError('Transaction not found', [], 404);

        $account = $transaction->bankAccount;
        if ($transaction->proof_file) Storage::disk('public')->delete($transaction->proof_file);
        $transaction->delete();
        $account->recalculateBalance();

        return $this->sendResponse([], 'Transaction deleted');
    }

    // ==================== STATISTIQUES ====================

    public function statistics(Request $request)
    {
        try {
            $tenantId  = $this->tenantId();
            $dateFrom  = $request->get('date_from', now()->startOfMonth()->format('Y-m-d'));
            $dateTo    = $request->get('date_to', now()->format('Y-m-d'));
            $accountId = $request->get('account_id');

            // All active accounts
            $accounts = BankAccount::where('tenant_id', $tenantId)
                ->orderBy('bank_name')
                ->get(['id', 'bank_name', 'account_number', 'account_name', 'currency', 'current_balance', 'account_type', 'is_active']);

            $totalBalance = $accounts->where('is_active', true)->sum('current_balance');

            // Period summary
            $summary = DB::table('bank_transactions')
                ->where('tenant_id', $tenantId)
                ->where('status', 'COMPLETED')
                ->whereBetween('transaction_date', [$dateFrom, $dateTo])
                ->when($accountId, fn($q) => $q->where('bank_account_id', $accountId))
                ->selectRaw('
                    COUNT(*) as total_transactions,
                    COALESCE(SUM(CASE WHEN transaction_type IN ("DEPOT","REMISE_CHEQUE","VIREMENT_ENTRANT") THEN amount ELSE 0 END),0) as total_credits,
                    COALESCE(SUM(CASE WHEN transaction_type IN ("RETRAIT","VIREMENT_SORTANT") THEN amount ELSE 0 END),0) as total_debits,
                    COALESCE(SUM(CASE WHEN transaction_type = "DEPOT" THEN amount ELSE 0 END),0) as total_depots,
                    COALESCE(SUM(CASE WHEN transaction_type = "RETRAIT" THEN amount ELSE 0 END),0) as total_retraits,
                    COALESCE(SUM(CASE WHEN transaction_type = "REMISE_CHEQUE" THEN amount ELSE 0 END),0) as total_cheques,
                    COALESCE(SUM(CASE WHEN transaction_type = "VIREMENT_ENTRANT" THEN amount ELSE 0 END),0) as total_virements_entrants,
                    COALESCE(SUM(CASE WHEN transaction_type = "VIREMENT_SORTANT" THEN amount ELSE 0 END),0) as total_virements_sortants
                ')
                ->first();

            // By account
            $byAccount = DB::table('bank_transactions')
                ->join('bank_accounts', 'bank_transactions.bank_account_id', '=', 'bank_accounts.id')
                ->where('bank_transactions.tenant_id', $tenantId)
                ->where('bank_transactions.status', 'COMPLETED')
                ->whereBetween('bank_transactions.transaction_date', [$dateFrom, $dateTo])
                ->when($accountId, fn($q) => $q->where('bank_transactions.bank_account_id', $accountId))
                ->groupBy('bank_accounts.id', 'bank_accounts.bank_name', 'bank_accounts.account_number', 'bank_accounts.account_name', 'bank_accounts.current_balance', 'bank_accounts.currency')
                ->selectRaw('
                    bank_accounts.id,
                    bank_accounts.bank_name,
                    bank_accounts.account_number,
                    bank_accounts.account_name,
                    bank_accounts.current_balance,
                    bank_accounts.currency,
                    COUNT(bank_transactions.id) as nb_transactions,
                    COALESCE(SUM(CASE WHEN transaction_type IN ("DEPOT","REMISE_CHEQUE","VIREMENT_ENTRANT") THEN bank_transactions.amount ELSE 0 END),0) as credits,
                    COALESCE(SUM(CASE WHEN transaction_type IN ("RETRAIT","VIREMENT_SORTANT") THEN bank_transactions.amount ELSE 0 END),0) as debits
                ')
                ->get();

            // Monthly evolution (last 12 months)
            $byMonth = DB::table('bank_transactions')
                ->where('tenant_id', $tenantId)
                ->where('status', 'COMPLETED')
                ->where('transaction_date', '>=', now()->subMonths(11)->startOfMonth()->format('Y-m-d'))
                ->when($accountId, fn($q) => $q->where('bank_account_id', $accountId))
                ->groupByRaw('DATE_FORMAT(transaction_date, "%Y-%m")')
                ->selectRaw('
                    DATE_FORMAT(transaction_date, "%Y-%m") as month,
                    COALESCE(SUM(CASE WHEN transaction_type IN ("DEPOT","REMISE_CHEQUE","VIREMENT_ENTRANT") THEN amount ELSE 0 END),0) as credits,
                    COALESCE(SUM(CASE WHEN transaction_type IN ("RETRAIT","VIREMENT_SORTANT") THEN amount ELSE 0 END),0) as debits,
                    COUNT(*) as count
                ')
                ->orderBy('month')
                ->get();

            // By type
            $byType = DB::table('bank_transactions')
                ->where('tenant_id', $tenantId)
                ->where('status', 'COMPLETED')
                ->whereBetween('transaction_date', [$dateFrom, $dateTo])
                ->when($accountId, fn($q) => $q->where('bank_account_id', $accountId))
                ->groupBy('transaction_type')
                ->selectRaw('transaction_type, COUNT(*) as count, COALESCE(SUM(amount),0) as total')
                ->orderByDesc('total')
                ->get();

            // Recent transactions
            $recentTransactions = DB::table('bank_transactions')
                ->join('bank_accounts', 'bank_transactions.bank_account_id', '=', 'bank_accounts.id')
                ->where('bank_transactions.tenant_id', $tenantId)
                ->when($accountId, fn($q) => $q->where('bank_transactions.bank_account_id', $accountId))
                ->select(
                    'bank_transactions.id',
                    'bank_transactions.transaction_type',
                    'bank_transactions.amount',
                    'bank_transactions.currency',
                    'bank_transactions.transaction_date',
                    'bank_transactions.reference',
                    'bank_transactions.status',
                    'bank_transactions.proof_file',
                    'bank_transactions.proof_type'
                )
                ->selectRaw('bank_accounts.bank_name, bank_accounts.account_number, bank_accounts.account_name')
                ->orderByDesc('bank_transactions.transaction_date')
                ->orderByDesc('bank_transactions.id')
                ->limit(15)
                ->get()
                ->map(function ($t) {
                    if ($t->proof_file) {
                        $t->proof_url = url('storage/' . ltrim($t->proof_file, '/'));
                    }
                    return $t;
                });

            return $this->sendResponse([
                'total_balance'       => (float) $totalBalance,
                'total_accounts'      => $accounts->count(),
                'active_accounts'     => $accounts->where('is_active', true)->count(),
                'accounts'            => $accounts,
                'summary'             => $summary,
                'by_account'          => $byAccount,
                'by_month'            => $byMonth,
                'by_type'             => $byType,
                'recent_transactions' => $recentTransactions,
                'period'              => ['from' => $dateFrom, 'to' => $dateTo],
            ], 'Statistics retrieved');

        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }

    // ==================== HELPERS ====================

    private function appendProofUrl($transaction)
    {
        if ($transaction->proof_file) {
            // Use url() helper to always get the correct host:port
            $transaction->proof_url = url('storage/' . ltrim($transaction->proof_file, '/'));
        }
        return $transaction;
    }

    private function appendAccountMeta($account)
    {
        // Pending count
        $account->pending_count = $account->transactions()->where('status', 'PENDING')->count();
        return $account;
    }
}
