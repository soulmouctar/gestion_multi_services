import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  ButtonModule, CardModule, BadgeModule, ProgressModule, SpinnerModule
} from '@coreui/angular';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { IconDirective } from '@coreui/icons-angular';
import { ChartData, ChartOptions } from 'chart.js';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-banking-statistics',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, IconDirective,
    ButtonModule, CardModule, BadgeModule, ProgressModule, SpinnerModule, ChartjsComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './banking-statistics.component.html'
})
export class BankingStatisticsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);


  loading     = true;
  stats: any  = null;
  accounts: any[] = [];
  period      = 'month';

  filters = {
    date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    date_to:   new Date().toISOString().split('T')[0],
    account_id: ''
  };

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  readonly chartOptions: ChartOptions<'line' | 'bar' | 'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
      }
    },
    scales: {
      x: {
        ticks: { color: '#64748b' },
        grid: { display: false }
      },
      y: {
        ticks: { color: '#64748b' },
        grid: { color: '#eef2f7' }
      }
    }
  };

  ngOnInit(): void {
    this.loadAccounts();
    this.loadStats();
  }

  loadAccounts(): void {
    this.apiService.get<any>('banking/accounts').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { this.accounts = r.success ? (r.data || []) : []; }
    });
  }

  setPeriod(p: string): void {
    this.period = p;
    const now = new Date();
    switch (p) {
      case 'week':
        const dow  = now.getDay() || 7;
        const mon  = new Date(now); mon.setDate(now.getDate() - dow + 1);
        this.filters.date_from = mon.toISOString().split('T')[0];
        break;
      case 'month':
        this.filters.date_from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        break;
      case '3months':
        const t3 = new Date(now); t3.setMonth(now.getMonth() - 2); t3.setDate(1);
        this.filters.date_from = t3.toISOString().split('T')[0];
        break;
      case 'year':
        this.filters.date_from = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        break;
    }
    this.filters.date_to = now.toISOString().split('T')[0];
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    const params: any = { ...this.filters };
    if (!params.account_id) delete params.account_id;
    this.apiService.get<any>('banking/statistics', { params }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.stats   = r.success ? r.data : null;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  txTypeLabel(type: string): string {
    const map: Record<string, string> = {
      'DEPOT': 'Dépôts', 'RETRAIT': 'Retraits',
      'REMISE_CHEQUE': 'Remises chèque', 'VIREMENT_ENTRANT': 'Virements entrants', 'VIREMENT_SORTANT': 'Virements sortants'
    };
    return map[type] || type;
  }

  txTypeColor(type: string): string {
    const map: Record<string, string> = {
      'DEPOT': 'success', 'RETRAIT': 'danger',
      'REMISE_CHEQUE': 'info', 'VIREMENT_ENTRANT': 'primary', 'VIREMENT_SORTANT': 'warning'
    };
    return map[type] || 'secondary';
  }

  isCredit(type: string): boolean {
    return ['DEPOT', 'REMISE_CHEQUE', 'VIREMENT_ENTRANT'].includes(type);
  }

  maxByType(): number {
    if (!this.stats?.by_type?.length) return 1;
    return Math.max(...this.stats.by_type.map((t: any) => t.total));
  }

  fmt(v: number, currency = 'GNF'): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0 }).format(v || 0) + ' ' + currency;
  }

  netFlow(): number {
    return (this.stats?.summary?.total_credits || 0) - (this.stats?.summary?.total_debits || 0);
  }

  get monthlyFlowChartData(): ChartData<'line'> {
    const rows = this.stats?.by_month || [];
    return {
      labels: rows.map((m: any) => m.month),
      datasets: [
        {
          label: 'Crédits',
          data: rows.map((m: any) => Number(m.credits || 0)),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16,185,129,0.15)',
          tension: 0.35,
          fill: true,
        },
        {
          label: 'Débits',
          data: rows.map((m: any) => Number(m.debits || 0)),
          borderColor: '#EF4444',
          backgroundColor: 'rgba(239,68,68,0.12)',
          tension: 0.35,
          fill: true,
        }
      ]
    };
  }

  get accountBalanceChartData(): ChartData<'bar'> {
    const rows = this.stats?.accounts || [];
    return {
      labels: rows.map((a: any) => `${a.bank_name} - ${a.account_name}`),
      datasets: [{
        label: 'Solde actuel',
        data: rows.map((a: any) => Number(a.current_balance || 0)),
        backgroundColor: rows.map((a: any) => a.brand_color || '#0f3460'),
        borderRadius: 10,
        maxBarThickness: 42,
      }]
    };
  }

  get transactionTypeChartData(): ChartData<'doughnut'> {
    const rows = this.stats?.by_type || [];
    return {
      labels: rows.map((t: any) => this.txTypeLabel(t.transaction_type)),
      datasets: [{
        data: rows.map((t: any) => Number(t.total || 0)),
        backgroundColor: ['#10B981', '#EF4444', '#3B82F6', '#8B5CF6', '#F59E0B'],
        borderWidth: 0,
      }]
    };
  }
  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }

}
