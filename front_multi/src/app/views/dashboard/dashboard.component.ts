import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CardModule, SpinnerModule, AlertModule, ButtonModule } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink, CardModule, SpinnerModule, AlertModule, ButtonModule, IconDirective
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  loading = true;
  error: string | null = null;
  stats: any = null;
  activities: any[] = [];
  subscriptionTrends: any[] = [];
  revenueChart: { labels: string[], datasets: any[] } | null = null;
  revenueLabels: string[] = [];
  revenueData: number[] = [];
  moduleUsage: any[] = [];
  
  // Subscription trends data
  subscriptionLabels: string[] = [];
  subscriptionNewData: number[] = [];
  subscriptionCancelledData: number[] = [];

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loadStats();
    this.loadActivities();
    this.loadSubscriptionTrends();
    this.loadRevenueChart();
    this.loadModuleUsage();
  }

  loadStats(): void {
    this.apiService.get<any>('dashboard/stats').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.stats = r.data;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Erreur lors du chargement des statistiques';
        this.cdr.detectChanges();
      }
    });
  }

  loadActivities(): void {
    this.apiService.get<any>('dashboard/activities').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.activities = r.data;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        console.error('Erreur lors du chargement des activités');
      }
    });
  }

  loadSubscriptionTrends(): void {
    this.apiService.get<any>('dashboard/subscription-trends').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          // Handle object with labels/datasets structure
          if (r.data.labels && Array.isArray(r.data.labels)) {
            this.subscriptionLabels = r.data.labels;
          }
          if (r.data.datasets && r.data.datasets[0] && Array.isArray(r.data.datasets[0].data)) {
            this.subscriptionNewData = r.data.datasets[0].data;
          }
          if (r.data.datasets && r.data.datasets[1] && Array.isArray(r.data.datasets[1].data)) {
            this.subscriptionCancelledData = r.data.datasets[1].data;
          }
        }
        this.cdr.detectChanges();
      },
      error: () => {
        console.error('Erreur lors du chargement des tendances');
      }
    });
  }

  loadRevenueChart(): void {
    this.apiService.get<any>('dashboard/revenue-chart').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.revenueChart = r.data;
          if (r.data.labels && Array.isArray(r.data.labels)) {
            this.revenueLabels = r.data.labels;
          }
          if (r.data.datasets && r.data.datasets[0] && Array.isArray(r.data.datasets[0].data)) {
            this.revenueData = r.data.datasets[0].data;
          }
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        console.error('Erreur lors du chargement du graphique des revenus');
        this.cdr.detectChanges();
      }
    });
  }

  loadModuleUsage(): void {
    this.apiService.get<any>('dashboard/module-usage').subscribe({
      next: (r) => {
        if (r.success && r.data && Array.isArray(r.data)) {
          this.moduleUsage = r.data;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        console.error('Erreur lors du chargement de l\'usage des modules');
      }
    });
  }

  refreshData(): void {
    this.loading = true;
    this.error = null;
    this.loadDashboardData();
  }
}
