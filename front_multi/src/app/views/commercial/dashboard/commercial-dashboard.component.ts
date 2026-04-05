import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, forkJoin, takeUntil, catchError, of } from 'rxjs';
import {
  CardModule, ButtonModule, BadgeModule, SpinnerModule,
  RowComponent, ColComponent, ContainerComponent, TableModule, ProgressModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-commercial-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterModule, IconDirective,
    CardModule, ButtonModule, BadgeModule, SpinnerModule,
    RowComponent, ColComponent, ContainerComponent, TableModule, ProgressModule
  ],
  templateUrl: './commercial-dashboard.component.html'
})
export class CommercialDashboardComponent implements OnInit, OnDestroy {
  loading = true;

  // KPIs conteneurs
  containerStats: any = {
    total: 0, available: 0, in_transit: 0, customs: 0, at_port: 0
  };

  // Arrivages (stocks)
  arrivals: any[] = [];
  arrivalsTotal = 0;

  // Ventes globales
  salesStats: any = {
    total_sales: 0,
    total_revenue: 0,
    total_paid: 0,
    total_remaining: 0,
    sales_this_month: 0,
    revenue_this_month: 0
  };

  // Ventes récentes
  recentSales: any[] = [];

  // Paiements en attente (ventes partiellement payées)
  pendingSales: any[] = [];

  // Avances clients
  clientAdvances: any[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;

    forkJoin({
      containerStats: this.apiService.get<any>('containers/statistics/general').pipe(catchError(() => of({ success: false, data: null }))),
      arrivals:       this.apiService.get<any>('container-arrivals?per_page=20').pipe(catchError(() => of({ success: false, data: [] }))),
      salesStats:     this.apiService.get<any>('container-sales/global-stats').pipe(catchError(() => of({ success: false, data: null }))),
      recentSales:    this.apiService.get<any>('container-sales?per_page=8&sort=created_at').pipe(catchError(() => of({ success: false, data: null }))),
      pendingSales:   this.apiService.get<any>('container-sales?per_page=10&status=EN_COURS').pipe(catchError(() => of({ success: false, data: null }))),
      advances:       this.apiService.get<any>('client-advances?per_page=5').pipe(catchError(() => of({ success: false, data: null })))
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r) => {
        if (r.containerStats.success && r.containerStats.data) {
          this.containerStats = { ...this.containerStats, ...r.containerStats.data };
        }
        if (r.arrivals.success) {
          const raw = r.arrivals.data;
          this.arrivals = Array.isArray(raw) ? raw : (raw?.data ?? []);
          this.arrivalsTotal = Array.isArray(raw) ? raw.length : (raw?.total ?? 0);
        }
        if (r.salesStats.success && r.salesStats.data) {
          this.salesStats = { ...this.salesStats, ...r.salesStats.data };
        }
        if (r.recentSales.success && r.recentSales.data) {
          const raw = r.recentSales.data;
          this.recentSales = Array.isArray(raw) ? raw.slice(0, 8) : (raw?.data ?? []).slice(0, 8);
        }
        if (r.pendingSales.success && r.pendingSales.data) {
          const raw = r.pendingSales.data;
          this.pendingSales = Array.isArray(raw) ? raw.slice(0, 10) : (raw?.data ?? []).slice(0, 10);
        }
        if (r.advances.success && r.advances.data) {
          const raw = r.advances.data;
          this.clientAdvances = Array.isArray(raw) ? raw.slice(0, 5) : (raw?.data ?? []).slice(0, 5);
        }
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  getPaymentProgress(sale: any): number {
    if (!sale.sale_price || sale.sale_price <= 0) return 0;
    return Math.min(100, Math.round(((sale.amount_paid ?? 0) / sale.sale_price) * 100));
  }

  getProgressColor(pct: number): string {
    if (pct >= 100) return 'success';
    if (pct >= 50)  return 'info';
    if (pct > 0)    return 'warning';
    return 'danger';
  }

  getSaleStatusColor(status: string): string {
    const m: Record<string, string> = {
      PAYE_TOTAL: 'success', PAYE_PARTIEL: 'warning',
      EN_COURS: 'info', ANNULE: 'danger'
    };
    return m[status] || 'secondary';
  }

  getSaleStatusLabel(status: string): string {
    const m: Record<string, string> = {
      PAYE_TOTAL: 'Soldé', PAYE_PARTIEL: 'Partiel',
      EN_COURS: 'En cours', ANNULE: 'Annulé'
    };
    return m[status] || status;
  }

  formatAmount(v: number, currency = 'GNF'): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0 }).format(v || 0) + ' ' + currency;
  }

  getAvailableStock(): any[] {
    return this.arrivals.filter(a => (a.remaining_quantity ?? 0) > 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
