import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { apiError, DayPipe, MoneyPipe, NumberPipe, today } from '../../shared/format';
import { PageHeader } from '../../shared/page-header';
import { ToastService } from '../../shared/toast.service';
import { Client, CURRENCIES, Payment, PAYMENT_METHODS, PaymentsSummary, TextileApi } from './textile.api';
import { ButtonIcon } from '../../shared/button-icon';

const PAGE_SIZE = 50;

/** Versements des clients sur une période, avec le total par devise encaissée. */
@Component({
  selector: 'app-textile-period',
  imports: [ReactiveFormsModule, PageHeader, MoneyPipe, NumberPipe, DayPipe, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './period.html',
})
export class Period {
  readonly #api = inject(TextileApi);
  readonly #toast = inject(ToastService);

  protected readonly currencies = CURRENCIES;
  protected readonly loading = signal(true);
  protected readonly clients = signal<Client[]>([]);
  protected readonly payments = signal<Payment[]>([]);
  protected readonly summary = signal<PaymentsSummary | null>(null);
  protected readonly page = signal(1);
  protected readonly lastPage = signal(1);

  protected readonly filters = inject(FormBuilder).nonNullable.group({
    date_from: [today().slice(0, 8) + '01'],
    date_to: [today()],
    client_id: [null as number | null],
    currency: [''],
  });

  constructor() {
    this.#api.clients().subscribe({ next: (clients) => this.clients.set(clients), error: () => undefined });
    this.search();
  }

  protected search(page = 1): void {
    const query = this.filters.getRawValue();
    this.loading.set(true);
    forkJoin([this.#api.payments({ ...query, per_page: PAGE_SIZE, page }), this.#api.paymentsSummary(query)]).subscribe({
      next: ([payments, summary]) => {
        this.payments.set(payments.data);
        this.page.set(payments.current_page);
        this.lastPage.set(payments.last_page);
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.#toast.error(apiError(error, 'Les versements n\'ont pas pu être chargés.'));
      },
    });
  }

  protected methodLabel(value: string): string {
    return PAYMENT_METHODS.find((method) => method.value === value)?.label ?? value;
  }
}
