import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  ButtonModule, CardModule, BadgeModule, ProgressModule, SpinnerModule, TooltipModule
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
    ButtonModule, CardModule, BadgeModule, ProgressModule, SpinnerModule, TooltipModule, ChartjsComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './banking-statistics.component.html'
})
export class BankingStatisticsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  loading      = true;
  stats: any   = null;
  accounts: any[] = [];
  period       = 'month';

  private readonly palette = ['#10B981', '#EF4444', '#3B82F6', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899', '#84CC16'];

  filters = {
    date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    date_to:   new Date().toISOString().split('T')[0],
    account_id: ''
  };

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  readonly lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true, pointStyle: 'circle' } },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${new Intl.NumberFormat('fr-FR').format(ctx.parsed.y as number)}`
        }
      }
    },
    scales: {
      x: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { display: false } },
      y: { ticks: { color: '#64748b', font: { size: 11 }, callback: (v) => this.shortNumber(Number(v)) }, grid: { color: '#eef2f7' } }
    }
  };

  readonly barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${new Intl.NumberFormat('fr-FR').format(ctx.parsed.y as number)}`
        }
      }
    },
    scales: {
      x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { display: false } },
      y: { ticks: { color: '#64748b', font: { size: 11 }, callback: (v) => this.shortNumber(Number(v)) }, grid: { color: '#eef2f7' } }
    }
  };

  readonly doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { display: true, position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${new Intl.NumberFormat('fr-FR').format(ctx.parsed as number)}`
        }
      }
    }
  };

  ngOnInit(): void {
    this.loadAccounts();
    this.loadStats();
  }

  loadAccounts(): void {
    this.apiService.get<any>('banking/accounts').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { this.accounts = r.success ? (r.data || []) : []; this.cdr.detectChanges(); }
    });
  }

  setPeriod(p: string): void {
    this.period = p;
    const now = new Date();
    switch (p) {
      case 'week':
        const dow = now.getDay() || 7;
        const mon = new Date(now); mon.setDate(now.getDate() - dow + 1);
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

  txTypeIcon(type: string): string {
    const map: Record<string, string> = {
      'DEPOT': 'cilArrowBottom',
      'RETRAIT': 'cilArrowTop',
      'REMISE_CHEQUE': 'cilNotes',
      'VIREMENT_ENTRANT': 'cilArrowCircleBottom',
      'VIREMENT_SORTANT': 'cilArrowCircleTop'
    };
    return map[type] || 'cilCircle';
  }

  isCredit(type: string): boolean {
    return ['DEPOT', 'REMISE_CHEQUE', 'VIREMENT_ENTRANT'].includes(type);
  }

  maxByType(): number {
    if (!this.stats?.by_type?.length) return 1;
    return Math.max(...this.stats.by_type.map((t: any) => Number(t.total) || 0));
  }

  maxAccountBalance(): number {
    if (!this.stats?.accounts?.length) return 1;
    return Math.max(...this.stats.accounts.map((a: any) => Math.abs(Number(a.current_balance) || 0)));
  }

  fmt(v: number, currency = 'GNF'): string {
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(Number(v) || 0) + ' ' + currency;
  }

  shortNumber(v: number): string {
    const abs = Math.abs(v);
    if (abs >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + ' Mrd';
    if (abs >= 1_000_000)     return (v / 1_000_000).toFixed(1) + ' M';
    if (abs >= 1_000)         return (v / 1_000).toFixed(1) + ' k';
    return String(v);
  }

  netFlow(): number {
    return (Number(this.stats?.summary?.total_credits) || 0) - (Number(this.stats?.summary?.total_debits) || 0);
  }

  savingsRate(): number {
    const credits = Number(this.stats?.summary?.total_credits) || 0;
    if (credits <= 0) return 0;
    return Math.round((this.netFlow() / credits) * 100);
  }

  avgDailyVolume(): number {
    const tx = Number(this.stats?.summary?.total_transactions) || 0;
    if (!tx) return 0;
    const from = new Date(this.filters.date_from).getTime();
    const to   = new Date(this.filters.date_to).getTime();
    const days = Math.max(1, Math.round((to - from) / 86400000) + 1);
    const total = (Number(this.stats?.summary?.total_credits) || 0) + (Number(this.stats?.summary?.total_debits) || 0);
    return total / days;
  }

  bestMonth(): any {
    const rows = this.stats?.by_month || [];
    if (!rows.length) return null;
    return rows.slice().sort((a: any, b: any) =>
      (Number(b.credits) - Number(b.debits)) - (Number(a.credits) - Number(a.debits))
    )[0];
  }

  topType(): any {
    const rows = this.stats?.by_type || [];
    if (!rows.length) return null;
    return rows.slice().sort((a: any, b: any) => Number(b.total) - Number(a.total))[0];
  }

  monthLabel(month: string): string {
    if (!month) return '';
    const [y, m] = month.split('-');
    const names = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
    return `${names[Number(m) - 1] || month} ${y.substr(2)}`;
  }

  get monthlyFlowChartData(): ChartData<'line'> {
    const rows = this.stats?.by_month || [];
    return {
      labels: rows.map((m: any) => this.monthLabel(m.month)),
      datasets: [
        {
          label: 'Crédits',
          data: rows.map((m: any) => Number(m.credits || 0)),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16,185,129,0.18)',
          tension: 0.4,
          fill: true,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#10B981',
        },
        {
          label: 'Débits',
          data: rows.map((m: any) => Number(m.debits || 0)),
          borderColor: '#EF4444',
          backgroundColor: 'rgba(239,68,68,0.15)',
          tension: 0.4,
          fill: true,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#EF4444',
        }
      ]
    };
  }

  get accountBalanceChartData(): ChartData<'bar'> {
    const rows = (this.stats?.accounts || []).filter((a: any) => a.is_active);
    return {
      labels: rows.map((a: any) => a.bank_name),
      datasets: [{
        label: 'Solde',
        data: rows.map((a: any) => Number(a.current_balance || 0)),
        backgroundColor: rows.map((a: any, i: number) => a.brand_color || this.palette[i % this.palette.length]),
        borderRadius: 8,
        maxBarThickness: 36,
      }]
    };
  }

  get transactionTypeChartData(): ChartData<'doughnut'> {
    const rows = this.stats?.by_type || [];
    return {
      labels: rows.map((t: any) => this.txTypeLabel(t.transaction_type)),
      datasets: [{
        data: rows.map((t: any) => Number(t.total || 0)),
        backgroundColor: rows.map((t: any) => {
          const colorMap: Record<string, string> = {
            'DEPOT': '#10B981', 'RETRAIT': '#EF4444',
            'REMISE_CHEQUE': '#06B6D4', 'VIREMENT_ENTRANT': '#3B82F6', 'VIREMENT_SORTANT': '#F59E0B'
          };
          return colorMap[t.transaction_type] || '#94a3b8';
        }),
        borderWidth: 0,
        hoverOffset: 6,
      }]
    };
  }

  abs(v: number): number {
    return Math.abs(Number(v) || 0);
  }

  trackById(_index: number, item: any): any {
    return item?.id ?? item?.transaction_type ?? item?.month ?? item?.currency ?? _index;
  }
}
