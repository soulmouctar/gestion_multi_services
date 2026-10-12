import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, map, of, switchMap } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { apiError, DayPipe, NumberPipe, today } from '../../shared/format';
import { PageHeader } from '../../shared/page-header';
import { Pager, paginate } from '../../shared/pager';
import { ToastService } from '../../shared/toast.service';
import { Page } from '../textile/textile.api';
import { ButtonIcon } from '../../shared/button-icon';

interface Currency {
  id: number;
  code: string;
  name: string;
  exchange_rate: string;
}

interface RateEntry {
  id: number;
  rate: string;
  rate_date: string;
  currency: { code: string } | null;
}

/** Devises étrangères suivies ; créées côté serveur si elles manquent. */
const FOREIGN = [
  { code: 'USD', name: 'Dollar américain' },
  { code: 'EUR', name: 'Euro' },
];

/** Taux du jour de chaque devise en GNF, proposé ensuite dans les ventes et les encaissements. */
@Component({
  selector: 'app-finance-rates',
  imports: [FormsModule, PageHeader, NumberPipe, DayPipe, Pager, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rates.html',
})
export class Rates {
  readonly #api = inject(ApiService);
  readonly #toast = inject(ToastService);
  protected readonly canEdit = inject(AuthService).isAdmin;

  protected readonly loading = signal(true);
  protected readonly savingCode = signal<string | null>(null);
  protected readonly currencies = signal<Currency[]>([]);
  protected readonly history = signal<RateEntry[]>([]);
  protected readonly pager = paginate(this.history);
  /** Taux en cours de saisie, par code de devise. */
  protected drafts: Record<string, number | null> = {};

  constructor() {
    this.load();
  }

  protected load(): void {
    forkJoin([
      this.#api.get<Currency[]>('currencies'),
      this.#api.get<Page<RateEntry>>('exchange-rates', { per_page: 60 }).pipe(map((page) => page.data)),
    ]).subscribe({
      next: ([currencies, history]) => {
        const known = currencies.filter((currency) => currency.code.toUpperCase() !== 'GNF');
        this.currencies.set(known);
        for (const currency of known) {
          this.drafts[currency.code] = this.configured(currency);
        }
        this.history.set(history);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.#toast.error(apiError(error, 'Les taux n\'ont pas pu être chargés.'));
      },
    });
  }

  /** Un taux de 1 ou moins signifie que la devise n'a pas encore été réglée. */
  protected configured(currency: Currency): number | null {
    const rate = Number(currency.exchange_rate);
    return rate > 1 ? rate : null;
  }

  protected missing(): { code: string; name: string }[] {
    const present = new Set(this.currencies().map((currency) => currency.code.toUpperCase()));
    return FOREIGN.filter((currency) => !present.has(currency.code));
  }

  protected save(currency: Currency): void {
    const rate = Number(this.drafts[currency.code]);
    if (!(rate > 1)) {
      this.#toast.error(`Saisissez combien de GNF vaut 1 ${currency.code}.`);
      return;
    }
    this.savingCode.set(currency.code);
    // Le taux courant sert aux calculs ; l'entrée datée garde l'historique
    this.#api
      .put(`currencies/${currency.id}`, { exchange_rate: rate })
      .pipe(switchMap(() => this.#api.post('exchange-rates', { currency_id: currency.id, rate, rate_date: today() })))
      .subscribe({
        next: () => {
          this.savingCode.set(null);
          this.#toast.success(`Taux du jour enregistré : 1 ${currency.code} = ${rate} GNF.`);
          this.load();
        },
        error: (error) => {
          this.savingCode.set(null);
          this.#toast.error(apiError(error));
        },
      });
  }

  protected add(currency: { code: string; name: string }): void {
    of(null)
      .pipe(switchMap(() => this.#api.post('currencies', { code: currency.code, name: currency.name, symbol: currency.code, exchange_rate: 1 })))
      .subscribe({
        next: () => this.load(),
        error: (error) => this.#toast.error(apiError(error)),
      });
  }
}
