import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService, DashboardStats, RecentActivity, SubscriptionTrend, RevenueChart, ModuleUsage, ApiResponse } from '../../core/services/dashboard.service';
import { SubscriptionService } from '../../core/services/subscription.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  loading = true;
  stats: DashboardStats = {
    totalTenants: 0,
    activeTenants: 0,
    totalUsers: 0,
    activeUsers: 0,
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    expiredSubscriptions: 0,
    expiringSoonSubscriptions: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalProducts: 0,
    totalClients: 0,
    totalContainers: 0,
    totalTaxis: 0,
    totalLocations: 0
  };

  recentActivities: RecentActivity[] = [];
  subscriptionTrends: SubscriptionTrend[] = [];
  revenueChart: RevenueChart[] = [];
  moduleUsage: ModuleUsage[] = [];

  // Chart configurations
  subscriptionChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Évolution des Abonnements'
      }
    }
  };

  revenueChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Revenus Mensuels'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return 'GNF' + value.toLocaleString();
          }
        }
      }
    }
  };

  constructor(
    private dashboardService: DashboardService,
    private subscriptionService: SubscriptionService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    
    // Charger les statistiques principales
    this.dashboardService.getDashboardStats().subscribe({
      next: (response: ApiResponse<DashboardStats>) => {
        this.stats = response.data;
      },
      error: (error) => {
        console.error('Error loading dashboard stats:', error);
        // Utiliser des données mockées en cas d'erreur
        this.loadMockStats();
      }
    });

    // Charger les activités récentes
    this.dashboardService.getRecentActivities().subscribe({
      next: (response: ApiResponse<RecentActivity[]>) => {
        this.recentActivities = response.data;
      },
      error: (error) => {
        console.error('Error loading recent activities:', error);
        this.loadMockActivities();
      }
    });

    // Charger les tendances des abonnements
    this.dashboardService.getSubscriptionTrends().subscribe({
      next: (response: ApiResponse<SubscriptionTrend[]>) => {
        this.subscriptionTrends = response.data || [];
        this.prepareSubscriptionChartData();
      },
      error: (error) => {
        console.error('Error loading subscription trends:', error);
        this.loadMockTrends();
      }
    });

    // Charger le graphique des revenus
    this.dashboardService.getRevenueChart().subscribe({
      next: (response: ApiResponse<RevenueChart[]>) => {
        this.revenueChart = response.data || [];
        this.prepareRevenueChartData();
      },
      error: (error) => {
        console.error('Error loading revenue chart:', error);
        this.loadMockRevenue();
      }
    });

    // Charger l'utilisation des modules
    this.dashboardService.getModuleUsage().subscribe({
      next: (response: ApiResponse<ModuleUsage[]>) => {
        this.moduleUsage = response.data;
      },
      error: (error) => {
        console.error('Error loading module usage:', error);
        this.loadMockModuleUsage();
      }
    });

    // Simuler un temps de chargement
    setTimeout(() => {
      this.loading = false;
    }, 1000);
  }

  private loadMockStats(): void {
    this.stats = {
      totalTenants: 12,
      activeTenants: 8,
      totalUsers: 45,
      activeUsers: 32,
      totalSubscriptions: 15,
      activeSubscriptions: 12,
      expiredSubscriptions: 2,
      expiringSoonSubscriptions: 1,
      totalRevenue: 12500,
      monthlyRevenue: 2100,
      totalProducts: 156,
      totalClients: 89,
      totalContainers: 24,
      totalTaxis: 18,
      totalLocations: 31
    };
  }

  private loadMockActivities(): void {
    this.recentActivities = [
      {
        id: 1,
        type: 'subscription',
        title: 'Nouvel abonnement',
        description: 'Tenant Alpha a souscrit au plan Premium',
        timestamp: '2024-01-15T10:30:00Z',
        icon: 'cil-credit-card',
        color: 'success'
      },
      {
        id: 2,
        type: 'user',
        title: 'Nouvel utilisateur',
        description: 'Jean Dupont a rejoint Tenant Beta',
        timestamp: '2024-01-15T09:15:00Z',
        icon: 'cil-user',
        color: 'info'
      },
      {
        id: 3,
        type: 'tenant',
        title: 'Tenant créé',
        description: 'Nouveau tenant : Gamma Corporation',
        timestamp: '2024-01-14T16:45:00Z',
        icon: 'cil-building',
        color: 'primary'
      }
    ];
  }

  private loadMockTrends(): void {
    this.subscriptionTrends = [
      { month: 'Jan', active: 10, expired: 2, new: 3 },
      { month: 'Fév', active: 12, expired: 1, new: 4 },
      { month: 'Mar', active: 15, expired: 2, new: 5 },
      { month: 'Avr', active: 18, expired: 1, new: 4 },
      { month: 'Mai', active: 20, expired: 3, new: 6 },
      { month: 'Jun', active: 22, expired: 2, new: 5 }
    ];
    this.prepareSubscriptionChartData();
  }

  private loadMockRevenue(): void {
    this.revenueChart = [
      { month: 'Jan', revenue: 1500, subscriptions: 8 },
      { month: 'Fév', revenue: 1800, subscriptions: 10 },
      { month: 'Mar', revenue: 2100, subscriptions: 12 },
      { month: 'Avr', revenue: 1950, subscriptions: 11 },
      { month: 'Mai', revenue: 2300, subscriptions: 13 },
      { month: 'Jun', revenue: 2500, subscriptions: 14 }
    ];
    this.prepareRevenueChartData();
  }

  private loadMockModuleUsage(): void {
    this.moduleUsage = [
      { module: 'COMMERCIAL', name: 'Gestion Commerciale', activeUsers: 25, totalUsers: 30, usagePercentage: 83, icon: 'cil-cart', color: 'primary' },
      { module: 'FINANCE', name: 'Gestion Financière', activeUsers: 20, totalUsers: 25, usagePercentage: 80, icon: 'cil-dollar', color: 'success' },
      { module: 'PRODUCTS_STOCK', name: 'Produits & Stock', activeUsers: 18, totalUsers: 28, usagePercentage: 64, icon: 'cil-box', color: 'info' },
      { module: 'CLIENTS_SUPPLIERS', name: 'Clients & Fournisseurs', activeUsers: 22, totalUsers: 32, usagePercentage: 69, icon: 'cil-people', color: 'warning' },
      { module: 'CONTAINERS', name: 'Conteneurs', activeUsers: 12, totalUsers: 15, usagePercentage: 80, icon: 'cil-truck', color: 'danger' }
    ];
  }

  private prepareSubscriptionChartData(): void {
    if (!Array.isArray(this.subscriptionTrends)) {
      console.warn('subscriptionTrends is not an array:', this.subscriptionTrends);
      this.subscriptionTrends = [];
      return;
    }

    this.subscriptionChartOptions.data = {
      labels: this.subscriptionTrends.map(t => t.month),
      datasets: [
        {
          label: 'Actifs',
          data: this.subscriptionTrends.map(t => t.active),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1
        },
        {
          label: 'Expirés',
          data: this.subscriptionTrends.map(t => t.expired),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.1
        },
        {
          label: 'Nouveaux',
          data: this.subscriptionTrends.map(t => t.new),
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          tension: 0.1
        }
      ]
    };
  }

  private prepareRevenueChartData(): void {
    if (!Array.isArray(this.revenueChart)) {
      console.warn('revenueChart is not an array:', this.revenueChart);
      this.revenueChart = [];
      return;
    }

    this.revenueChartOptions.data = {
      labels: this.revenueChart.map(r => r.month),
      datasets: [
        {
          label: 'Revenus (GNF)',
          data: this.revenueChart.map(r => r.revenue),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
          fill: true
        }
      ]
    };
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) {
      return 'Il y a quelques minutes';
    } else if (hours < 24) {
      return `Il y a ${hours} heure${hours > 1 ? 's' : ''}`;
    } else if (days < 7) {
      return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
    } else {
      return date.toLocaleDateString('fr-FR');
    }
  }

  getUsageColor(percentage: number): string {
    if (percentage >= 80) return 'success';
    if (percentage >= 60) return 'warning';
    return 'danger';
  }

  refreshData(): void {
    this.loadDashboardData();
  }
}
