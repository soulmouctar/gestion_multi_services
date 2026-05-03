import { Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { catchError, of } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-statistics-finance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './statistics-finance.component.html'
})
export class StatisticsFinanceComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);

  loading = true;

  stats = {
    totalRevenue:       0,
    totalPayments:      0,
    totalInvoices:      0,
    totalCurrencies:    0,
    totalExchangeRates: 0,
    incomeTotal:        0,
    outgoingTotal:      0,
    netCashflow:        0,
    supplierCount:      0
  };

  financeData: any = null;
  currencies: any[] = [];
  exchangeRates: any[] = [];

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;

    forkJoin({
      finance:       this.apiService.get<any>('finance/dashboard').pipe(catchError(() => of({ success: false, data: null }))),
      currencies:    this.apiService.get<any>('currencies?per_page=100').pipe(catchError(() => of({ success: false, data: null }))),
      exchangeRates: this.apiService.get<any>('exchange-rates?per_page=10').pipe(catchError(() => of({ success: false, data: null })))
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (results) => {
        if (results.finance.success && results.finance.data) {
          this.financeData = results.finance.data;
          this.stats.totalRevenue  = results.finance.data.payments?.total_amount ?? 0;
          this.stats.totalPayments = results.finance.data.payments?.total_payments ?? 0;
          this.stats.totalInvoices = results.finance.data.invoices?.total ?? 0;
          this.stats.incomeTotal   = results.finance.data.cashflow?.income_total ?? 0;
          this.stats.outgoingTotal = results.finance.data.cashflow?.outgoing_total ?? 0;
          this.stats.netCashflow   = results.finance.data.cashflow?.net_cashflow ?? 0;
          this.stats.totalCurrencies = results.finance.data.currencies_count ?? 0;
          this.stats.supplierCount = results.finance.data.supplier_relations?.length ?? 0;
        }
        if (results.currencies.success && results.currencies.data) {
          const cur = results.currencies.data;
          this.currencies = cur.data ?? (Array.isArray(cur) ? cur : []);
          this.stats.totalCurrencies = cur.total ?? this.stats.totalCurrencies ?? this.currencies.length;
        }
        if (results.exchangeRates.success && results.exchangeRates.data) {
          const er = results.exchangeRates.data;
          this.exchangeRates = er.data ?? (Array.isArray(er) ? er.slice(0, 10) : []);
          this.stats.totalExchangeRates = er.total ?? this.exchangeRates.length;
        }
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  ngOnDestroy(): void {
  }

  fmt(value: number | null | undefined): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0 }).format(Number(value || 0)) + ' GNF';
  }

  percent(part: number, total: number): number {
    return total > 0 ? Math.min(100, Math.round((part / total) * 100)) : 0;
  }

  statusClass(status?: string): string {
    if (!status) return 'bg-secondary';
    const map: Record<string, string> = {
      PAID: 'bg-success',
      COMPLETED: 'bg-success',
      ACTIVE: 'bg-success',
      PENDING: 'bg-warning',
      PARTIEL: 'bg-warning',
      PARTIAL: 'bg-warning',
      IMPAYE: 'bg-danger',
      UNPAID: 'bg-danger',
      CANCELLED: 'bg-secondary'
    };
    return map[status] || 'bg-secondary';
  }

  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }
}
