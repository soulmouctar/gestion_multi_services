import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { catchError, of } from 'rxjs';
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

  stats = {
    totalProducts: 0,
    lowStockProducts: 0,
    totalClients: 0,
    totalSuppliers: 0,
    totalInvoices: 0,
    totalPayments: 0,
    revenueMonth: 0
  };

  recentClients: any[] = [];
  lowStockItems: any[] = [];
  recentPayments: any[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;

    forkJoin({
      productStats: this.apiService.get<any>('products/statistics').pipe(catchError(() => of({ success: false, data: null }))),
      lowStock:     this.apiService.get<any>('products/low-stock').pipe(catchError(() => of({ success: false, data: [] }))),
      clients:      this.apiService.get<any>('clients?per_page=5').pipe(catchError(() => of({ success: false, data: null }))),
      suppliers:    this.apiService.get<any>('suppliers?per_page=1').pipe(catchError(() => of({ success: false, data: null }))),
      payments:     this.apiService.get<any>('payments/statistics').pipe(catchError(() => of({ success: false, data: null }))),
      recentPay:    this.apiService.get<any>('payments?per_page=5').pipe(catchError(() => of({ success: false, data: null })))
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (results) => {
        if (results.productStats.success && results.productStats.data) {
          const ps = results.productStats.data;
          this.stats.totalProducts   = ps.total_products  ?? ps.total ?? 0;
          this.stats.lowStockProducts = ps.low_stock_count ?? 0;
        }
        if (results.lowStock.success) {
          const raw = results.lowStock.data;
          this.lowStockItems = Array.isArray(raw) ? raw.slice(0, 5) : (raw?.data ?? []).slice(0, 5);
        }
        if (results.clients.success && results.clients.data) {
          const c = results.clients.data;
          this.stats.totalClients = c.total ?? (Array.isArray(c) ? c.length : 0);
          this.recentClients = c.data ?? (Array.isArray(c) ? c.slice(0, 5) : []);
        }
        if (results.suppliers.success && results.suppliers.data) {
          const s = results.suppliers.data;
          this.stats.totalSuppliers = s.total ?? (Array.isArray(s) ? s.length : 0);
        }
        if (results.payments.success && results.payments.data) {
          const p = results.payments.data;
          this.stats.totalPayments = p.total_count ?? p.total ?? 0;
          this.stats.revenueMonth  = p.monthly_total ?? p.total_amount ?? 0;
        }
        if (results.recentPay.success && results.recentPay.data) {
          const rp = results.recentPay.data;
          this.recentPayments = rp.data ?? (Array.isArray(rp) ? rp.slice(0, 5) : []);
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
