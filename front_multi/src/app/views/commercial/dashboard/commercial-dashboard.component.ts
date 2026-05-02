import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  CardModule, ButtonModule, BadgeModule, SpinnerModule,
  TableModule, ProgressModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-commercial-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterModule, IconDirective,
    CardModule, ButtonModule, BadgeModule, SpinnerModule,
    TableModule, ProgressModule
  ],
  templateUrl: './commercial-dashboard.component.html'
})
export class CommercialDashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr       = inject(ChangeDetectorRef);

  loading = true;

  salesStats: any = {
    total_sales: 0, total_paid: 0, total_remaining: 0,
    sales_this_month: 0, revenue_this_month: 0,
  };

  arrivals:      any[] = [];
  arrivalsTotal  = 0;
  recentSales:   any[] = [];
  pendingSales:  any[] = [];
  clientAdvances: any[] = [];

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;

    this.apiService.get<any>('commercial/dashboard')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const d = response.data;
            this.salesStats    = d.global_stats    ?? this.salesStats;
            this.arrivals      = d.arrivals         ?? [];
            this.arrivalsTotal = d.arrivals_total   ?? 0;
            this.recentSales   = d.recent_sales     ?? [];
            this.pendingSales  = d.pending_sales    ?? [];
            this.clientAdvances = d.client_advances ?? [];
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        }
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

  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }
}
