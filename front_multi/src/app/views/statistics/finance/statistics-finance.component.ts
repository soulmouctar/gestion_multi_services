import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { catchError, of } from 'rxjs';
import {
  CardModule, BadgeModule, SpinnerModule,
  RowComponent, ColComponent, ContainerComponent, TableModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-statistics-finance',
  standalone: true,
  imports: [
    CommonModule, IconDirective,
    CardModule, BadgeModule, SpinnerModule,
    RowComponent, ColComponent, ContainerComponent, TableModule
  ],
  templateUrl: './statistics-finance.component.html'
})
export class StatisticsFinanceComponent implements OnInit, OnDestroy {
  loading = true;

  stats = {
    totalRevenue:       0,
    totalPayments:      0,
    totalInvoices:      0,
    totalCurrencies:    0,
    totalExchangeRates: 0
  };

  currencies: any[] = [];
  exchangeRates: any[] = [];
  recentPayments: any[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;

    forkJoin({
      payStats:      this.apiService.get<any>('payments/statistics').pipe(catchError(() => of({ success: false, data: null }))),
      currencies:    this.apiService.get<any>('currencies?per_page=100').pipe(catchError(() => of({ success: false, data: null }))),
      exchangeRates: this.apiService.get<any>('exchange-rates?per_page=10').pipe(catchError(() => of({ success: false, data: null }))),
      invoices:      this.apiService.get<any>('invoices?per_page=1').pipe(catchError(() => of({ success: false, data: null }))),
      recentPay:     this.apiService.get<any>('payments?per_page=5').pipe(catchError(() => of({ success: false, data: null })))
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (results) => {
        if (results.payStats.success && results.payStats.data) {
          const p = results.payStats.data;
          this.stats.totalRevenue  = p.total_amount ?? p.sum   ?? 0;
          this.stats.totalPayments = p.total_count  ?? p.total ?? 0;
        }
        if (results.currencies.success && results.currencies.data) {
          const cur = results.currencies.data;
          this.currencies = cur.data ?? (Array.isArray(cur) ? cur : []);
          this.stats.totalCurrencies = cur.total ?? this.currencies.length;
        }
        if (results.exchangeRates.success && results.exchangeRates.data) {
          const er = results.exchangeRates.data;
          this.exchangeRates = er.data ?? (Array.isArray(er) ? er.slice(0, 10) : []);
          this.stats.totalExchangeRates = er.total ?? this.exchangeRates.length;
        }
        if (results.invoices.success && results.invoices.data) {
          this.stats.totalInvoices = results.invoices.data.total ?? 0;
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