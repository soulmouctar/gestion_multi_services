import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BadgeModule, ButtonModule, CardModule, GridModule, SpinnerModule } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { forkJoin } from 'rxjs';
import { DashboardService, DashboardStats } from '../../../core/services/dashboard.service';

interface ModuleUsageRow {
  module_name: string;
  usage_count: number;
  percentage: number;
}

interface RevenueRow {
  month: string;
  value: number;
}

interface TrendRow {
  month: string;
  created: number;
  canceled: number;
}

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BadgeModule,
    ButtonModule,
    CardModule,
    GridModule,
    SpinnerModule,
    IconDirective
  ],
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.scss']
})
export class StatisticsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  loading = true;
  error = false;

  stats: DashboardStats | null = null;
  recentActivities: any[] = [];
  moduleUsage: ModuleUsageRow[] = [];
  revenueRows: RevenueRow[] = [];
  trendRows: TrendRow[] = [];

  readonly quickActions = [
    { label: 'Tenants', link: '/admin/tenants', icon: 'cilHome', tone: 'primary' },
    { label: 'Modules', link: '/admin/modules', icon: 'cilPuzzle', tone: 'info' },
    { label: 'Abonnements', link: '/admin/subscriptions', icon: 'cilCreditCard', tone: 'success' },
    { label: 'Plans', link: '/admin/subscription-plans', icon: 'cilLayers', tone: 'warning' },
    { label: 'Utilisateurs', link: '/admin/users', icon: 'cilPeople', tone: 'danger' },
    { label: 'Rôles', link: '/admin/roles', icon: 'cilShieldAlt', tone: 'secondary' }
  ];

  constructor(private readonly dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;
    this.error = false;

    forkJoin({
      stats: this.dashboardService.getDashboardStats(),
      activities: this.dashboardService.getRecentActivities(6),
      usage: this.dashboardService.getModuleUsage(),
      trends: this.dashboardService.getSubscriptionTrends(),
      revenue: this.dashboardService.getRevenueChart('12months')
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ stats, activities, usage, trends, revenue }) => {
        this.stats = stats.success ? this.normalizeStats(stats.data as any) : null;
        this.recentActivities = activities.success ? (activities.data || []) : [];
        this.moduleUsage = usage.success ? ((usage.data as any) || []) : [];

        const revenueData: any = revenue.data as any;
        const trendsData: any = trends.data as any;

        this.revenueRows = this.mapChartRows(revenueData?.labels || [], revenueData?.datasets?.[0]?.data || []);
        this.trendRows = this.mapTrendRows(
          trendsData?.labels || [],
          trendsData?.datasets?.[0]?.data || [],
          trendsData?.datasets?.[1]?.data || []
        );
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      }
    });
  }

  mapChartRows(labels: string[], values: number[]): RevenueRow[] {
    return labels.map((month, index) => ({
      month,
      value: Number(values[index] || 0)
    }));
  }

  mapTrendRows(labels: string[], created: number[], canceled: number[]): TrendRow[] {
    return labels.map((month, index) => ({
      month,
      created: Number(created[index] || 0),
      canceled: Number(canceled[index] || 0)
    }));
  }

  normalizeStats(raw: any): DashboardStats | null {
    if (!raw) return null;

    return {
      totalTenants: raw.totalTenants ?? raw.total_tenants ?? 0,
      activeTenants: raw.activeTenants ?? raw.active_tenants ?? 0,
      totalUsers: raw.totalUsers ?? raw.total_users ?? 0,
      activeUsers: raw.activeUsers ?? raw.active_users ?? 0,
      totalSubscriptions: raw.totalSubscriptions ?? raw.total_subscriptions ?? 0,
      activeSubscriptions: raw.activeSubscriptions ?? raw.active_subscriptions ?? 0,
      expiredSubscriptions: raw.expiredSubscriptions ?? raw.expired_subscriptions ?? 0,
      expiringSoonSubscriptions: raw.expiringSoonSubscriptions ?? raw.expiring_soon_subscriptions ?? 0,
      totalRevenue: raw.totalRevenue ?? raw.total_revenue ?? 0,
      monthlyRevenue: raw.monthlyRevenue ?? raw.monthly_revenue ?? raw.revenue_this_month ?? 0,
      totalProducts: raw.totalProducts ?? raw.total_products ?? 0,
      totalClients: raw.totalClients ?? raw.total_clients ?? 0,
      totalContainers: raw.totalContainers ?? raw.total_containers ?? 0,
      totalTaxis: raw.totalTaxis ?? raw.total_taxis ?? 0,
      totalLocations: raw.totalLocations ?? raw.total_locations ?? 0,
      totalModules: raw.totalModules ?? raw.total_modules ?? 0,
    };
  }

  fmt(value: number | undefined | null): string {
    return new Intl.NumberFormat('fr-GN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  }

  maxRevenue(): number {
    return this.revenueRows.length ? Math.max(...this.revenueRows.map(row => row.value || 0)) : 1;
  }

  maxUsage(): number {
    return this.moduleUsage.length ? Math.max(...this.moduleUsage.map(row => row.percentage || 0)) : 1;
  }

  activityTone(type: string): string {
    const map: Record<string, string> = {
      user_created: 'primary',
      subscription_activated: 'success',
      module_enabled: 'info'
    };
    return map[type] || 'secondary';
  }

  activityLabel(type: string): string {
    const map: Record<string, string> = {
      user_created: 'Utilisateur',
      subscription_activated: 'Abonnement',
      module_enabled: 'Module'
    };
    return map[type] || 'Activité';
  }

  totalActiveSubscriptions(): number {
    return this.stats?.activeSubscriptions || 0;
  }

  totalRevenue(): number {
    return this.stats?.totalRevenue || 0;
  }
}
