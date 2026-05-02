import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

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
    this.apiService.get<any>('dashboard/stats').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    this.apiService.get<any>('dashboard/activities').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.activities = r.data;
        }
        this.cdr.detectChanges();
      },
      error: () => { }
    });
  }

  loadSubscriptionTrends(): void {
    this.apiService.get<any>('dashboard/subscription-trends').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
      error: () => { }
    });
  }

  loadRevenueChart(): void {
    this.apiService.get<any>('dashboard/revenue-chart').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
        this.cdr.detectChanges();
      }
    });
  }

  loadModuleUsage(): void {
    this.apiService.get<any>('dashboard/module-usage').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data && Array.isArray(r.data)) {
          this.moduleUsage = r.data;
        }
        this.cdr.detectChanges();
      },
      error: () => { }
    });
  }

  refreshData(): void {
    this.loading = true;
    this.error = null;
    this.loadDashboardData();
  }
  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }

}
