import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { apiError, DayPipe, formatMoney, formatNumber, MoneyPipe, NumberPipe, today } from '../../shared/format';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { Receipt, ReceiptLine } from '../../shared/receipt';
import { ToastService } from '../../shared/toast.service';
import { CURRENCIES, Page } from '../textile/textile.api';
import { ButtonIcon } from '../../shared/button-icon';

interface ClientPayment {
  id: number;
  receipt_number: string | null;
  amount: string;
  currency: string;
  target_currency: string | null;
  converted_amount: string | null;
  exchange_rate: string;
  method: string;
  reference: string | null;
  payment_date: string;
  client: { id: number; name: string } | null;
  invoice_id: number | null;
}

const METHODS: Record<string, string> = {
  ESPECES: 'Espèces',
  VIREMENT: 'Virement',
  CHEQUE: 'Chèque',
  ORANGE_MONEY: 'Orange Money',
  MTN_MONEY: 'MTN Money',
  WAVE: 'Wave',
};
const PAGE_SIZE = 50;

/** Journal des encaissements clients du commercial : trace, reçu, suppression. */
@Component({
  selector: 'app-finance-receipts',
  imports: [ReactiveFormsModule, PageHeader, Modal, Receipt, MoneyPipe, NumberPipe, DayPipe, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './receipts.html',
})
export class Receipts {
  readonly #api = inject(ApiService);
  readonly #toast = inject(ToastService);

  protected readonly currencies = CURRENCIES;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly payments = signal<ClientPayment[]>([]);
  protected readonly page = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly total = signal(0);
  protected readonly receipt = signal<ClientPayment | null>(null);
  protected readonly deleting = signal<ClientPayment | null>(null);

  protected readonly filters = inject(FormBuilder).nonNullable.group({
    date_from: [today().slice(0, 8) + '01'],
    date_to: [today()],
    currency: [''],
    search: [''],
  });

  constructor() {
    this.search();
  }

  protected search(page = 1): void {
    this.loading.set(true);
    this.#api.get<Page<ClientPayment>>('payments', { ...this.filters.getRawValue(), type: 'CLIENT', per_page: PAGE_SIZE, page }).subscribe({
      next: (result) => {
        this.payments.set(result.data);
        this.page.set(result.current_page);
        this.lastPage.set(result.last_page);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.#toast.error(apiError(error, 'Les encaissements n\'ont pas pu être chargés.'));
      },
    });
  }

  protected methodLabel(value: string): string {
    return METHODS[value] ?? value;
  }

  /** Vrai quand la devise versée a été convertie vers le compte crédité. */
  protected converted(payment: ClientPayment): boolean {
    return !!payment.target_currency && payment.target_currency !== payment.currency;
  }

  protected receiptLines(payment: ClientPayment): ReceiptLine[] {
    return [
      { label: 'Reçu de', value: payment.client?.name ?? '' },
      { label: 'Montant versé', value: formatMoney(payment.amount, payment.currency), main: true },
      ...(this.converted(payment)
        ? [
            { label: 'Taux du jour', value: `${formatNumber(payment.exchange_rate)} GNF` },
            { label: `Crédité au compte ${payment.target_currency}`, value: formatMoney(payment.converted_amount, payment.target_currency!) },
          ]
        : []),
      { label: 'Mode de paiement', value: this.methodLabel(payment.method) + (payment.reference ? ` · ${payment.reference}` : '') },
    ];
  }

  protected confirmDelete(): void {
    const payment = this.deleting();
    if (!payment || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.#api.delete(`payments/${payment.id}`).subscribe({
      next: () => {
        this.saving.set(false);
        this.deleting.set(null);
        this.#toast.success('Encaissement supprimé : le compte du client est rétabli.');
        this.search(this.page());
      },
      error: (error) => {
        this.saving.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }
}
