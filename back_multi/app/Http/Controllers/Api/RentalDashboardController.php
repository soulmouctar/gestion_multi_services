<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RentalDashboardController extends BaseController
{
    private function tid(): int
    {
        return (int) (auth()->user()?->tenant_id ?? 1);
    }

    public function dashboard(Request $request)
    {
        try {
            $tid = $this->tid();
            $today = now()->format('Y-m-d');
            $currentMonth = now()->format('Y-m');

            // ── Occupation ──────────────────────────────────────────────
            $unitStats = DB::table('housing_units')
                ->join('floors', 'housing_units.floor_id', '=', 'floors.id')
                ->join('buildings', 'floors.building_id', '=', 'buildings.id')
                ->join('locations', 'buildings.location_id', '=', 'locations.id')
                ->where('locations.tenant_id', $tid)
                ->selectRaw('
                    COUNT(*) as total_units,
                    SUM(CASE WHEN housing_units.status = "OCCUPE" THEN 1 ELSE 0 END) as occupied,
                    SUM(CASE WHEN housing_units.status = "LIBRE" THEN 1 ELSE 0 END) as free
                ')
                ->first();

            $totalUnits  = (int)  ($unitStats->total_units ?? 0);
            $occupied    = (int)  ($unitStats->occupied ?? 0);
            $free        = (int)  ($unitStats->free ?? 0);
            $occupancyRate = $totalUnits > 0 ? round($occupied / $totalUnits * 100, 1) : 0;

            // ── Revenus mois courant ─────────────────────────────────────
            $expectedMonthly = DB::table('leases')
                ->where('tenant_id', $tid)
                ->where('status', 'ACTIVE')
                ->sum('monthly_rent');

            $collectedMonth = DB::table('lease_payments')
                ->where('tenant_id', $tid)
                ->where('status', 'PAID')
                ->where('period_month', $currentMonth)
                ->sum('amount');

            $collectionRate = $expectedMonthly > 0
                ? round($collectedMonth / $expectedMonthly * 100, 1)
                : 0;

            // ── Baux actifs ──────────────────────────────────────────────
            $leaseStats = DB::table('leases')
                ->where('tenant_id', $tid)
                ->selectRaw('
                    COUNT(*) as total,
                    SUM(CASE WHEN status = "ACTIVE"     THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN status = "PENDING"    THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = "EXPIRED"    THEN 1 ELSE 0 END) as expired_count,
                    SUM(CASE WHEN status = "TERMINATED" THEN 1 ELSE 0 END) as terminated_count,
                    COALESCE(SUM(deposit_amount), 0) as total_deposits
                ')
                ->first();

            // ── Baux expirant bientôt (30 / 60 / 90 jours) ──────────────
            $expiringSoon = DB::table('leases')
                ->join('housing_units', 'leases.housing_unit_id', '=', 'housing_units.id')
                ->where('leases.tenant_id', $tid)
                ->where('leases.status', 'ACTIVE')
                ->whereNotNull('leases.end_date')
                ->where('leases.end_date', '>=', $today)
                ->where('leases.end_date', '<=', now()->addDays(90)->format('Y-m-d'))
                ->select(
                    'leases.id',
                    'leases.renter_name',
                    'leases.renter_phone',
                    'leases.end_date',
                    'leases.monthly_rent',
                    'leases.currency',
                    'housing_units.id as unit_id'
                )
                ->orderBy('leases.end_date')
                ->get()
                ->map(function ($l) use ($today) {
                    $l->days_remaining = now()->diffInDays($l->end_date);
                    $l->urgency = $l->days_remaining <= 30 ? 'danger'
                        : ($l->days_remaining <= 60 ? 'warning' : 'info');
                    return $l;
                });

            // ── Paiements en retard / en attente ─────────────────────────
            $latePayments = DB::table('lease_payments')
                ->join('leases', 'lease_payments.lease_id', '=', 'leases.id')
                ->where('lease_payments.tenant_id', $tid)
                ->whereIn('lease_payments.status', ['LATE', 'PENDING'])
                ->select(
                    'lease_payments.id',
                    'lease_payments.period_month',
                    'lease_payments.amount',
                    'lease_payments.currency',
                    'lease_payments.status',
                    'leases.renter_name',
                    'leases.renter_phone',
                    'leases.housing_unit_id'
                )
                ->orderBy('lease_payments.period_month')
                ->limit(20)
                ->get();

            // ── Occupation par bâtiment ──────────────────────────────────
            $byBuilding = DB::table('buildings')
                ->join('locations', 'buildings.location_id', '=', 'locations.id')
                ->join('floors', 'floors.building_id', '=', 'buildings.id')
                ->join('housing_units', 'housing_units.floor_id', '=', 'floors.id')
                ->where('locations.tenant_id', $tid)
                ->groupBy('buildings.id', 'buildings.name', 'locations.name')
                ->selectRaw('
                    buildings.id,
                    buildings.name as building_name,
                    locations.name as location_name,
                    COUNT(housing_units.id) as total_units,
                    SUM(CASE WHEN housing_units.status = "OCCUPE" THEN 1 ELSE 0 END) as occupied,
                    SUM(CASE WHEN housing_units.status = "LIBRE" THEN 1 ELSE 0 END) as free,
                    COALESCE(SUM(CASE WHEN housing_units.status = "OCCUPE" THEN housing_units.rent_amount ELSE 0 END), 0) as monthly_revenue
                ')
                ->orderByDesc('total_units')
                ->get()
                ->map(function ($b) {
                    $b->occupancy_rate = $b->total_units > 0
                        ? round($b->occupied / $b->total_units * 100, 1) : 0;
                    return $b;
                });

            // ── Évolution 12 mois ────────────────────────────────────────
            $monthlyRevenue = DB::table('lease_payments')
                ->where('tenant_id', $tid)
                ->where('status', 'PAID')
                ->where('period_month', '>=', now()->subMonths(11)->format('Y-m'))
                ->groupBy('period_month')
                ->selectRaw('period_month as month, COALESCE(SUM(amount),0) as collected, COUNT(*) as payments')
                ->orderBy('period_month')
                ->get();

            return $this->sendResponse([
                'occupancy' => [
                    'total_units'    => $totalUnits,
                    'occupied'       => $occupied,
                    'free'           => $free,
                    'occupancy_rate' => $occupancyRate,
                ],
                'revenue' => [
                    'expected_monthly' => (float) $expectedMonthly,
                    'collected_month'  => (float) $collectedMonth,
                    'collection_rate'  => $collectionRate,
                    'total_deposits'   => (float) ($leaseStats->total_deposits ?? 0),
                ],
                'leases'          => $leaseStats,
                'expiring_soon'   => $expiringSoon,
                'late_payments'   => $latePayments,
                'by_building'     => $byBuilding,
                'monthly_revenue' => $monthlyRevenue,
                'period'          => $currentMonth,
            ], 'Dashboard retrieved');

        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }

    public function tenants(Request $request)
    {
        $tid    = $this->tid();
        $search = $request->get('search');
        $status = $request->get('status');

        $query = DB::table('leases')
            ->where('leases.tenant_id', $tid)
            ->groupBy(
                'leases.renter_name',
                'leases.renter_phone',
                'leases.renter_email'
            )
            ->selectRaw('
                leases.renter_name,
                leases.renter_phone,
                leases.renter_email,
                COUNT(*) as total_leases,
                SUM(CASE WHEN leases.status = "ACTIVE" THEN 1 ELSE 0 END) as active_leases,
                MAX(leases.start_date) as latest_start,
                COALESCE(SUM(leases.deposit_amount), 0) as total_deposits,
                COALESCE(SUM(CASE WHEN leases.status = "ACTIVE" THEN leases.monthly_rent ELSE 0 END), 0) as current_monthly_rent
            ');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('leases.renter_name', 'like', "%$search%")
                  ->orWhere('leases.renter_phone', 'like', "%$search%")
                  ->orWhere('leases.renter_email', 'like', "%$search%");
            });
        }
        if ($status === 'active')   $query->havingRaw('active_leases > 0');
        if ($status === 'inactive') $query->havingRaw('active_leases = 0');

        $tenants = $query->orderBy('leases.renter_name')->get();

        return $this->sendResponse($tenants, 'Tenants retrieved');
    }
}
