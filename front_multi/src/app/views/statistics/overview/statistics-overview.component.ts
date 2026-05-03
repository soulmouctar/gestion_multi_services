import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, catchError, of } from 'rxjs';
import {
  CardModule, ButtonModule, BadgeModule, ProgressModule, SpinnerModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-statistics-overview',
  standalone: true,
  imports: [
    CommonModule, RouterModule, IconDirective,
    CardModule, ButtonModule, BadgeModule, ProgressModule, SpinnerModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './statistics-overview.component.html'
})
export class StatisticsOverviewComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  loading = true;

  // Real data
  paymentStats: any   = null;
  productStats: any   = null;
  clientStats: any    = null;
  containerStats: any = null;
  leaseStats: any     = null;
  taxiStats: any      = null;
  expenseStats: any   = null;

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading = true;
    forkJoin({
      finance:    this.apiService.get<any>('finance/dashboard').pipe(catchError(() => of({ success: false }))),
      products:   this.apiService.get<any>('products/statistics').pipe(catchError(() => of({ success: false }))),
      clients:    this.apiService.get<any>('clients?per_page=1').pipe(catchError(() => of({ success: false }))),
      containers: this.apiService.get<any>('containers/statistics/general').pipe(catchError(() => of({ success: false }))),
      rental:     this.apiService.get<any>('rental/dashboard').pipe(catchError(() => of({ success: false }))),
      taxi:       this.apiService.get<any>('taxi/dashboard').pipe(catchError(() => of({ success: false }))),
      expenses:   this.apiService.get<any>('personal-expenses/statistics').pipe(catchError(() => of({ success: false }))),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r: any) => {
        if (r.finance.success) {
          const finance = r.finance.data || {};
          this.paymentStats = {
            total_amount: finance.payments?.total_amount ?? 0,
            monthly_amount: finance.payments?.monthly_amount ?? 0,
            total_count: finance.payments?.total_payments ?? 0
          };
          this.leaseStats = {
            active_leases: r.rental.data?.leases?.active ?? 0,
            pending_leases: r.rental.data?.leases?.pending ?? 0,
            monthly_rent_total: r.rental.data?.revenue?.expected_monthly ?? 0,
            collected_this_month: r.rental.data?.revenue?.collected_month ?? 0,
            expected_this_month: r.rental.data?.revenue?.expected_monthly ?? 0
          };
          this.taxiStats = r.taxi.data;
        }
        if (r.products.success)   this.productStats   = r.products.data;
        if (r.clients.success)    this.clientStats    = r.clients.data;
        if (r.containers.success) this.containerStats = r.containers.data;
        if (r.rental.success && !this.leaseStats) {
          this.leaseStats = {
            active_leases: r.rental.data?.leases?.active ?? 0,
            pending_leases: r.rental.data?.leases?.pending ?? 0,
            monthly_rent_total: r.rental.data?.revenue?.expected_monthly ?? 0,
            collected_this_month: r.rental.data?.revenue?.collected_month ?? 0,
            expected_this_month: r.rental.data?.revenue?.expected_monthly ?? 0
          };
        }
        if (r.taxi.success)       this.taxiStats      = r.taxi.data;
        if (r.expenses.success)   this.expenseStats   = r.expenses.data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; }
    });
  }

  fmt(v: number, currency = 'GNF'): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0 }).format(v || 0) + ' ' + currency;
  }

  getTaxiCollectionRate(): number {
    const s = this.taxiStats?.summary;
    if (!s?.total_expected || s.total_expected <= 0) return 0;
    return Math.min(100, Math.round((s.total_paid / s.total_expected) * 100));
  }

  getLeaseCollectionRate(): number {
    if (!this.leaseStats?.expected_this_month || this.leaseStats.expected_this_month <= 0) return 0;
    return Math.min(100, Math.round((this.leaseStats.collected_this_month / this.leaseStats.expected_this_month) * 100));
  }
  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }

}
