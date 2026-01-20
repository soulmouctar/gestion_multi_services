<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\User;
use App\Models\Subscription;
use App\Models\Module;
use App\Models\Tenant;
use Carbon\Carbon;

class DashboardController extends Controller
{
    /**
     * Get dashboard statistics
     */
    public function getStats(): JsonResponse
    {
        try {
            $stats = [
                'total_users' => User::count(),
                'active_subscriptions' => Subscription::where('status', 'ACTIVE')->count(),
                'total_tenants' => Tenant::count(),
                'total_modules' => Module::where('is_active', true)->count(),
                'revenue_this_month' => $this->getRevenueThisMonth(),
                'new_users_this_month' => $this->getNewUsersThisMonth(),
            ];

            return response()->json([
                'success' => true,
                'data' => $stats
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du chargement des statistiques',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get recent activities
     */
    public function getRecentActivities(Request $request): JsonResponse
    {
        try {
            $limit = $request->get('limit', 10);
            
            // Simuler des activités récentes pour le moment
            $activities = [
                [
                    'id' => 1,
                    'type' => 'user_created',
                    'description' => 'Nouvel utilisateur créé',
                    'user' => 'John Doe',
                    'created_at' => Carbon::now()->subMinutes(5)->toISOString(),
                ],
                [
                    'id' => 2,
                    'type' => 'subscription_activated',
                    'description' => 'Abonnement activé',
                    'user' => 'Jane Smith',
                    'created_at' => Carbon::now()->subHours(2)->toISOString(),
                ],
                [
                    'id' => 3,
                    'type' => 'module_enabled',
                    'description' => 'Module Finance activé',
                    'user' => 'Admin',
                    'created_at' => Carbon::now()->subHours(4)->toISOString(),
                ],
            ];

            return response()->json([
                'success' => true,
                'data' => array_slice($activities, 0, $limit)
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du chargement des activités récentes',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get subscription trends
     */
    public function getSubscriptionTrends(): JsonResponse
    {
        try {
            // Simuler des données de tendances pour le moment
            $trends = [
                'labels' => ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun'],
                'datasets' => [
                    [
                        'label' => 'Nouveaux abonnements',
                        'data' => [12, 19, 15, 25, 22, 30],
                        'backgroundColor' => 'rgba(54, 162, 235, 0.2)',
                        'borderColor' => 'rgba(54, 162, 235, 1)',
                    ],
                    [
                        'label' => 'Abonnements annulés',
                        'data' => [2, 3, 1, 4, 2, 3],
                        'backgroundColor' => 'rgba(255, 99, 132, 0.2)',
                        'borderColor' => 'rgba(255, 99, 132, 1)',
                    ]
                ]
            ];

            return response()->json([
                'success' => true,
                'data' => $trends
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du chargement des tendances d\'abonnement',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get revenue chart data
     */
    public function getRevenueChart(Request $request): JsonResponse
    {
        try {
            $period = $request->get('period', '12months');
            
            // Simuler des données de revenus pour le moment
            $revenueData = [
                'labels' => ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'],
                'datasets' => [
                    [
                        'label' => 'Revenus (€)',
                        'data' => [1200, 1900, 1500, 2500, 2200, 3000, 2800, 3200, 2900, 3500, 3100, 3800],
                        'backgroundColor' => 'rgba(75, 192, 192, 0.2)',
                        'borderColor' => 'rgba(75, 192, 192, 1)',
                        'fill' => true,
                    ]
                ]
            ];

            return response()->json([
                'success' => true,
                'data' => $revenueData
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du chargement des données de revenus',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get module usage statistics
     */
    public function getModuleUsage(): JsonResponse
    {
        try {
            // Simuler des données d'utilisation des modules
            $moduleUsage = [
                [
                    'module_name' => 'Finance',
                    'usage_count' => 150,
                    'percentage' => 35.5
                ],
                [
                    'module_name' => 'Produits & Stock',
                    'usage_count' => 120,
                    'percentage' => 28.4
                ],
                [
                    'module_name' => 'Conteneurs',
                    'usage_count' => 80,
                    'percentage' => 18.9
                ],
                [
                    'module_name' => 'Location',
                    'usage_count' => 45,
                    'percentage' => 10.7
                ],
                [
                    'module_name' => 'Transport',
                    'usage_count' => 28,
                    'percentage' => 6.6
                ]
            ];

            return response()->json([
                'success' => true,
                'data' => $moduleUsage
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du chargement des statistiques d\'utilisation des modules',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get revenue for current month
     */
    private function getRevenueThisMonth(): float
    {
        // Simuler le calcul des revenus du mois en cours
        return 15750.50;
    }

    /**
     * Get new users count for current month
     */
    private function getNewUsersThisMonth(): int
    {
        return User::whereMonth('created_at', Carbon::now()->month)
                  ->whereYear('created_at', Carbon::now()->year)
                  ->count();
    }
}
