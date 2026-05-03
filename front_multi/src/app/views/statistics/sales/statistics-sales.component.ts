import { Component, OnDestroy, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { catchError, of } from 'rxjs';
import {
  CardModule, ButtonModule, BadgeModule, SpinnerModule, ProgressModule,
  RowComponent, ColComponent, TableModule, FormModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-statistics-sales',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IconDirective,
    CardModule, ButtonModule, BadgeModule, SpinnerModule, ProgressModule, FormModule,
    RowComponent, ColComponent, TableModule
  ],
  templateUrl: './statistics-sales.component.html'
})
export class StatisticsSalesComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);

  loading = true;
  selectedPeriod = '30days';

  periods = [
    { value: '7days',   label: '7 derniers jours' },
    { value: '30days',  label: '30 derniers jours' },
    { value: '3months', label: '3 derniers mois' },
    { value: '6months', label: '6 derniers mois' },
    { value: 'year',    label: 'Cette année' }
  ];

  stats = {
    totalPayments:   0,
    totalAmount:     0,
    totalInvoices:   0,
    totalClients:    0,
    avgPayment:      0,
    totalRemaining:  0,
    collectionRate:  0
  };

  paymentsByMethod: any[] = [];
  paymentsByType: any[] = [];
  monthlyTrend: any[] = [];
  recentPayments: any[] = [];
  invoiceSummary: any = null;

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    const { dateFrom, dateTo } = this.getSelectedRange();

    forkJoin({
      payStats:  this.apiService.get<any>(`payments/statistics?date_from=${dateFrom}&date_to=${dateTo}`).pipe(catchError(() => of({ success: false, data: null }))),
      payments:  this.apiService.get<any>(`payments?per_page=10&date_from=${dateFrom}&date_to=${dateTo}`).pipe(catchError(() => of({ success: false, data: null }))),
      clients:   this.apiService.get<any>('clients?per_page=1').pipe(catchError(() => of({ success: false, data: null })))
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (results) => {
        if (results.payStats.success && results.payStats.data) {
          const p = results.payStats.data;
          this.stats.totalPayments = p.total_count  ?? p.total   ?? 0;
          this.stats.totalAmount   = p.total_amount ?? p.sum     ?? 0;
          this.stats.totalRemaining = p.invoices_summary?.total_remaining ?? p.total_remaining ?? 0;
          this.stats.collectionRate = (this.stats.totalAmount + this.stats.totalRemaining) > 0
            ? Math.round((this.stats.totalAmount / (this.stats.totalAmount + this.stats.totalRemaining)) * 100)
            : 0;
          this.stats.avgPayment    = this.stats.totalPayments > 0
            ? Math.round(this.stats.totalAmount / this.stats.totalPayments) : 0;
          this.paymentsByMethod = p.by_method
            ? Object.entries(p.by_method).map(([key, value]) => ({ key, value }))
            : (p.methods ?? []);
          this.paymentsByType = p.by_type
            ? Object.entries(p.by_type).map(([key, value]) => ({ key, value }))
            : [];
          this.monthlyTrend = p.monthly_trend ?? [];
          this.invoiceSummary = p.invoices_summary ?? null;
        }
        if (results.payments.success && results.payments.data) {
          const rp = results.payments.data;
          this.recentPayments = rp.data ?? (Array.isArray(rp) ? rp.slice(0, 10) : []);
          if (!this.stats.totalPayments) {
            this.stats.totalPayments = rp.total ?? this.recentPayments.length;
          }
        }
        if (results.clients.success && results.clients.data) {
          this.stats.totalClients = results.clients.data.total ?? 0;
        }
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  onPeriodChange(): void {
    this.loadStats();
  }

  getSelectedRange(): { dateFrom: string; dateTo: string } {
    const end = new Date();
    const start = new Date();

    switch (this.selectedPeriod) {
      case '7days':
        start.setDate(end.getDate() - 6);
        break;
      case '30days':
        start.setDate(end.getDate() - 29);
        break;
      case '3months':
        start.setMonth(end.getMonth() - 3);
        start.setDate(start.getDate() + 1);
        break;
      case '6months':
        start.setMonth(end.getMonth() - 6);
        start.setDate(start.getDate() + 1);
        break;
      case 'year':
        start.setMonth(0, 1);
        break;
      default:
        start.setDate(end.getDate() - 29);
        break;
    }

    const toIso = (d: Date) => d.toISOString().slice(0, 10);
    return { dateFrom: toIso(start), dateTo: toIso(end) };
  }

  ngOnDestroy(): void {}

  methodLabel(value: string): string {
    const labels: Record<string, string> = {
      ESPECES: 'Espèces',
      ORANGE_MONEY: 'Orange Money',
      WAVE: 'Wave',
      MTN_MONEY: 'MTN Money',
      VIREMENT: 'Virement',
      CHEQUE: 'Chèque',
      CLIENT: 'Client',
      SUPPLIER: 'Fournisseur',
      DEPOT: 'Dépôt',
      RETRAIT: 'Retrait'
    };
    return labels[value] || value;
  }

  methodColor(index: number): string {
    const colors = ['primary', 'success', 'warning', 'info', 'danger', 'secondary'];
    return colors[index % colors.length];
  }

  trendPeak(): number {
    return Math.max(...this.monthlyTrend.map((m: any) => Number(m.total ?? m.amount ?? 0)), 1);
  }

  getTrendHeight(value: number): number {
    return Math.max(6, Math.round((Number(value) / this.trendPeak()) * 90));
  }

  collectionPercent(): number {
    return this.invoiceSummary?.total ? Math.min(100, Math.round((this.invoiceSummary.paye / this.invoiceSummary.total) * 100)) : 0;
  }

  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }

}
