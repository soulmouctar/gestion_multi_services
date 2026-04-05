<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TaxiDashboardController extends BaseController
{
    private function tid(): int
    {
        return (int) (auth()->user()?->tenant_id ?? 1);
    }

    public function dashboard(Request $request)
    {
        try {
            $tid   = $this->tid();
            $today = now()->format('Y-m-d');
            $currentMonth = now()->format('Y-m');

            // ── Flotte ──────────────────────────────────────────────────────
            $fleetStats = DB::table('taxis')
                ->where('tenant_id', $tid)
                ->selectRaw('
                    COUNT(*) as total,
                    SUM(CASE WHEN status = "ACTIVE"      THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN status = "MAINTENANCE" THEN 1 ELSE 0 END) as maintenance,
                    SUM(CASE WHEN status = "INACTIVE"    THEN 1 ELSE 0 END) as inactive
                ')
                ->first();

            // ── Conducteurs ─────────────────────────────────────────────────
            $driverStats = DB::table('drivers')
                ->where('tenant_id', $tid)
                ->selectRaw('
                    COUNT(*) as total,
                    SUM(CASE WHEN status = "ACTIVE"    THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN status = "SUSPENDED" THEN 1 ELSE 0 END) as suspended
                ')
                ->first();

            // ── Versements d'aujourd'hui ─────────────────────────────────────
            $todayCollected = DB::table('daily_payments')
                ->where('tenant_id', $tid)
                ->where('payment_date', $today)
                ->sum('paid_amount');

            $todayCount = DB::table('daily_payments')
                ->where('tenant_id', $tid)
                ->where('payment_date', $today)
                ->count();

            // ── Versements du mois ───────────────────────────────────────────
            $monthCollected = DB::table('daily_payments')
                ->where('tenant_id', $tid)
                ->where('payment_date', 'like', $currentMonth . '%')
                ->sum('paid_amount');

            // ── Dépenses du mois ─────────────────────────────────────────────
            $monthExpenses = DB::table('vehicle_expenses')
                ->where('tenant_id', $tid)
                ->where('expense_date', 'like', $currentMonth . '%')
                ->sum('amount');

            $netMonth = (float) $monthCollected - (float) $monthExpenses;

            // ── Top conducteurs ce mois ──────────────────────────────────────
            $topDrivers = DB::table('daily_payments')
                ->join('drivers', 'daily_payments.driver_id', '=', 'drivers.id')
                ->where('daily_payments.tenant_id', $tid)
                ->where('daily_payments.payment_date', 'like', $currentMonth . '%')
                ->groupBy('drivers.id', 'drivers.name', 'drivers.phone')
                ->selectRaw('
                    drivers.id,
                    drivers.name,
                    drivers.phone,
                    COUNT(daily_payments.id) as payment_count,
                    COALESCE(SUM(daily_payments.paid_amount), 0) as total_collected
                ')
                ->orderByDesc('total_collected')
                ->limit(5)
                ->get();

            // ── Revenus 12 mois ──────────────────────────────────────────────
            $monthlyRevenue = DB::table('daily_payments')
                ->where('tenant_id', $tid)
                ->where('payment_date', '>=', now()->subMonths(11)->startOfMonth()->format('Y-m-d'))
                ->selectRaw("DATE_FORMAT(payment_date, '%Y-%m') as month, COALESCE(SUM(paid_amount),0) as collected, COUNT(*) as payments")
                ->groupBy(DB::raw("DATE_FORMAT(payment_date, '%Y-%m')"))
                ->orderBy('month')
                ->get();

            // ── Dépenses 12 mois par type ────────────────────────────────────
            $monthlyExpenses = DB::table('vehicle_expenses')
                ->where('tenant_id', $tid)
                ->where('expense_date', '>=', now()->subMonths(11)->startOfMonth()->format('Y-m-d'))
                ->selectRaw("DATE_FORMAT(expense_date, '%Y-%m') as month, COALESCE(SUM(amount),0) as total, expense_type")
                ->groupBy(DB::raw("DATE_FORMAT(expense_date, '%Y-%m')"), 'expense_type')
                ->orderBy('month')
                ->get();

            // ── Alertes documents (expiry < 60 jours) ───────────────────────
            $documentAlerts = DB::table('taxis')
                ->where('tenant_id', $tid)
                ->where(function ($q) use ($today) {
                    $in60 = now()->addDays(60)->format('Y-m-d');
                    $q->where('insurance_expiry', '<=', $in60)
                      ->orWhere('technical_inspection_expiry', '<=', $in60)
                      ->orWhere('circulation_permit_expiry', '<=', $in60);
                })
                ->select('id', 'plate_number', 'brand', 'vehicle_model',
                    'insurance_expiry', 'technical_inspection_expiry', 'circulation_permit_expiry', 'status')
                ->orderBy('plate_number')
                ->get()
                ->map(function ($t) use ($today) {
                    $t->alerts = [];
                    foreach (['insurance_expiry', 'technical_inspection_expiry', 'circulation_permit_expiry'] as $field) {
                        if ($t->$field) {
                            $days = now()->diffInDays($t->$field, false);
                            if ($days <= 60) {
                                $t->alerts[] = [
                                    'field'   => $field,
                                    'days'    => (int) $days,
                                    'urgency' => $days < 0 ? 'expired' : ($days <= 15 ? 'danger' : ($days <= 30 ? 'warning' : 'info')),
                                ];
                            }
                        }
                    }
                    return $t;
                });

            // ── Performance par véhicule ce mois ────────────────────────────
            $vehiclePerformance = DB::table('taxis')
                ->leftJoin('daily_payments', function ($j) use ($tid, $currentMonth) {
                    $j->on('daily_payments.taxi_id', '=', 'taxis.id')
                      ->where('daily_payments.tenant_id', '=', $tid)
                      ->where('daily_payments.payment_date', 'like', $currentMonth . '%');
                })
                ->where('taxis.tenant_id', $tid)
                ->groupBy('taxis.id', 'taxis.plate_number', 'taxis.brand', 'taxis.vehicle_model', 'taxis.status')
                ->selectRaw('
                    taxis.id,
                    taxis.plate_number,
                    taxis.brand,
                    taxis.vehicle_model,
                    taxis.status,
                    COUNT(daily_payments.id) as payment_days,
                    COALESCE(SUM(daily_payments.paid_amount), 0) as monthly_collected
                ')
                ->orderByDesc('monthly_collected')
                ->get();

            return $this->sendResponse([
                'fleet'              => $fleetStats,
                'drivers'            => $driverStats,
                'today' => [
                    'collected'      => (float) $todayCollected,
                    'payment_count'  => (int)   $todayCount,
                ],
                'month' => [
                    'collected'      => (float) $monthCollected,
                    'expenses'       => (float) $monthExpenses,
                    'net'            => $netMonth,
                ],
                'top_drivers'        => $topDrivers,
                'monthly_revenue'    => $monthlyRevenue,
                'monthly_expenses'   => $monthlyExpenses,
                'document_alerts'    => $documentAlerts,
                'vehicle_performance'=> $vehiclePerformance,
                'period'             => $currentMonth,
            ], 'Dashboard retrieved');

        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }

    public function documents(Request $request)
    {
        try {
            $tid   = $this->tid();
            $today = now()->format('Y-m-d');

            $vehicles = DB::table('taxis')
                ->where('tenant_id', $tid)
                ->select(
                    'id', 'plate_number', 'brand', 'vehicle_model', 'year', 'color', 'status',
                    'insurance_expiry', 'technical_inspection_expiry', 'circulation_permit_expiry', 'mileage', 'notes'
                )
                ->orderBy('plate_number')
                ->get()
                ->map(function ($v) use ($today) {
                    foreach (['insurance_expiry', 'technical_inspection_expiry', 'circulation_permit_expiry'] as $field) {
                        $key = $field . '_status';
                        if (!$v->$field) {
                            $v->$key = 'missing';
                        } else {
                            $days = now()->diffInDays($v->$field, false);
                            if ($days < 0)      $v->$key = 'expired';
                            elseif ($days <= 15) $v->$key = 'danger';
                            elseif ($days <= 30) $v->$key = 'warning';
                            elseif ($days <= 60) $v->$key = 'info';
                            else                 $v->$key = 'ok';
                        }
                    }
                    return $v;
                });

            // Résumé global des alertes
            $summary = [
                'expired' => 0, 'danger' => 0, 'warning' => 0, 'info' => 0, 'ok' => 0, 'missing' => 0,
            ];
            foreach ($vehicles as $v) {
                foreach (['insurance_expiry_status', 'technical_inspection_expiry_status', 'circulation_permit_expiry_status'] as $s) {
                    if (isset($summary[$v->$s])) $summary[$v->$s]++;
                }
            }

            return $this->sendResponse([
                'vehicles' => $vehicles,
                'summary'  => $summary,
            ], 'Documents retrieved');

        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }
}
