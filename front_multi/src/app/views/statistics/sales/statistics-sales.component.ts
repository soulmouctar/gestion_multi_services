import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { catchError, of } from 'rxjs';
import {
  CardModule, ButtonModule, BadgeModule, SpinnerModule,
  RowComponent, ColComponent, ContainerComponent, TableModule, FormModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-statistics-sales',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IconDirective,
    CardModule, ButtonModule, BadgeModule, SpinnerModule, FormModule,
    RowComponent, ColComponent, ContainerComponent, TableModule
  ],
  templateUrl: './statistics-sales.component.html'
})
export class StatisticsSalesComponent implements OnInit, OnDestroy {
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
    avgPayment:      0
  };

  paymentsByMethod: any[] = [];
  recentPayments: any[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;

    forkJoin({
      payStats:  this.apiService.get<any>(`payments/statistics?period=${this.selectedPeriod}`).pipe(catchError(() => of({ success: false, data: null }))),
      payments:  this.apiService.get<any>(`payments?per_page=10`).pipe(catchError(() => of({ success: false, data: null }))),
      clients:   this.apiService.get<any>('clients?per_page=1').pipe(catchError(() => of({ success: false, data: null })))
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (results) => {
        if (results.payStats.success && results.payStats.data) {
          const p = results.payStats.data;
          this.stats.totalPayments = p.total_count  ?? p.total   ?? 0;
          this.stats.totalAmount   = p.total_amount ?? p.sum     ?? 0;
          this.stats.avgPayment    = this.stats.totalPayments > 0
            ? Math.round(this.stats.totalAmount / this.stats.totalPayments) : 0;
          this.paymentsByMethod = p.by_method ?? p.methods ?? [];
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}