<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Container;
use App\Models\Location;
use App\Models\Module;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;
use App\Models\Taxi;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function getStats(): JsonResponse
    {
        try {
            $now = Carbon::now();

            $totalRevenue = (float) SubscriptionPayment::sum('amount');
            $monthlyRevenue = (float) SubscriptionPayment::whereBetween('payment_date', [
                $now->copy()->startOfMonth()->toDateString(),
                $now->copy()->endOfMonth()->toDateString(),
            ])->sum('amount');

            $expiringSoon = Subscription::where('status', 'ACTIVE')
                ->whereBetween('end_date', [
                    $now->copy()->toDateString(),
                    $now->copy()->addDays(30)->toDateString(),
                ])
                ->count();

            $stats = [
                'totalTenants' => Tenant::count(),
                'activeTenants' => Tenant::where('subscription_status', 'ACTIVE')->count(),
                'totalUsers' => User::count(),
                'activeUsers' => User::where('is_active', true)->count(),
                'totalSubscriptions' => Subscription::count(),
                'activeSubscriptions' => Subscription::where('status', 'ACTIVE')->count(),
                'expiredSubscriptions' => Subscription::where('status', 'EXPIRED')->count(),
                'expiringSoonSubscriptions' => $expiringSoon,
                'totalRevenue' => $totalRevenue,
                'monthlyRevenue' => $monthlyRevenue,
                'totalProducts' => Product::count(),
                'totalClients' => Client::count(),
                'totalContainers' => Container::count(),
                'totalTaxis' => Taxi::count(),
                'totalLocations' => Location::count(),
                'totalModules' => Module::where('is_active', true)->count(),
                // Backward-compatible snake_case payload for older dashboards.
                'total_tenants' => Tenant::count(),
                'active_tenants' => Tenant::where('subscription_status', 'ACTIVE')->count(),
                'total_users' => User::count(),
                'active_users' => User::where('is_active', true)->count(),
                'total_subscriptions' => Subscription::count(),
                'active_subscriptions' => Subscription::where('status', 'ACTIVE')->count(),
                'expired_subscriptions' => Subscription::where('status', 'EXPIRED')->count(),
                'expiring_soon_subscriptions' => $expiringSoon,
                'total_revenue' => $totalRevenue,
                'revenue_this_month' => $monthlyRevenue,
                'monthly_revenue' => $monthlyRevenue,
                'total_products' => Product::count(),
                'total_clients' => Client::count(),
                'total_containers' => Container::count(),
                'total_taxis' => Taxi::count(),
                'total_locations' => Location::count(),
                'total_modules' => Module::where('is_active', true)->count(),
                'new_users_this_month' => $this->getNewUsersThisMonth(),
            ];

            return response()->json([
                'success' => true,
                'data' => $stats,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du chargement des statistiques',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function getRecentActivities(Request $request): JsonResponse
    {
        try {
            $limit = max(1, min((int) $request->get('limit', 10), 50));

            $activities = collect();

            $users = User::select('id', 'name', 'created_at')
                ->latest('created_at')
                ->limit($limit)
                ->get()
                ->map(fn (User $user) => [
                    'id' => 'user-' . $user->id,
                    'type' => 'user_created',
                    'title' => 'Nouvel utilisateur',
                    'description' => $user->name . ' a ete cree',
                    'user' => $user->name,
                    'created_at' => optional($user->created_at)->toISOString(),
                ]);

            $subscriptions = Subscription::with(['tenant:id,name', 'plan:id,name'])
                ->latest('created_at')
                ->limit($limit)
                ->get()
                ->map(fn (Subscription $subscription) => [
                    'id' => 'subscription-' . $subscription->id,
                    'type' => 'subscription_activated',
                    'title' => 'Abonnement',
                    'description' => sprintf(
                        '%s - %s (%s)',
                        $subscription->tenant?->name ?? 'Tenant',
                        $subscription->plan?->name ?? 'Plan',
                        $subscription->status
                    ),
                    'user' => $subscription->tenant?->name ?? 'Système',
                    'created_at' => optional($subscription->created_at)->toISOString(),
                ]);

            $tenantModules = DB::table('tenant_modules')
                ->join('tenants', 'tenant_modules.tenant_id', '=', 'tenants.id')
                ->join('modules', 'tenant_modules.module_id', '=', 'modules.id')
                ->select(
                    'tenant_modules.tenant_id',
                    'tenant_modules.module_id',
                    'tenant_modules.created_at',
                    'tenant_modules.updated_at',
                    'tenant_modules.is_active',
                    'tenants.name as tenant_name',
                    'modules.name as module_name'
                )
                ->orderByDesc('tenant_modules.updated_at')
                ->limit($limit)
                ->get()
                ->map(fn ($row) => [
                    'id' => 'tenant-module-' . $row->tenant_id . '-' . $row->module_id,
                    'type' => 'module_enabled',
                    'title' => 'Module',
                    'description' => ($row->module_name ?? 'Module') . (($row->is_active ?? false) ? ' active' : ' inactif'),
                    'user' => $row->tenant_name ?? 'Système',
                    'created_at' => Carbon::parse($row->updated_at ?? $row->created_at)->toISOString(),
                ]);

            $activities = $activities
                ->merge($users)
                ->merge($subscriptions)
                ->merge($tenantModules)
                ->sortByDesc('created_at')
                ->take($limit)
                ->values();

            return response()->json([
                'success' => true,
                'data' => $activities,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du chargement des activites recentes',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function getSubscriptionTrends(): JsonResponse
    {
        try {
            $start = now()->subMonths(5)->startOfMonth();
            $months = collect(range(0, 5))->map(fn (int $offset) => $start->copy()->addMonths($offset));

            $createdByMonth = Subscription::selectRaw('DATE_FORMAT(created_at, "%Y-%m") as period, COUNT(*) as total')
                ->where('created_at', '>=', $start)
                ->groupBy('period')
                ->pluck('total', 'period');

            $expiredByMonth = Subscription::selectRaw('DATE_FORMAT(end_date, "%Y-%m") as period, COUNT(*) as total')
                ->whereNotNull('end_date')
                ->where('end_date', '>=', $start->toDateString())
                ->where('status', 'EXPIRED')
                ->groupBy('period')
                ->pluck('total', 'period');

            $labels = [];
            $created = [];
            $expired = [];

            foreach ($months as $month) {
                $key = $month->format('Y-m');
                $labels[] = $month->translatedFormat('M');
                $created[] = (int) ($createdByMonth[$key] ?? 0);
                $expired[] = (int) ($expiredByMonth[$key] ?? 0);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'labels' => $labels,
                    'datasets' => [
                        [
                            'label' => 'Nouveaux abonnements',
                            'data' => $created,
                        ],
                        [
                            'label' => 'Abonnements expires',
                            'data' => $expired,
                        ],
                    ],
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du chargement des tendances d\'abonnement',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function getRevenueChart(Request $request): JsonResponse
    {
        try {
            $period = $request->get('period', '12months');
            $monthsBack = $period === '6months' ? 5 : 11;
            $start = now()->subMonths($monthsBack)->startOfMonth();
            $months = collect(range(0, $monthsBack))->map(fn (int $offset) => $start->copy()->addMonths($offset));

            $paymentsByMonth = SubscriptionPayment::selectRaw('DATE_FORMAT(payment_date, "%Y-%m") as period, COALESCE(SUM(amount), 0) as total')
                ->where('payment_date', '>=', $start->toDateString())
                ->groupBy('period')
                ->pluck('total', 'period');

            $labels = [];
            $values = [];

            foreach ($months as $month) {
                $key = $month->format('Y-m');
                $labels[] = $month->translatedFormat('M');
                $values[] = (float) ($paymentsByMonth[$key] ?? 0);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'labels' => $labels,
                    'datasets' => [
                        [
                            'label' => 'Revenus',
                            'data' => $values,
                        ],
                    ],
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du chargement des donnees de revenus',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function getModuleUsage(): JsonResponse
    {
        try {
            $usage = DB::table('tenant_modules')
                ->join('modules', 'tenant_modules.module_id', '=', 'modules.id')
                ->where('tenant_modules.is_active', true)
                ->groupBy('modules.id', 'modules.name')
                ->selectRaw('modules.name as module_name, COUNT(*) as usage_count')
                ->orderByDesc('usage_count')
                ->get();

            $totalUsage = max(1, (int) $usage->sum('usage_count'));

            $moduleUsage = $usage->map(fn ($row) => [
                'module_name' => $row->module_name,
                'usage_count' => (int) $row->usage_count,
                'percentage' => round(((int) $row->usage_count / $totalUsage) * 100, 1),
            ])->values();

            return response()->json([
                'success' => true,
                'data' => $moduleUsage,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du chargement des statistiques d\'utilisation des modules',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function getNewUsersThisMonth(): int
    {
        return User::whereMonth('created_at', Carbon::now()->month)
            ->whereYear('created_at', Carbon::now()->year)
            ->count();
    }
}
