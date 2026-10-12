import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { MODULES } from '../../core/windows';
import { BarChart, DonutChart, monthLabel, RankList } from '../../shared/charts';
import { MoneyPipe, NumberPipe } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { Overview, OverviewApi } from '../stats/overview';
import { ButtonIcon } from '../../shared/button-icon';

interface Due {
  currency: string;
  amount: number;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, Icon, PageHeader, BarChart, DonutChart, RankList, MoneyPipe, NumberPipe, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  readonly #auth = inject(AuthService);

  protected readonly firstName = computed(() => (this.#auth.user()?.name ?? '').split(/\s+/)[0] ?? '');

  protected readonly modules = computed(() =>
    MODULES.map((module) => ({
      ...module,
      windows: module.windows.filter((window) => this.#auth.canOpen(window)),
    })).filter((module) => module.windows.length > 0),
  );

  /** Chiffres du jour ; chacun n'est demandé que si l'utilisateur a le module correspondant. */
  protected readonly clientDue = signal<Due[] | null>(null);
  protected readonly supplierDue = signal<Due[] | null>(null);
  protected readonly stockAlerts = signal<number | null>(null);
  protected readonly containersOnTheWay = signal<number | null>(null);

  // --- Graphiques : six derniers mois -----------------------------------------
  protected readonly overview = signal<Overview | null>(null);
  protected readonly monthLabels = computed(() => (this.overview()?.monthly ?? []).map((row) => monthLabel(row.month)));
  protected readonly monthSeries = computed(() => {
    const rows = this.overview()?.monthly ?? [];
    return [
      { name: 'Ventes', values: rows.map((row) => row.sales) },
      { name: 'Encaissé', values: rows.map((row) => row.collected) },
    ];
  });
  protected readonly familySlices = computed(() => (this.overview()?.families ?? []).map((row) => ({ name: row.name, value: row.total })));
  protected readonly topDebtors = computed(() =>
    (this.overview()?.top_debtors ?? []).slice(0, 5).map((row) => ({ name: row.name, value: row.balance, currency: row.currency })),
  );

  constructor() {
    const api = inject(ApiService);
    inject(OverviewApi)
      .load(6)
      .subscribe({ next: (data) => this.overview.set(data), error: () => undefined });
    const can = (module: string) => this.#auth.canOpen({ module });
    const due = (totals: Record<string, { final_balance: number }> | undefined): Due[] =>
      Object.entries(totals ?? {})
        .map(([currency, row]) => ({ currency, amount: Number(row.final_balance) || 0 }))
        .filter((line) => line.amount > 0);

    if (can('CLIENTS_SUPPLIERS')) {
      // Par client : seuls les soldes débiteurs comptent, l'avance de l'un ne réduit pas la dette d'un autre
      api.get<{ clients: { by_currency: Record<string, { final_balance: number }> }[] }>('clients/financial-overview').subscribe({
        next: (data) => {
          const totals = new Map<string, number>();
          for (const client of data.clients) {
            for (const line of due(client.by_currency)) {
              totals.set(line.currency, (totals.get(line.currency) ?? 0) + line.amount);
            }
          }
          this.clientDue.set([...totals].map(([currency, amount]) => ({ currency, amount })));
        },
        error: () => undefined,
      });
      api.get<{ suppliers: { by_currency: Record<string, { final_balance: number }> }[] }>('suppliers/balance-summary').subscribe({
        next: (data) => {
          const totals = new Map<string, number>();
          for (const supplier of data.suppliers) {
            for (const line of due(supplier.by_currency)) {
              totals.set(line.currency, (totals.get(line.currency) ?? 0) + line.amount);
            }
          }
          this.supplierDue.set([...totals].map(([currency, amount]) => ({ currency, amount })));
        },
        error: () => undefined,
      });
    }
    if (can('COMMERCE')) {
      api.get<{ data: { stock_quantity: number; low_stock_threshold: number | null }[] }>('products', { per_page: 2000 }).subscribe({
        next: (page) => this.stockAlerts.set(page.data.filter((p) => p.stock_quantity <= (p.low_stock_threshold ?? 0)).length),
        error: () => undefined,
      });
    }
    if (can('CONTAINER')) {
      api.get<{ data: { delivery_status: string }[] }>('containers', { per_page: 500 }).subscribe({
        next: (page) => this.containersOnTheWay.set(page.data.filter((c) => c.delivery_status !== 'LIVRE').length),
        error: () => undefined,
      });
    }
  }
}
