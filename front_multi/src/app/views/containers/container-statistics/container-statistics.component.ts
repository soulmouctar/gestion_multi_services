import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  AlertModule, BadgeModule, ButtonModule, CardModule, FormModule, SpinnerModule, TableModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';

type GeneralStats = {
  period: string;
  total_containers: number;
  containers_created: number;
  containers_with_photos: number;
  avg_capacity_min: number;
  avg_capacity_max: number;
  avg_interest_rate: number;
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
  capacity_min: number | null;
  capacity_max: number | null;
  interest_rate: number | null;
  photos_count?: number;
  updated_at?: string;
};

type SalesGlobalStats = {
  total_arrivals: number;
  total_purchase_value: number;
  total_sales_value: number;
  total_collected: number;
  total_pending: number;
  total_client_advances: number;
  estimated_profit: number;
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
    ButtonModule, CardModule, FormModule, BadgeModule, AlertModule, SpinnerModule, TableModule
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
        ['Conteneurs', 'Capacité min moyenne', String(this.generalStats.avg_capacity_min || 0)],
        ['Conteneurs', 'Capacité max moyenne', String(this.generalStats.avg_capacity_max || 0)],
        ['Conteneurs', 'Taux d’intérêt moyen', String(this.generalStats.avg_interest_rate || 0)]
      );
    }

    if (this.salesStats) {
      rows.push(
        ['Ventes', 'Arrivages', String(this.salesStats.total_arrivals || 0)],
        ['Ventes', 'Valeur achats', String(this.salesStats.total_purchase_value || 0)],
        ['Ventes', 'Valeur ventes', String(this.salesStats.total_sales_value || 0)],
        ['Ventes', 'Montant collecté', String(this.salesStats.total_collected || 0)],
        ['Ventes', 'Reste à encaisser', String(this.salesStats.total_pending || 0)],
        ['Ventes', 'Avances clients', String(this.salesStats.total_client_advances || 0)],
        ['Ventes', 'Profit estimé', String(this.salesStats.estimated_profit || 0)]
      );
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
    const min = this.generalStats.avg_capacity_min || 0;
    const max = this.generalStats.avg_capacity_max || 0;
    return Math.round((min + max) / 2);
  }

  get collectionRate(): number {
    if (!this.salesStats?.total_sales_value) return 0;
    return Math.round(((this.salesStats.total_collected || 0) / this.salesStats.total_sales_value) * 100);
  }

  get marginRate(): number {
    if (!this.salesStats?.total_sales_value) return 0;
    return Math.round(((this.salesStats.estimated_profit || 0) / this.salesStats.total_sales_value) * 100);
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
    return `${container.capacity_min || 0} - ${container.capacity_max || 0}`;
  }

  monthlyShare(count: number): number {
    const total = this.generalStats?.total_containers || 0;
    if (!total) return 0;
    return Math.round(((count || 0) * 100) / total);
  }

  periodLabel(period: string | null | undefined): string {
    return this.dateRanges.find((range) => range.value === period)?.label || 'Période personnalisée';
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
