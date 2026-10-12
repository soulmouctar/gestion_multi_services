<?php

namespace App\Http\Controllers\Api;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Vue d'ensemble chiffree d'une organisation, pour les graphiques :
 * series mensuelles, repartition des ventes par activite et classements.
 * Tout est exprime en GNF pour pouvoir additionner et comparer.
 */
class StatisticsOverviewController extends BaseController
{
    public function overview(Request $request)
    {
        $user = Auth::user();
        $tenantId = $user && $user->hasRole('SUPER_ADMIN')
            ? ($request->filled('tenant_id') ? (int) $request->tenant_id : ($user->tenant_id ?: null))
            : $user?->tenant_id;
        if (!$tenantId) {
            return $this->sendError('tenant_id requis.', [], 400);
        }

        $months = max(3, min(24, (int) $request->get('months', 12)));
        $start = Carbon::now()->startOfMonth()->subMonths($months - 1);
        $keys = collect(range(0, $months - 1))->map(fn ($i) => $start->copy()->addMonths($i)->format('Y-m'));

        // Ventes du commercial : lignes de facture, converties au taux de la facture
        $invoiceLines = DB::table('invoice_items')
            ->join('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')
            ->leftJoin('products', 'invoice_items.product_id', '=', 'products.id')
            ->leftJoin('product_categories', 'products.product_category_id', '=', 'product_categories.id')
            ->where('invoices.tenant_id', $tenantId)
            ->whereNull('invoices.deleted_at');
        $gnf = 'invoice_items.line_total * COALESCE(NULLIF(invoices.exchange_rate, 0), 1)';

        $commercialByMonth = (clone $invoiceLines)
            ->where('invoices.created_at', '>=', $start)
            ->selectRaw("DATE_FORMAT(invoices.created_at, '%Y-%m') as month, SUM($gnf) as total")
            ->groupBy('month')->pluck('total', 'month');

        $textileSales = DB::table('container_sales')
            ->where('tenant_id', $tenantId)->where('status', '!=', 'ANNULE')->whereNull('deleted_at');
        $textileByMonth = (clone $textileSales)
            ->where('sale_date', '>=', $start)
            ->selectRaw("DATE_FORMAT(sale_date, '%Y-%m') as month, SUM(sale_price_gnf) as total")
            ->groupBy('month')->pluck('total', 'month');

        // Encaissements : versements des clients du commercial et du textile (hors imputations d'avance)
        $paymentsByMonth = DB::table('payments')
            ->where('tenant_id', $tenantId)->where('type', 'CLIENT')->where('status', 'COMPLETED')->whereNull('deleted_at')
            ->where('payment_date', '>=', $start)
            ->selectRaw("DATE_FORMAT(payment_date, '%Y-%m') as month, SUM(amount_gnf) as total")
            ->groupBy('month')->pluck('total', 'month');
        $textilePaymentsByMonth = DB::table('container_sale_payments')
            ->where('tenant_id', $tenantId)
            ->where(fn ($q) => $q->whereNull('payment_type')->orWhere('payment_type', '!=', 'AVANCE'))
            ->where('payment_date', '>=', $start)
            ->selectRaw("DATE_FORMAT(payment_date, '%Y-%m') as month, SUM(amount_gnf) as total")
            ->groupBy('month')->pluck('total', 'month');

        $expensesByMonth = DB::table('personal_expenses')
            ->where('tenant_id', $tenantId)->where('status', '!=', 'CANCELLED')->whereNull('deleted_at')
            ->where('expense_date', '>=', $start)
            ->selectRaw("DATE_FORMAT(expense_date, '%Y-%m') as month, SUM(amount_gnf) as total")
            ->groupBy('month')->pluck('total', 'month');

        $monthly = $keys->map(fn ($month) => [
            'month' => $month,
            'sales' => round((float) ($commercialByMonth[$month] ?? 0) + (float) ($textileByMonth[$month] ?? 0), 2),
            'collected' => round((float) ($paymentsByMonth[$month] ?? 0) + (float) ($textilePaymentsByMonth[$month] ?? 0), 2),
            'expenses' => round((float) ($expensesByMonth[$month] ?? 0), 2),
        ])->values();

        // Repartition des ventes par activite, sur la meme periode
        $byCategory = (clone $invoiceLines)
            ->where('invoices.created_at', '>=', $start)
            ->selectRaw("COALESCE(product_categories.name, 'Autre') as name, SUM($gnf) as total")
            ->groupBy('name')->pluck('total', 'name');
        $families = collect();
        foreach ($byCategory as $name => $total) {
            $label = preg_match('/pneu/i', $name) ? 'Pneus' : (preg_match('/cosm/i', $name) ? 'Cosmétique' : $name);
            $families[$label] = ($families[$label] ?? 0) + (float) $total;
        }
        $textileTotal = (float) (clone $textileSales)->where('sale_date', '>=', $start)->sum('sale_price_gnf');
        if ($textileTotal > 0) {
            $families['Textile'] = ($families['Textile'] ?? 0) + $textileTotal;
        }
        $families = $families->filter(fn ($total) => $total > 0)
            ->map(fn ($total, $name) => ['name' => $name, 'total' => round($total, 2)])
            ->sortByDesc('total')->values();

        // Classements
        $topProducts = (clone $invoiceLines)
            ->whereNotNull('invoice_items.product_id')
            ->where('invoices.created_at', '>=', $start)
            ->selectRaw("products.name as name, SUM($gnf) as total, SUM(invoice_items.quantity) as quantity")
            ->groupBy('products.id', 'products.name')->orderByDesc('total')->limit(8)->get()
            ->map(fn ($row) => ['name' => $row->name, 'total' => round((float) $row->total, 2), 'quantity' => (float) $row->quantity]);

        $commercialClients = DB::table('invoices')
            ->join('clients', 'invoices.client_id', '=', 'clients.id')
            ->where('invoices.tenant_id', $tenantId)->whereNull('invoices.deleted_at')
            ->where('invoices.created_at', '>=', $start)
            // Les soldes d'ouverture (sans ligne) ne sont pas des ventes
            ->whereExists(fn ($q) => $q->select(DB::raw(1))->from('invoice_items')->whereColumn('invoice_items.invoice_id', 'invoices.id'))
            ->selectRaw('clients.id, clients.name, SUM(invoices.items_subtotal_amount * COALESCE(NULLIF(invoices.exchange_rate, 0), 1)) as total')
            ->groupBy('clients.id', 'clients.name')->get();
        $textileClients = DB::table('container_sales')
            ->join('clients', 'container_sales.client_id', '=', 'clients.id')
            ->where('container_sales.tenant_id', $tenantId)->where('container_sales.status', '!=', 'ANNULE')->whereNull('container_sales.deleted_at')
            ->where('container_sales.sale_date', '>=', $start)
            ->selectRaw('clients.id, clients.name, SUM(container_sales.sale_price_gnf) as total')
            ->groupBy('clients.id', 'clients.name')->get();
        $topClients = $commercialClients->concat($textileClients)->groupBy('id')
            ->map(fn ($rows) => ['name' => $rows->first()->name, 'total' => round((float) $rows->sum('total'), 2)])
            ->sortByDesc('total')->take(8)->values();

        // Plus gros soldes dus, par compte : une devise n'est jamais additionnee a une autre
        $topDebtors = DB::table('client_currency_accounts')
            ->join('clients', 'client_currency_accounts.client_id', '=', 'clients.id')
            ->where('clients.tenant_id', $tenantId)->whereNull('clients.deleted_at')
            ->where('client_currency_accounts.current_balance', '>', 0)
            ->orderByRaw("CASE client_currency_accounts.currency WHEN 'GNF' THEN 0 ELSE 1 END")
            ->orderByDesc('client_currency_accounts.current_balance')
            ->limit(8)
            ->get(['clients.name', 'client_currency_accounts.currency', 'client_currency_accounts.current_balance as balance'])
            ->map(fn ($row) => ['name' => $row->name, 'currency' => $row->currency, 'balance' => round((float) $row->balance, 2)]);

        return $this->sendResponse([
            'period' => ['from' => $start->toDateString(), 'months' => $months],
            'monthly' => $monthly,
            'totals' => [
                'sales' => round($monthly->sum('sales'), 2),
                'collected' => round($monthly->sum('collected'), 2),
                'expenses' => round($monthly->sum('expenses'), 2),
            ],
            'families' => $families,
            'top_products' => $topProducts,
            'top_clients' => $topClients,
            'top_debtors' => $topDebtors,
        ], 'Vue d\'ensemble');
    }
}
