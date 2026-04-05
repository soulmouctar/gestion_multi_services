import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
  templateUrl: './statistics-overview.component.html'
})
export class StatisticsOverviewComponent implements OnInit {
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
      payments:   this.apiService.get<any>('payments/statistics').pipe(catchError(() => of({ success: false }))),
      products:   this.apiService.get<any>('products/statistics').pipe(catchError(() => of({ success: false }))),
      clients:    this.apiService.get<any>('clients?per_page=1').pipe(catchError(() => of({ success: false }))),
      containers: this.apiService.get<any>('containers/statistics/general').pipe(catchError(() => of({ success: false }))),
      leases:     this.apiService.get<any>('leases/statistics').pipe(catchError(() => of({ success: false }))),
      taxi:       this.apiService.get<any>('daily-payments/statistics').pipe(catchError(() => of({ success: false }))),
      expenses:   this.apiService.get<any>('personal-expenses/statistics').pipe(catchError(() => of({ success: false }))),
    }).subscribe({
      next: (r: any) => {
        if (r.payments.success)   this.paymentStats   = r.payments.data;
        if (r.products.success)   this.productStats   = r.products.data;
        if (r.clients.success)    this.clientStats    = r.clients.data;
        if (r.containers.success) this.containerStats = r.containers.data;
        if (r.leases.success)     this.leaseStats     = r.leases.data;
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
}
