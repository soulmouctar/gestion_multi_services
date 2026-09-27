<?php

namespace App\Http\Controllers\Api;

use App\Models\Client;
use App\Models\ContainerSale;
use App\Models\ContainerSalePayment;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Tableau de bord decisionnel.
 *
 * Repond aux questions qu'on se pose en ouvrant l'application : combien me
 * doit-on, qu'ai-je encaisse, qu'est-ce qui demande une action aujourd'hui.
 * Tout est agrege en un seul appel pour eviter une dizaine de requetes
 * concurrentes au chargement de la page.
 */
class BusinessDashboardController extends BaseController
{
    private function tenantId(Request $request): ?int
    {
        $user = Auth::user();
        if ($user && $user->hasRole('SUPER_ADMIN')) {
            return $request->filled('tenant_id') ? (int) $request->tenant_id : ($user->tenant_id ?: null);
        }
        return $user?->tenant_id;
    }

    public function index(Request $request)
    {
        $tenantId = $this->tenantId($request);
        if (!$tenantId) {
            return $this->sendError('tenant_id requis. Selectionnez une organisation.', [], 400);
        }

        return $this->sendResponse([
            'receivables' => $this->receivables($tenantId),
            'cash'        => $this->cash($tenantId),
            'alerts'      => $this->alerts($tenantId),
            'modules'     => $this->modulesActivity($tenantId),
            'top_debtors' => $this->topDebtors($tenantId),
            'cash_trend'  => $this->cashTrend($tenantId),
            'recent'      => $this->recentMovements($tenantId),
            'generated_at' => now()->toDateTimeString(),
        ], 'Tableau de bord charge');
    }

    /** Reste a recouvrer, factures + ventes conteneurs, avoirs deduits. */
    private function receivables(int $tenantId): array
    {
        $amountCol = Schema::hasColumn('invoices', 'total_amount_gnf') ? 'total_amount_gnf' : 'total_amount';

        $invoiceRemaining = (float) (Invoice::where('tenant_id', $tenantId)
            ->selectRaw("SUM(COALESCE({$amountCol}, total_amount) - COALESCE(paid_amount, 0)) as r")
            ->value('r') ?? 0);

        $containerRemaining = (float) ContainerSale::where('tenant_id', $tenantId)
            ->sum('remaining_amount_gnf');

        $unapplied = (float) Payment::where('tenant_id', $tenantId)
            ->where('status', 'COMPLETED')->where('type', 'CLIENT')
            ->whereNull('invoice_id')->sum('amount_gnf');

        $total = max(0, round($invoiceRemaining + $containerRemaining - $unapplied, 2));

        return [
            'total_gnf'          => $total,
            'from_invoices_gnf'  => round($invoiceRemaining, 2),
            'from_containers_gnf' => round($containerRemaining, 2),
            'client_credit_gnf'  => round($unapplied, 2),
            'debtor_count'       => $this->debtorCount($tenantId),
        ];
    }

    private function debtorCount(int $tenantId): int
    {
        $fromInvoices = Invoice::where('tenant_id', $tenantId)
            ->whereColumn('paid_amount', '<', 'total_amount')
            ->distinct()->pluck('client_id');
        $fromContainers = ContainerSale::where('tenant_id', $tenantId)
            ->where('remaining_amount_gnf', '>', 0)
            ->distinct()->pluck('client_id');

        return $fromInvoices->merge($fromContainers)->filter()->unique()->count();
    }

    /** Encaissements : aujourd'hui et mois en cours, toutes sources confondues. */
    private function cash(int $tenantId): array
    {
        $today = now()->toDateString();
        $monthStart = now()->startOfMonth()->toDateString();

        $sum = fn ($from) => (float) Payment::where('tenant_id', $tenantId)
            ->where('status', 'COMPLETED')
            ->whereDate('payment_date', '>=', $from)
            ->sum('amount_gnf');

        $container = fn ($from) => (float) ContainerSalePayment::where('tenant_id', $tenantId)
            ->whereDate('payment_date', '>=', $from)
            ->sum('amount_gnf');

        return [
            'today_gnf' => round($sum($today) + $container($today), 2),
            'month_gnf' => round($sum($monthStart) + $container($monthStart), 2),
        ];
    }

    /** Ce qui demande une action : retards, ruptures, echeances. */
    private function alerts(int $tenantId): array
    {
        $today = now()->toDateString();
        $horizon = now()->addDays(30)->toDateString();

        $overdue = Invoice::where('tenant_id', $tenantId)
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', $today)
            ->whereColumn('paid_amount', '<', 'total_amount');

        $lowStock = DB::table('products')->whereNull('deleted_at')
            ->where('tenant_id', $tenantId)
            ->whereNotNull('low_stock_threshold')
            ->whereColumn('stock_quantity', '<=', 'low_stock_threshold');

        $outOfStock = DB::table('products')->whereNull('deleted_at')
            ->where('tenant_id', $tenantId)
            ->where('stock_quantity', '<=', 0);

        $vehicleDocs = DB::table('taxis')->whereNull('deleted_at')
            ->where('tenant_id', $tenantId)
            ->where(function ($q) use ($horizon) {
                foreach (['insurance_expiry', 'technical_inspection_expiry', 'circulation_permit_expiry'] as $c) {
                    $q->orWhere(fn ($s) => $s->whereNotNull($c)->whereDate($c, '<=', $horizon));
                }
            });

        $leasesEnding = Schema::hasTable('leases')
            ? DB::table('leases')->whereNull('deleted_at')
                ->where('tenant_id', $tenantId)
                ->whereNotNull('end_date')
                ->whereDate('end_date', '<=', $horizon)
                ->count()
            : 0;

        return [
            'overdue_invoices'      => (clone $overdue)->count(),
            'overdue_amount_gnf'    => round((float) (clone $overdue)
                ->selectRaw('SUM(COALESCE(total_amount_gnf, total_amount) - COALESCE(paid_amount,0)) as r')
                ->value('r') ?? 0, 2),
            'low_stock_products'    => $lowStock->count(),
            'out_of_stock_products' => $outOfStock->count(),
            'vehicle_docs_expiring' => $vehicleDocs->count(),
            'leases_ending'         => $leasesEnding,
        ];
    }

    /** Exploitation par metier. */
    private function modulesActivity(int $tenantId): array
    {
        $today = now()->toDateString();

        $containersPending = DB::table('containers')->whereNull('deleted_at')
            ->where('tenant_id', $tenantId)
            ->where('delivery_status', '!=', 'LIVRE')->count();

        $taxiToday = (float) DB::table('daily_payments')
            ->where('tenant_id', $tenantId)
            ->whereDate('payment_date', $today)
            ->sum('paid_amount');

        // housing_units n'a pas de tenant_id : on remonte par immeuble puis
        // emplacement, sinon on compterait les logements des autres organisations.
        $units = DB::table('housing_units')
            ->join('buildings', 'housing_units.building_id', '=', 'buildings.id')
            ->join('locations', 'buildings.location_id', '=', 'locations.id')
            ->whereNull('housing_units.deleted_at')
            ->where('locations.tenant_id', $tenantId)
            ->selectRaw("SUM(housing_units.status = 'OCCUPE') as occupes, SUM(housing_units.status = 'LIBRE') as libres")
            ->first();

        return [
            'containers_pending' => $containersPending,
            'taxi_collected_today_gnf' => round($taxiToday, 2),
            'housing_occupied' => (int) ($units->occupes ?? 0),
            'housing_free'     => (int) ($units->libres ?? 0),
        ];
    }

    /** Les cinq clients qui doivent le plus, factures et conteneurs confondus. */
    private function topDebtors(int $tenantId): array
    {
        $amountCol = Schema::hasColumn('invoices', 'total_amount_gnf') ? 'total_amount_gnf' : 'total_amount';

        $byInvoice = Invoice::where('tenant_id', $tenantId)
            ->selectRaw("client_id, SUM(COALESCE({$amountCol}, total_amount) - COALESCE(paid_amount,0)) as due")
            ->groupBy('client_id')->pluck('due', 'client_id');

        $byContainer = ContainerSale::where('tenant_id', $tenantId)
            ->selectRaw('client_id, SUM(remaining_amount_gnf) as due')
            ->groupBy('client_id')->pluck('due', 'client_id');

        $credit = Payment::where('tenant_id', $tenantId)
            ->where('status', 'COMPLETED')->where('type', 'CLIENT')->whereNull('invoice_id')
            ->selectRaw('client_id, SUM(amount_gnf) as c')
            ->groupBy('client_id')->pluck('c', 'client_id');

        $totals = [];
        foreach ([$byInvoice, $byContainer] as $set) {
            foreach ($set as $clientId => $due) {
                if (!$clientId) continue;
                $totals[$clientId] = ($totals[$clientId] ?? 0) + (float) $due;
            }
        }
        foreach ($totals as $clientId => $due) {
            $totals[$clientId] = max(0, $due - (float) ($credit[$clientId] ?? 0));
        }

        arsort($totals);
        $top = array_slice($totals, 0, 5, true);
        if (!$top) return [];

        $clients = Client::whereIn('id', array_keys($top))->get(['id', 'name', 'phone1', 'client_type'])->keyBy('id');

        $rows = [];
        foreach ($top as $clientId => $due) {
            if ($due <= 0) continue;
            $c = $clients[$clientId] ?? null;
            $rows[] = [
                'client_id'   => (int) $clientId,
                'name'        => $c?->name ?? 'Client supprime',
                'phone'       => $c?->phone1,
                'client_type' => $c?->client_type,
                'due_gnf'     => round($due, 2),
            ];
        }
        return $rows;
    }

    /** Encaissements des six derniers mois. */
    private function cashTrend(int $tenantId): array
    {
        $start = now()->startOfMonth()->subMonths(5);

        $rows = Payment::where('tenant_id', $tenantId)
            ->where('status', 'COMPLETED')
            ->whereDate('payment_date', '>=', $start->toDateString())
            ->selectRaw("DATE_FORMAT(payment_date, '%Y-%m') as ym, SUM(amount_gnf) as total")
            ->groupBy('ym')->pluck('total', 'ym');

        $out = [];
        for ($i = 0; $i < 6; $i++) {
            $m = (clone $start)->addMonths($i);
            $key = $m->format('Y-m');
            $out[] = [
                'month' => $m->locale('fr')->isoFormat('MMM YY'),
                'total_gnf' => round((float) ($rows[$key] ?? 0), 2),
            ];
        }
        return $out;
    }

    /** Derniers mouvements, pour verifier ce qui vient d'etre saisi. */
    private function recentMovements(int $tenantId): array
    {
        $payments = Payment::with('client:id,name')
            ->where('tenant_id', $tenantId)->where('status', 'COMPLETED')
            ->orderByDesc('payment_date')->orderByDesc('id')->limit(6)
            ->get()
            ->map(fn ($p) => [
                'kind'     => 'payment',
                'label'    => 'Versement — ' . ($p->client?->name ?? 'Client'),
                'amount_gnf' => (float) $p->amount_gnf,
                'date'     => optional($p->payment_date)->format('Y-m-d') ?? (string) $p->payment_date,
                'method'   => $p->method,
            ]);

        $invoices = Invoice::with('client:id,name')
            ->where('tenant_id', $tenantId)
            ->orderByDesc('created_at')->limit(6)
            ->get()
            ->map(fn ($i) => [
                'kind'     => 'invoice',
                'label'    => 'Facture ' . $i->invoice_number . ' — ' . ($i->client?->name ?? 'Client'),
                'amount_gnf' => (float) ($i->total_amount_gnf ?: $i->total_amount),
                'date'     => optional($i->created_at)->format('Y-m-d'),
                'status'   => $i->status,
            ]);

        return $payments->concat($invoices)
            ->sortByDesc('date')->take(8)->values()->all();
    }
}
