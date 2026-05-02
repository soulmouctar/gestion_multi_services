<?php

namespace App\Http\Controllers\Api;

use App\Models\ContainerArrival;
use App\Models\ContainerSale;
use App\Models\ClientAdvance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CommercialDashboardController extends BaseController
{
    public function index(Request $request)
    {
        try {
            $user     = auth()->user();
            $tenantId = $user->hasRole('SUPER_ADMIN')
                ? (int) $request->get('tenant_id', $user->tenant_id)
                : $user->tenant_id;

            // ── 1. Stats globales ── 3 requêtes avec selectRaw (pas 6 queries séparées)

            $arrivalAgg = DB::table('container_arrivals')
                ->selectRaw('
                    COUNT(*) as total_arrivals,
                    COALESCE(SUM(purchase_price), 0) as total_purchase_value
                ')
                ->where('tenant_id', $tenantId)
                ->first();

            $salesAgg = DB::table('container_sales')
                ->selectRaw('
                    COUNT(*) as total_sales,
                    COALESCE(SUM(sale_price), 0) as total_sales_value,
                    COALESCE(SUM(amount_paid), 0) as total_paid,
                    COALESCE(SUM(CASE WHEN status IN ("EN_COURS","PAYE_PARTIEL") THEN remaining_amount ELSE 0 END), 0) as total_remaining,
                    SUM(CASE WHEN YEAR(sale_date) = YEAR(NOW()) AND MONTH(sale_date) = MONTH(NOW()) THEN 1 ELSE 0 END) as sales_this_month,
                    COALESCE(SUM(CASE WHEN YEAR(sale_date) = YEAR(NOW()) AND MONTH(sale_date) = MONTH(NOW()) THEN sale_price ELSE 0 END), 0) as revenue_this_month
                ')
                ->where('tenant_id', $tenantId)
                ->first();

            $advanceAgg = DB::table('client_advances')
                ->selectRaw('COALESCE(SUM(remaining_amount), 0) as total_client_advances')
                ->where('tenant_id', $tenantId)
                ->where('status', '!=', 'UTILISE_TOTAL')
                ->first();

            // ── 2. Stock / Arrivages récents ── 3 requêtes (main + container + supplier)

            $arrivals = ContainerArrival::select([
                'id', 'container_id', 'supplier_id', 'arrival_date',
                'purchase_price', 'currency', 'product_type',
                'total_quantity', 'remaining_quantity', 'status', 'description',
            ])
                ->with([
                    'container:id,container_number',
                    'supplier:id,name',
                ])
                ->where('tenant_id', $tenantId)
                ->orderBy('arrival_date', 'desc')
                ->limit(20)
                ->get();

            // ── 3. Ventes récentes ── 4 requêtes (main + arrival + container + client)
            //    On ne charge PAS "payments" : amount_paid est déjà sur la vente

            $recentSales = ContainerSale::select([
                'id', 'client_id', 'container_arrival_id', 'sale_type',
                'quantity_sold', 'sale_price', 'amount_paid',
                'remaining_amount', 'status', 'currency', 'sale_date',
            ])
                ->with([
                    'client:id,name',
                    'containerArrival:id,container_id,product_type',
                    'containerArrival.container:id,container_number',
                ])
                ->where('tenant_id', $tenantId)
                ->orderBy('sale_date', 'desc')
                ->limit(8)
                ->get();

            // ── 4. Ventes en attente ── 4 requêtes (même structure)

            $pendingSales = ContainerSale::select([
                'id', 'client_id', 'container_arrival_id', 'sale_type',
                'quantity_sold', 'sale_price', 'amount_paid',
                'remaining_amount', 'status', 'currency', 'sale_date', 'due_date',
            ])
                ->with([
                    'client:id,name',
                    'containerArrival:id,container_id,product_type',
                    'containerArrival.container:id,container_number',
                ])
                ->where('tenant_id', $tenantId)
                ->whereIn('status', ['EN_COURS', 'PAYE_PARTIEL'])
                ->orderBy('sale_date', 'desc')
                ->limit(10)
                ->get();

            // ── 5. Avances clients récentes ── 2 requêtes (main + client)

            $advances = ClientAdvance::select([
                'id', 'client_id', 'amount', 'currency',
                'payment_date', 'status', 'remaining_amount', 'used_amount', 'reference',
            ])
                ->with(['client:id,name'])
                ->where('tenant_id', $tenantId)
                ->orderBy('payment_date', 'desc')
                ->limit(5)
                ->get();

            $totalPurchase = (float) ($arrivalAgg->total_purchase_value ?? 0);
            $totalSales    = (float) ($salesAgg->total_sales_value    ?? 0);

            return $this->sendResponse([
                'global_stats' => [
                    'total_arrivals'        => (int)   ($arrivalAgg->total_arrivals    ?? 0),
                    'total_purchase_value'  => $totalPurchase,
                    'total_sales'           => (int)   ($salesAgg->total_sales         ?? 0),
                    'total_sales_value'     => $totalSales,
                    'total_paid'            => (float) ($salesAgg->total_paid          ?? 0),
                    'total_remaining'       => (float) ($salesAgg->total_remaining     ?? 0),
                    'sales_this_month'      => (int)   ($salesAgg->sales_this_month    ?? 0),
                    'revenue_this_month'    => (float) ($salesAgg->revenue_this_month  ?? 0),
                    'total_client_advances' => (float) ($advanceAgg->total_client_advances ?? 0),
                    'estimated_profit'      => $totalSales - $totalPurchase,
                ],
                'arrivals'       => $arrivals,
                'arrivals_total' => $arrivals->count(),
                'recent_sales'   => $recentSales,
                'pending_sales'  => $pendingSales,
                'client_advances'=> $advances,
            ], 'Commercial dashboard loaded successfully');

        } catch (\Exception $e) {
            \Log::error('CommercialDashboard error: ' . $e->getMessage());
            return $this->sendError('Erreur lors du chargement du tableau de bord', [], 500);
        }
    }
}
