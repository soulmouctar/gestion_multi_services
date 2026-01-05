import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DashboardStats {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  activeUsers: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  expiringSoonSubscriptions: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalProducts: number;
  totalClients: number;
  totalContainers: number;
  totalTaxis: number;
  totalLocations: number;
}

export interface RecentActivity {
  id: number;
  type: 'subscription' | 'user' | 'tenant' | 'product' | 'client' | 'container' | 'taxi' | 'location';
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  color: string;
}

export interface SubscriptionTrend {
  month: string;
  active: number;
  expired: number;
  new: number;
}

export interface RevenueChart {
  month: string;
  revenue: number;
  subscriptions: number;
}

export interface ModuleUsage {
  module: string;
  name: string;
  activeUsers: number;
  totalUsers: number;
  usagePercentage: number;
  icon: string;
  color: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getDashboardStats(): Observable<ApiResponse<DashboardStats>> {
    return this.http.get<ApiResponse<DashboardStats>>(`${this.API_URL}/dashboard/stats`);
  }

  getRecentActivities(limit: number = 10): Observable<ApiResponse<RecentActivity[]>> {
    return this.http.get<ApiResponse<RecentActivity[]>>(`${this.API_URL}/dashboard/activities?limit=${limit}`);
  }

  getSubscriptionTrends(): Observable<ApiResponse<SubscriptionTrend[]>> {
    return this.http.get<ApiResponse<SubscriptionTrend[]>>(`${this.API_URL}/dashboard/subscription-trends`);
  }

  getRevenueChart(period: string = '12months'): Observable<ApiResponse<RevenueChart[]>> {
    return this.http.get<ApiResponse<RevenueChart[]>>(`${this.API_URL}/dashboard/revenue-chart?period=${period}`);
  }

  getModuleUsage(): Observable<ApiResponse<ModuleUsage[]>> {
    return this.http.get<ApiResponse<ModuleUsage[]>>(`${this.API_URL}/dashboard/module-usage`);
  }

  // Méthodes utilitaires pour les calculs côté client si nécessaire
  calculateExpiringSoon(subscriptions: any[]): number {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    
    return subscriptions.filter(sub => {
      if (sub.status !== 'ACTIVE') return false;
      const endDate = new Date(sub.end_date);
      return endDate > today && endDate <= thirtyDaysFromNow;
    }).length;
  }

  calculateMonthlyRevenue(subscriptions: any[]): number {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return subscriptions
      .filter(sub => sub.status === 'ACTIVE')
      .reduce((total, sub) => {
        const monthlyAmount = sub.plan.price / sub.plan.duration_months;
        return total + monthlyAmount;
      }, 0);
  }

  getSubscriptionStatusDistribution(subscriptions: any[]): { [key: string]: number } {
    return subscriptions.reduce((acc, sub) => {
      acc[sub.status] = (acc[sub.status] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
  }

  getTopModules(modules: any[]): ModuleUsage[] {
    return modules
      .sort((a, b) => b.usagePercentage - a.usagePercentage)
      .slice(0, 5);
  }
}
