import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  AlertModule, BadgeModule, ButtonModule, CardModule, FormModule, SpinnerModule, TableModule
} from '@coreui/angular';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { IconDirective } from '@coreui/icons-angular';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ChartData, ChartOptions } from 'chart.js';
import { ApiService } from '../../../core/services/api.service';

type GeneralStats = {
  period: string;
  total_containers: number;
  containers_created: number;
  containers_with_photos: number;
  avg_capacity: number;
  delivered_count?: number;
  not_delivered_count?: number;
};

type CapacityStat = {
  label: string;
  min: number;
  max: number;
  count: number;
  percentage?: number;
};

type StatusStat = {
  label: string;
  count: number;
  percentage: number;
};

type MonthlyStat = {
  month: string;
  count: number;
};

type TopContainer = {
  id: number;
  container_number: string;
  shipping_number?: string | null;
  capacity?: number | null;
  delivery_status?: string | null;
  photos_count?: number;
  updated_at?: string;
};

type ProfitableArrival = {
  arrival_id: number;
  container_number: string;
  arrival_date: string;
  supplier_name: string | null;
  total_quantity: number;
  quantity_sold: number;
  total_sales_value: number;
  total_collected: number;
  cost_of_goods_sold: number;
  generated_interest: number;
  margin_rate: number;
};

type SalesGlobalStats = {
  total_arrivals: number;
  total_bales_received: number;
  total_bales_sold: number;
  total_bales_remaining: number;
  containers_sold_this_month: number;
  total_sales_count: number;
  total_quantity_sold: number;
  total_purchase_value: number;
  total_sales_value: number;
  total_collected: number;
  total_pending: number;
  total_client_advances: number;
  cost_of_goods_sold: number;
  realized_cost_of_goods: number;
  average_sale_value: number;
  average_unit_sale_price: number;
  estimated_profit: number;
  generated_interest: number;
  realized_interest: number;
  outstanding_interest: number;
  profit_margin_rate: number;
  containers_sold_monthly?: Array<{
    month: string;
    containers_sold: number;
    bales_sold: number;
    sales_value: number;
  }>;
  top_profitable_arrivals?: ProfitableArrival[];
};

type PaymentStats = {
  totalSupplierPaid: number;
  totalSupplierPending: number;
  totalClientPaid: number;
  totalClientPending: number;
};

@Component({
  selector: 'app-container-statistics',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, CardModule, FormModule, BadgeModule, AlertModule, SpinnerModule, TableModule, ChartjsComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './container-statistics.component.html'
})
export class ContainerStatisticsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  loading = true;
  error: string | null = null;

  generalStats: GeneralStats | null = null;
  capacityStats: CapacityStat[] = [];
  statusStats: StatusStat[] = [];
  monthlyStats: MonthlyStat[] = [];
  topContainers: TopContainer[] = [];
  recentContainers: TopContainer[] = [];
  salesStats: SalesGlobalStats | null = null;
  paymentStats: PaymentStats | null = null;
  topProfitableArrivals: ProfitableArrival[] = [];
  interestBreakdownChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{ data: [] }]
  };
  interestBreakdownChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 18,
          color: '#475569',
          font: { size: 12, weight: 600 }
        }
      }
    },
    cutout: '68%'
  };
  profitableArrivalsChartData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };
  profitableArrivalsChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: { color: '#64748b', font: { size: 11 } },
        grid: { display: false }
      },
      y: {
        ticks: { color: '#64748b', font: { size: 11 } },
        grid: { color: 'rgba(148,163,184,.18)' }
      }
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 18,
          color: '#475569',
          font: { size: 12, weight: 600 }
        }
      }
    }
  };

  filterForm: FormGroup;

  dateRanges = [
    { id: '7days', label: '7 derniers jours', value: '7days' },
    { id: '30days', label: '30 derniers jours', value: '30days' },
    { id: '3months', label: '3 derniers mois', value: '3months' },
    { id: '6months', label: '6 derniers mois', value: '6months' },
    { id: 'year', label: 'Cette année', value: 'year' }
  ];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {
    this.filterForm = this.fb.group({
      period: ['30days']
    });
  }

  ngOnInit(): void {
    this.loadStatistics();
  }

  loadStatistics(): void {
    this.loading = true;
    this.error = null;

    const period = this.filterForm.get('period')?.value || '30days';
    const params = { params: { period } };

    forkJoin({
      general: this.apiService.get<any>('containers/statistics/general', params).pipe(catchError(() => of(null))),
      capacity: this.apiService.get<any>('containers/statistics/capacity', params).pipe(catchError(() => of(null))),
      status: this.apiService.get<any>('containers/statistics/status', params).pipe(catchError(() => of(null))),
      monthly: this.apiService.get<any>('containers/statistics/monthly', params).pipe(catchError(() => of(null))),
      top: this.apiService.get<any>('containers/statistics/top-performers', params).pipe(catchError(() => of(null))),
      sales: this.apiService.get<any>('container-sales/global-stats').pipe(catchError(() => of(null))),
      payments: this.apiService.get<any>('container-payments/statistics').pipe(catchError(() => of(null)))
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.generalStats = result.general?.success ? result.general.data : null;
        this.capacityStats = this.enrichCapacityStats(result.capacity?.success ? result.capacity.data || [] : []);
        this.statusStats = result.status?.success ? result.status.data || [] : [];
        this.monthlyStats = result.monthly?.success ? result.monthly.data?.monthly_breakdown || [] : [];
        this.topContainers = result.top?.success ? result.top.data?.top_by_photos || [] : [];
        this.recentContainers = result.top?.success ? result.top.data?.recently_active || [] : [];
        this.salesStats = result.sales?.success ? result.sales.data : null;
        this.paymentStats = result.payments?.success ? result.payments.data : null;
        this.topProfitableArrivals = this.salesStats?.top_profitable_arrivals || [];
        this.buildCharts();

        if (!this.generalStats && !this.salesStats && !this.paymentStats) {
          this.error = 'Aucune statistique n’a pu être chargée.';
        }

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Erreur lors du chargement des statistiques des conteneurs';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters(): void {
    this.loadStatistics();
  }

  refreshData(): void {
    this.loadStatistics();
  }

  exportStatistics(): void {
    const rows: string[][] = [
      ['Section', 'Indicateur', 'Valeur']
    ];

    if (this.generalStats) {
      rows.push(
        ['Conteneurs', 'Période', this.periodLabel(this.generalStats.period)],
        ['Conteneurs', 'Total conteneurs', String(this.generalStats.total_containers || 0)],
        ['Conteneurs', 'Créés sur la période', String(this.generalStats.containers_created || 0)],
        ['Conteneurs', 'Avec photos', String(this.generalStats.containers_with_photos || 0)],
        ['Conteneurs', 'Capacité moyenne', String(this.generalStats.avg_capacity || 0)]
      );
    }

    if (this.salesStats) {
      rows.push(
        ['Ventes', 'Arrivages', String(this.salesStats.total_arrivals || 0)],
        ['Ventes', 'Nombre de ventes', String(this.salesStats.total_sales_count || 0)],
        ['Ventes', 'Quantité vendue', String(this.salesStats.total_quantity_sold || 0)],
        ['Ventes', 'Valeur achats', String(this.salesStats.total_purchase_value || 0)],
        ['Ventes', 'Valeur ventes', String(this.salesStats.total_sales_value || 0)],
        ['Ventes', 'Coût des quantités vendues', String(this.salesStats.cost_of_goods_sold || 0)],
        ['Ventes', 'Montant collecté', String(this.salesStats.total_collected || 0)],
        ['Ventes', 'Reste à encaisser', String(this.salesStats.total_pending || 0)],
        ['Ventes', 'Avances clients', String(this.salesStats.total_client_advances || 0)],
        ['Ventes', 'Panier moyen', String(this.salesStats.average_sale_value || 0)],
        ['Ventes', 'Prix moyen par unité', String(this.salesStats.average_unit_sale_price || 0)],
        ['Ventes', 'Intérêt généré', String(this.salesStats.generated_interest || 0)],
        ['Ventes', 'Intérêt encaissé', String(this.salesStats.realized_interest || 0)],
        ['Ventes', 'Intérêt restant', String(this.salesStats.outstanding_interest || 0)]
      );

      this.topProfitableArrivals.forEach((arrival, index) => {
        rows.push(
          ['Classement arrivages', `#${index + 1} ${arrival.container_number}`, String(arrival.generated_interest || 0)]
        );
      });
    }

    if (this.paymentStats) {
      rows.push(
        ['Paiements', 'Fournisseurs payés', String(this.paymentStats.totalSupplierPaid || 0)],
        ['Paiements', 'Fournisseurs en attente', String(this.paymentStats.totalSupplierPending || 0)],
        ['Paiements', 'Clients payés', String(this.paymentStats.totalClientPaid || 0)],
        ['Paiements', 'Clients en attente', String(this.paymentStats.totalClientPending || 0)]
      );
    }

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `container-statistics-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  get photoCoverageRate(): number {
    if (!this.generalStats?.total_containers) return 0;
    return Math.round(((this.generalStats.containers_with_photos || 0) / this.generalStats.total_containers) * 100);
  }

  get averageCapacity(): number {
    if (!this.generalStats) return 0;
    return Math.round(this.generalStats.avg_capacity || 0);
  }

  get collectionRate(): number {
    if (!this.salesStats?.total_sales_value) return 0;
    return Math.round(((this.salesStats.total_collected || 0) / this.salesStats.total_sales_value) * 100);
  }

  get marginRate(): number {
    if (!this.salesStats) return 0;
    return Math.round(this.salesStats.profit_margin_rate || 0);
  }

  get activityRate(): number {
    if (!this.generalStats?.total_containers) return 0;
    return Math.round(((this.generalStats.containers_created || 0) / this.generalStats.total_containers) * 100);
  }

  getStatusColor(label: string): string {
    const value = (label || '').toLowerCase();
    if (value.includes('avec photo')) return 'success';
    if (value.includes('sans photo')) return 'secondary';
    if (value.includes('faible')) return 'info';
    if (value.includes('moyen')) return 'warning';
    if (value.includes('élevé') || value.includes('eleve')) return 'danger';
    return 'primary';
  }

  getCapacityColor(percentage: number): string {
    if (percentage >= 40) return 'danger';
    if (percentage >= 25) return 'warning';
    if (percentage >= 10) return 'info';
    return 'success';
  }

  formatAmount(value: number | null | undefined, currency = 'GNF'): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value || 0) + ' ' + currency;
  }

  formatCapacityRange(container: TopContainer): string {
    return container.capacity != null ? `${container.capacity}` : '—';
  }

  monthlyShare(count: number): number {
    const total = this.generalStats?.total_containers || 0;
    if (!total) return 0;
    return Math.round(((count || 0) * 100) / total);
  }

  periodLabel(period: string | null | undefined): string {
    return this.dateRanges.find((range) => range.value === period)?.label || 'Période personnalisée';
  }

  private buildCharts(): void {
    const sales = this.salesStats;
    const arrivals = this.topProfitableArrivals;

    this.interestBreakdownChartData = {
      labels: ['Intérêt encaissé', 'Intérêt restant', 'Coût des ventes'],
      datasets: [
        {
          data: [
            Math.max(0, sales?.realized_interest || 0),
            Math.max(0, sales?.outstanding_interest || 0),
            Math.max(0, sales?.cost_of_goods_sold || 0)
          ],
          backgroundColor: ['#10B981', '#F59E0B', '#CBD5E1'],
          borderColor: ['#ffffff', '#ffffff', '#ffffff'],
          borderWidth: 3,
          hoverOffset: 8
        }
      ]
    };

    this.profitableArrivalsChartData = {
      labels: arrivals.map((arrival) => arrival.container_number),
      datasets: [
        {
          label: 'Intérêt généré',
          data: arrivals.map((arrival) => arrival.generated_interest || 0),
          backgroundColor: '#047857',
          borderRadius: 8,
          maxBarThickness: 36
        },
        {
          label: 'Montant encaissé',
          data: arrivals.map((arrival) => arrival.total_collected || 0),
          backgroundColor: '#60A5FA',
          borderRadius: 8,
          maxBarThickness: 36
        }
      ]
    };
  }

  private enrichCapacityStats(stats: CapacityStat[]): CapacityStat[] {
    const total = stats.reduce((sum, item) => sum + (item.count || 0), 0);
    return stats.map((item) => ({
      ...item,
      percentage: total > 0 ? Math.round(((item.count || 0) / total) * 100) : 0
    }));
  }

  trackById(_index: number, item: any): any {
    return item?.id ?? item?.value ?? item?.label ?? _index;
  }
}
