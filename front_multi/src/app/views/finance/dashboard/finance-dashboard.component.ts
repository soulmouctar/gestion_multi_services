import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { catchError, of } from 'rxjs';
import {
  CardModule, ButtonModule, BadgeModule, SpinnerModule,
  RowComponent, ColComponent, ContainerComponent, TableModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-finance-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterModule, IconDirective,
    CardModule, ButtonModule, BadgeModule, SpinnerModule,
    RowComponent, ColComponent, ContainerComponent, TableModule
  ],
  templateUrl: './finance-dashboard.component.html'
})
export class FinanceDashboardComponent implements OnInit, OnDestroy {
  loading = true;

  stats = {
    totalPayments:   0,
    totalAmount:     0,
    monthlyAmount:   0,
    pendingInvoices: 0,
    totalInvoices:   0,
    totalCurrencies: 0
  };

  recentPayments: any[] = [];
  recentInvoices: any[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;

    forkJoin({
      paymentStats: this.apiService.get<any>('payments/statistics').pipe(catchError(() => of({ success: false, data: null }))),
      recentPay:    this.apiService.get<any>('payments?per_page=5').pipe(catchError(() => of({ success: false, data: null }))),
      invoices:     this.apiService.get<any>('invoices?per_page=5').pipe(catchError(() => of({ success: false, data: null }))),
      currencies:   this.apiService.get<any>('currencies?per_page=100').pipe(catchError(() => of({ success: false, data: null })))
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (results) => {
        if (results.paymentStats.success && results.paymentStats.data) {
          const p = results.paymentStats.data;
          this.stats.totalPayments = p.total_count  ?? p.total         ?? 0;
          this.stats.totalAmount   = p.total_amount ?? p.total_sum     ?? 0;
          this.stats.monthlyAmount = p.monthly_total ?? p.this_month   ?? 0;
        }
        if (results.recentPay.success && results.recentPay.data) {
          const rp = results.recentPay.data;
          this.recentPayments = rp.data ?? (Array.isArray(rp) ? rp.slice(0, 5) : []);
        }
        if (results.invoices.success && results.invoices.data) {
          const inv = results.invoices.data;
          this.stats.totalInvoices   = inv.total ?? (Array.isArray(inv) ? inv.length : 0);
          this.recentInvoices = inv.data ?? (Array.isArray(inv) ? inv.slice(0, 5) : []);
        }
        if (results.currencies.success && results.currencies.data) {
          const cur = results.currencies.data;
          this.stats.totalCurrencies = cur.total ?? (Array.isArray(cur) ? cur.length : (cur.data?.length ?? 0));
        }
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}