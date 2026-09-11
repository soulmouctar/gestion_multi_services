import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BadgeModule, ButtonModule, CardModule, SpinnerModule } from '@coreui/angular';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

interface Occupancy {
  total_units: number;
  occupied: number;
  free: number;
  occupancy_rate: number;
}

interface Revenue {
  expected_monthly: number;
  collected_month: number;
  collection_rate: number;
  total_deposits: number;
}

interface LeaseStats {
  total: number;
  active: number;
  pending: number;
  expired_count: number;
  terminated_count: number;
  total_deposits: number;
}

interface ExpiringLease {
  id: number;
  renter_name: string;
  renter_phone: string | null;
  end_date: string;
  days_remaining: number;
  monthly_rent: number;
  currency: string;
  urgency: 'danger' | 'warning' | 'info';
}

interface LatePayment {
  id: number;
  renter_name: string;
  period_month: string;
  amount: number;
  currency: string;
  status: 'LATE' | 'PENDING' | string;
}

interface BuildingOccupancy {
  building_id: number;
  building_name: string;
  location_name: string | null;
  total_units: number;
  occupied: number;
  occupancy_rate: number;
  monthly_revenue: number;
}

interface MonthlyRevenuePoint {
  month: string;
  collected: number | string;
  payments: number | string;
}

interface RentalDashboardData {
  occupancy: Occupancy;
  revenue: Revenue;
  leases: LeaseStats;
  expiring_soon: ExpiringLease[];
  late_payments: LatePayment[];
  by_building: BuildingOccupancy[];
  monthly_revenue: MonthlyRevenuePoint[];
  period: string;
}

interface Kpi {
  label: string;
  tag: string;
  value: number;
  icon: string;
  color: string;
  soft: string;
  /** Pourcentage de la jauge, ou null si la carte n'en a pas. */
  progress: number | null;
  /** Ligne de contexte en pied de carte, toujours présente. */
  caption: string;
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const EMPTY_OCCUPANCY: Occupancy = { total_units: 0, occupied: 0, free: 0, occupancy_rate: 0 };
const EMPTY_REVENUE: Revenue = { expected_monthly: 0, collected_month: 0, collection_rate: 0, total_deposits: 0 };

@Component({
  selector: 'app-rental-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterModule, IconDirective,
    CardModule, ButtonModule, BadgeModule, SpinnerModule, ChartjsComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rental-dashboard.component.html',
  styleUrl: './rental-dashboard.component.scss'
})
export class RentalDashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  /** Périmètre du cercle de progression : 2 * PI * r, avec r = 44. */
  readonly RING_CIRCUMFERENCE = Math.round(2 * Math.PI * 44);

  loading = true;
  errorMessage = '';
  data: RentalDashboardData | null = null;

  kpis: Kpi[] = [];
  revenueChartData: any = { labels: [], datasets: [] };
  revenueChartOptions: any = {};

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.apiService.get<RentalDashboardData>('rental/dashboard')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          if (r.success && r.data) {
            this.data = r.data;
            this.kpis = this.buildKpis(r.data);
            this.buildRevenueChart(r.data.monthly_revenue || []);
          } else {
            this.errorMessage = r.message || 'Réponse inattendue du serveur.';
          }
          this.loading = false;
          this.cdr.detectChanges();
        },
        // Sans ce message, une erreur API laissait une page entièrement blanche.
        error: (err) => {
          this.errorMessage = err?.message || 'Impossible de charger le tableau de bord.';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  // ===== ACCESSEURS TEMPLATE =====

  get occupancy(): Occupancy { return this.data?.occupancy ?? EMPTY_OCCUPANCY; }
  get revenue(): Revenue { return this.data?.revenue ?? EMPTY_REVENUE; }
  get expiringSoon(): ExpiringLease[] { return this.data?.expiring_soon ?? []; }
  get latePayments(): LatePayment[] { return this.data?.late_payments ?? []; }
  get byBuilding(): BuildingOccupancy[] { return this.data?.by_building ?? []; }

  get activeLeases(): number { return Number(this.data?.leases?.active ?? 0); }
  get pendingLeases(): number { return Number(this.data?.leases?.pending ?? 0); }
  get expiredLeases(): number { return Number(this.data?.leases?.expired_count ?? 0); }

  get periodLabel(): string { return this.formatPeriod(this.data?.period || ''); }

  get ringDash(): number {
    const rate = Math.min(100, Math.max(0, this.occupancy.occupancy_rate || 0));
    return Math.round(rate / 100 * this.RING_CIRCUMFERENCE);
  }

  get hasRevenueHistory(): boolean {
    return (this.data?.monthly_revenue?.length ?? 0) > 0;
  }

  get revenueHistoryTotal(): number {
    return (this.data?.monthly_revenue ?? [])
      .reduce((sum, point) => sum + Number(point.collected || 0), 0);
  }

  // ===== CONSTRUCTION =====

  private buildKpis(data: RentalDashboardData): Kpi[] {
    const occ = data.occupancy ?? EMPTY_OCCUPANCY;
    const rate = Math.min(100, Math.max(0, occ.occupancy_rate || 0));
    const buildings = data.by_building?.length ?? 0;
    const totalLeases = Number(data.leases?.total ?? 0);
    const activeLeases = Number(data.leases?.active ?? 0);

    return [
      {
        label: 'Unités au total', tag: 'Parc', value: occ.total_units,
        icon: 'cilBuilding', color: '#6366f1', soft: 'rgba(99, 102, 241, .12)',
        progress: null,
        caption: buildings ? `Réparties sur ${buildings} bâtiment(s)` : 'Aucun bâtiment enregistré'
      },
      {
        label: 'Unités occupées', tag: 'Louées', value: occ.occupied,
        icon: 'cilHome', color: '#10b981', soft: 'rgba(16, 185, 129, .12)',
        progress: rate,
        caption: `${rate}% du parc`
      },
      {
        label: 'Unités libres', tag: 'Libres', value: occ.free,
        icon: 'cilLayers', color: '#f59e0b', soft: 'rgba(245, 158, 11, .14)',
        progress: 100 - rate,
        caption: `${100 - rate}% du parc`
      },
      {
        label: 'Baux actifs', tag: 'Actifs', value: activeLeases,
        icon: 'cilDescription', color: '#0ea5e9', soft: 'rgba(14, 165, 233, .12)',
        progress: totalLeases ? Math.round((activeLeases / totalLeases) * 100) : 0,
        caption: `sur ${totalLeases} bail/baux`
      }
    ];
  }

  /** L'API renvoyait déjà monthly_revenue ; il n'était affiché nulle part. */
  private buildRevenueChart(points: MonthlyRevenuePoint[]): void {
    const labels = points.map(p => this.formatPeriodShort(p.month));
    const values = points.map(p => Number(p.collected || 0));

    this.revenueChartData = {
      labels,
      datasets: [{
        label: 'Encaissé',
        data: values,
        backgroundColor: 'rgba(16, 185, 129, .75)',
        hoverBackgroundColor: '#10b981',
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 42
      }]
    };

    this.revenueChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => ` ${this.fmt(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 } }
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: 'rgba(148, 163, 184, .18)' },
          ticks: {
            font: { size: 11 },
            callback: (value: number | string) => this.compact(Number(value))
          }
        }
      }
    };
  }

  // ===== HELPERS =====

  fmt(value: number, currency = 'GNF'): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0 }).format(value || 0) + ' ' + currency;
  }

  /** Axe Y lisible : 1 500 000 → « 1,5 M ». */
  private compact(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return (value / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M';
    if (abs >= 1_000) return (value / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' k';
    return String(value);
  }

  /** « 2026-08 » → « Août 2026 ». */
  formatPeriod(period: string): string {
    if (!period || period.length < 7) return period || '—';
    const [year, month] = period.split('-');
    return `${MONTHS_FR[parseInt(month, 10) - 1] ?? month} ${year}`;
  }

  /** « 2026-08 » → « Aoû 26 », pour les libellés d'axe. */
  private formatPeriodShort(period: string): string {
    if (!period || period.length < 7) return period || '';
    const [year, month] = period.split('-');
    const label = MONTHS_FR[parseInt(month, 10) - 1] ?? month;
    return `${label.slice(0, 3)} ${year.slice(-2)}`;
  }

  urgencyColor(urgency: string): string {
    if (urgency === 'danger') return '#ef4444';
    if (urgency === 'warning') return '#f59e0b';
    return '#3b82f6';
  }

  trackById(_index: number, item: { id: number }): number { return item.id; }
  trackByLabel(_index: number, item: Kpi): string { return item.label; }
  trackByBuilding(_index: number, item: BuildingOccupancy): number { return item.building_id; }
}
