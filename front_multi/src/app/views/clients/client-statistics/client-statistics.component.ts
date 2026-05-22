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
    { value: 'GENERAL', label: 'Clients généraux' },
    { value: 'PNEUS', label: 'Clients pneus' },
    { value: 'TEXTILE', label: 'Clients textile' },
    { value: 'COSMETIQUES', label: 'Clients cosmétiques' },
    { value: 'CONTAINER_PAGNE', label: 'Clients conteneurs pagne' },
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
