import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule, CardModule, FormModule, SpinnerModule, TableModule } from '@coreui/angular';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { IconDirective } from '@coreui/icons-angular';
import { ChartData, ChartOptions } from 'chart.js';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-client-statistics',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, IconDirective, ChartjsComponent,
    ButtonModule, CardModule, FormModule, SpinnerModule, TableModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-statistics.component.html'
})
export class ClientStatisticsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  loading = true;
  stats: any = null;
  searchTerm = '';
  clientTypeFilter = '';

  clientTypes = [
    { value: '', label: 'Tous les types' },
    { value: 'TEXTILE', label: 'Clients textile' },
    { value: 'PNEUS', label: 'Clients pneus' },
    { value: 'COSMETIQUES', label: 'Clients cosmétiques' },
    { value: 'MACHINE_A_COUDRE', label: 'Clients machine à coudre' },
  ];

  readonly chartOptions: ChartOptions<'bar' | 'doughnut'> = {
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

  readonly horizontalBarOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: true, position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, pointStyle: 'circle' } },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${this.shortNumber(Number(ctx.parsed.x || 0))} GNF`
        }
      }
    },
    scales: {
      x: { ticks: { color: '#64748b', callback: (v) => this.shortNumber(Number(v)) }, grid: { color: '#eef2f7' } },
      y: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { display: false } }
    }
  };

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    const query = new URLSearchParams();
    if (this.searchTerm) query.set('search', this.searchTerm);
    if (this.clientTypeFilter) query.set('client_type', this.clientTypeFilter);
    const suffix = query.toString() ? `?${query.toString()}` : '';

    this.apiService.get<any>(`clients/financial-overview${suffix}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.stats = r?.success ? r.data : null;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.stats = null;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get countsChartData(): ChartData<'bar'> {
    const summary = this.stats?.summary || {};
    return {
      labels: ['Clients', 'Débiteurs', 'Soldés', 'Avec avance'],
      datasets: [{
        label: 'Nombre',
        data: [
          Number(summary.total_clients || 0),
          Number(summary.debtor_clients || 0),
          Number(summary.settled_clients || 0),
          Number(summary.credit_clients || 0),
        ],
        backgroundColor: ['#0f3460', '#DC2626', '#2563EB', '#059669'],
        borderRadius: 12,
        maxBarThickness: 48,
      }]
    };
  }

  get amountsChartData(): ChartData<'bar'> {
    const summary = this.stats?.summary || {};
    return {
      labels: ['Avances', 'Restes à payer', 'Crédit net', 'Dette brute'],
      datasets: [{
        label: 'Montant GNF',
        data: [
          Number(summary.total_advances_remaining || 0),
          Number(summary.total_rest_to_pay || 0),
          Number(summary.total_credit_balance || 0),
          Number(summary.total_debt || 0),
        ],
        backgroundColor: ['#059669', '#D97706', '#7C3AED', '#DC2626'],
        borderRadius: 12,
        maxBarThickness: 46,
      }]
    };
  }

  get collectionChartData(): ChartData<'bar'> {
    const summary = this.stats?.summary || {};
    return {
      labels: ['Facturé / vendu', 'Payé', 'Reste dû', 'Crédit net'],
      datasets: [{
        label: 'Performance GNF',
        data: [
          Number(summary.total_charged || 0),
          Number(summary.total_paid || 0),
          Number(summary.total_rest_to_pay || 0),
          Number(summary.total_credit_balance || 0),
        ],
        backgroundColor: ['#1D4ED8', '#16A34A', '#DC2626', '#7C3AED'],
        borderRadius: 10,
        maxBarThickness: 44,
      }]
    };
  }

  get topClientsChartData(): ChartData<'bar'> {
    const rows = this.topClientsByPaid(8);
    return {
      labels: rows.map((c: any) => c.name),
      datasets: [
        {
          label: 'Payé',
          data: rows.map((c: any) => Number(c.total_paid || 0)),
          backgroundColor: '#16A34A',
          borderRadius: 8,
        },
        {
          label: 'Reste dû',
          data: rows.map((c: any) => Number(c.rest_to_pay_gnf || 0)),
          backgroundColor: '#DC2626',
          borderRadius: 8,
        }
      ]
    };
  }

  get clientTypesChartData(): ChartData<'doughnut'> {
    const grouped = this.clients.reduce((acc: Record<string, number>, client: any) => {
      const key = this.clientTypeLabel(client.client_type || 'AUTRE');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return {
      labels: Object.keys(grouped),
      datasets: [{
        data: Object.values(grouped),
        backgroundColor: ['#1D4ED8', '#16A34A', '#F59E0B', '#7C3AED', '#06B6D4', '#64748B'],
        borderWidth: 0,
      }]
    };
  }

  get statusesChartData(): ChartData<'doughnut'> {
    const summary = this.stats?.summary || {};
    return {
      labels: ['Débiteurs', 'Soldés', 'Avec avance'],
      datasets: [{
        data: [
          Number(summary.debtor_clients || 0),
          Number(summary.settled_clients || 0),
          Number(summary.credit_clients || 0),
        ],
        backgroundColor: ['#DC2626', '#2563EB', '#059669'],
        borderWidth: 0,
      }]
    };
  }

  fmt(v: number, currency = 'GNF'): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0 }).format(v || 0) + ' ' + currency;
  }

  shortNumber(v: number): string {
    const abs = Math.abs(v || 0);
    if (abs >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + ' Mrd';
    if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' M';
    if (abs >= 1_000) return (v / 1_000).toFixed(1) + ' k';
    return String(Math.round(v || 0));
  }

  get clients(): any[] {
    return this.stats?.clients || [];
  }

  collectionRate(): number {
    const summary = this.stats?.summary || {};
    const charged = Number(summary.total_charged || 0) + Number(summary.total_interest_charged || 0);
    if (charged <= 0) return 0;
    return Math.min(100, Math.round((Number(summary.total_paid || 0) / charged) * 100));
  }

  averageClientValue(): number {
    const count = Number(this.stats?.summary?.total_clients || 0);
    return count > 0 ? Number(this.stats?.summary?.total_charged || 0) / count : 0;
  }

  topClientsByPaid(limit = 5): any[] {
    return this.clients
      .slice()
      .sort((a: any, b: any) => Number(b.total_paid || 0) - Number(a.total_paid || 0))
      .slice(0, limit);
  }

  riskClients(limit = 5): any[] {
    return this.clients
      .filter((c: any) => Number(c.rest_to_pay_gnf || 0) > 0)
      .slice()
      .sort((a: any, b: any) => Number(b.rest_to_pay_gnf || 0) - Number(a.rest_to_pay_gnf || 0))
      .slice(0, limit);
  }

  clientTypeLabel(type: string): string {
    const map: Record<string, string> = {
      TEXTILE: 'Textile',
      PNEUS: 'Pneus',
      COSMETIQUES: 'Cosmétiques',
      MACHINE_A_COUDRE: 'Machine à coudre',
    };
    return map[type] || type || 'Autre';
  }

  getStatusTone(status: string): string {
    if (status === 'DEBITEUR') return '#DC2626';
    if (status === 'AVANCE') return '#059669';
    return '#2563EB';
  }

  getStatusBg(status: string): string {
    if (status === 'DEBITEUR') return '#FEF2F2';
    if (status === 'AVANCE') return '#ECFDF5';
    return '#EFF6FF';
  }

  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }
}
