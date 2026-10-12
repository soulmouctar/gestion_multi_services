import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { BarChart, DonutChart, monthLabel, RankList } from '../../shared/charts';
import { DayPipe, formatNumber, MoneyPipe, NumberPipe } from '../../shared/format';
import { PageHeader } from '../../shared/page-header';
import { Overview, OverviewApi } from './overview';
import { ButtonIcon } from '../../shared/button-icon';

interface Margins {
  summary: {
    total_revenue_gnf: number;
    total_cost_gnf: number;
    total_margin_gnf: number;
    margin_pct: number | null;
    invoices: { revenue: number; cost: number; margin: number };
    containers: { revenue: number; cost: number; margin: number };
  };
  containers: { arrival_id: number; container_number: string; arrival_date: string; quantity_sold: number; revenue_gnf: number; cost_gnf: number; margin_gnf: number; margin_pct: number | null }[];
}

interface FinanceBoard {
  cashflow: { income_total: number; expense_total: number; supplier_out_total: number; outgoing_total: number; net_cashflow: number };
  invoices: { impaye: number; partiel: number; total_remaining: number };
}

interface TaxiBoard {
  fleet: { total: number; active: number | string };
  monthly_revenue: { month: string; collected: string | number }[];
  month: { collected: number; expenses: number; net: number; expected: number; collection_rate: number };
  document_alerts: { id: number; plate_number: string; alerts: unknown[] }[];
}

interface RentalBoard {
  occupancy: { total_units: number; occupied: number; free: number; occupancy_rate: number };
  monthly_revenue: { month: string; collected: string | number }[];
  revenue: { expected_monthly: number; collected_month: number; collection_rate: number };
  by_building: { id: number; building_name: string; location_name: string; total_units: number; occupied: number | string; occupancy_rate: number }[];
}

/** Vue d'ensemble chiffrée : marges, trésorerie, taxi et location, selon les modules ouverts. */
@Component({
  selector: 'app-statistics',
  imports: [ReactiveFormsModule, PageHeader, BarChart, DonutChart, RankList, MoneyPipe, NumberPipe, DayPipe, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './statistics.html',
})
export class Statistics {
  readonly #api = inject(ApiService);
  readonly #auth = inject(AuthService);

  readonly #overviewApi = inject(OverviewApi);

  // --- Vue d'ensemble : séries mensuelles et classements --------------------
  protected readonly months = signal(12);
  protected readonly overview = signal<Overview | null>(null);
  protected readonly monthLabels = computed(() => (this.overview()?.monthly ?? []).map((row) => monthLabel(row.month)));
  protected readonly monthSeries = computed(() => {
    const rows = this.overview()?.monthly ?? [];
    return [
      { name: 'Ventes', values: rows.map((row) => row.sales) },
      { name: 'Encaissé', values: rows.map((row) => row.collected) },
      { name: 'Dépenses', values: rows.map((row) => row.expenses) },
    ];
  });
  protected readonly familySlices = computed(() => (this.overview()?.families ?? []).map((row) => ({ name: row.name, value: row.total })));
  protected readonly topProducts = computed(() =>
    (this.overview()?.top_products ?? []).map((row) => ({ name: row.name, value: row.total, note: `${formatNumber(row.quantity)} vendu(s)` })),
  );
  protected readonly topClients = computed(() => (this.overview()?.top_clients ?? []).map((row) => ({ name: row.name, value: row.total })));
  protected readonly topDebtors = computed(() => (this.overview()?.top_debtors ?? []).map((row) => ({ name: row.name, value: row.balance, currency: row.currency })));

  /** Série mensuelle d'un module (taxi, location) pour un graphique à une seule série. */
  protected series(name: string, rows: { month: string; collected: string | number }[]) {
    return { labels: rows.map((row) => monthLabel(row.month)), series: [{ name, values: rows.map((row) => Number(row.collected) || 0) }] };
  }

  protected readonly margins = signal<Margins | null>(null);
  protected readonly finance = signal<FinanceBoard | null>(null);
  protected readonly taxi = signal<TaxiBoard | null>(null);
  protected readonly rental = signal<RentalBoard | null>(null);
  protected readonly loadingMargins = signal(false);

  protected readonly period = inject(FormBuilder).nonNullable.group({ from: [''], to: [''] });

  constructor() {
    const can = (module: string) => this.#auth.canOpen({ module });
    this.loadOverview();
    if (can('FINANCE')) {
      this.loadMargins();
      this.#api.get<FinanceBoard>('finance/dashboard').subscribe({ next: (data) => this.finance.set(data), error: () => undefined });
    }
    if (can('TAXI')) {
      this.#api.get<TaxiBoard>('taxi/dashboard').subscribe({ next: (data) => this.taxi.set(data), error: () => undefined });
    }
    if (can('RENTAL')) {
      this.#api.get<RentalBoard>('rental/dashboard').subscribe({ next: (data) => this.rental.set(data), error: () => undefined });
    }
  }

  protected loadOverview(months = this.months()): void {
    this.months.set(months);
    this.#overviewApi.load(months).subscribe({ next: (data) => this.overview.set(data), error: () => undefined });
  }

  protected loadMargins(): void {
    this.loadingMargins.set(true);
    this.#api.get<Margins>('finance/margins', this.period.getRawValue()).subscribe({
      next: (data) => {
        this.margins.set(data);
        this.loadingMargins.set(false);
      },
      error: () => this.loadingMargins.set(false),
    });
  }
}
