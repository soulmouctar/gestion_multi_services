import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { apiError, DayPipe, formatMoney, formatNumber, MoneyPipe, NumberPipe, today } from '../../shared/format';
import { Receipt, ReceiptLine } from '../../shared/receipt';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { Pager, paginate } from '../../shared/pager';
import { ToastService } from '../../shared/toast.service';
import { CURRENCIES, Payment, PAYMENT_METHODS, Sale, TextileApi } from './textile.api';
import { ButtonIcon } from '../../shared/button-icon';

/** Encaissement d'un client sur une vente, en GNF ou en devise, au taux du jour. */
@Component({
  selector: 'app-textile-payments',
  imports: [ReactiveFormsModule, PageHeader, Modal, Receipt, MoneyPipe, NumberPipe, DayPipe, Pager, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payments.html',
})
export class Payments {
  readonly #api = inject(TextileApi);
  readonly #toast = inject(ToastService);
  readonly #fb = inject(FormBuilder).nonNullable;

  protected readonly currencies = CURRENCIES;
  protected readonly methods = PAYMENT_METHODS;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly payments = signal<Payment[]>([]);
  protected readonly search = signal('');
  protected readonly currencyFilter = signal('');
  protected readonly visiblePayments = computed(() => {
    const term = this.search().trim().toLowerCase();
    const currency = this.currencyFilter();
    return this.payments().filter(
      (payment) =>
        (!currency || payment.currency === currency) &&
        (!term || `${payment.client?.name ?? ''} ${payment.reference ?? ''}`.toLowerCase().includes(term)),
    );
  });
  protected readonly pager = paginate(this.visiblePayments);
  /** Ventes qui attendent encore un paiement. */
  protected readonly openSales = signal<Sale[]>([]);
  readonly #rates = signal<Record<string, number>>({});

  protected readonly creating = signal(false);
  protected readonly deleting = signal<Payment | null>(null);
  /** Encaissement dont le reçu est affiché. */
  protected readonly receipt = signal<Payment | null>(null);
  protected readonly form = this.#fb.group({
    client_id: [null as number | null, Validators.required],
    sale_id: [null as number | null, Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(1)]],
    currency: ['GNF'],
    rate: [null as number | null],
    payment_date: [today(), Validators.required],
    payment_method: ['ESPECES'],
    reference: [''],
  });
  readonly #value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly debtors = computed(() => {
    const byId = new Map<number, string>();
    for (const sale of this.openSales()) {
      byId.set(sale.client_id, sale.client?.name ?? `Client ${sale.client_id}`);
    }
    return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  });
  protected readonly clientSales = computed(() => this.openSales().filter((sale) => sale.client_id === this.#value().client_id));
  protected readonly sale = computed(() => this.openSales().find((sale) => sale.id === this.#value().sale_id));

  /**
   * Devise dont le taux du jour est demandé :
   * la devise versée si elle est étrangère et diffère de la vente, sinon celle de la vente payée en GNF.
   */
  protected readonly rateFor = computed(() => {
    const sale = this.sale();
    const paid = this.#value().currency ?? 'GNF';
    if (!sale || paid === sale.currency) {
      return null;
    }
    return paid === 'GNF' ? sale.currency : paid;
  });

  /** Montant porté au crédit du client, dans la devise de la vente. */
  protected readonly credited = computed(() => {
    const sale = this.sale();
    const amount = Number(this.#value().amount) || 0;
    const paid = this.#value().currency ?? 'GNF';
    const rate = Number(this.#value().rate) || 0;
    if (!sale || paid === sale.currency) {
      return amount;
    }
    if (!(rate > 0)) {
      return 0;
    }
    if (paid === 'GNF') {
      return Math.round((amount / rate) * 100) / 100;
    }
    const gnf = amount * rate;
    // Deux devises étrangères : le serveur repasse par le GNF au taux de la vente
    return sale.currency === 'GNF' ? Math.round(gnf) : Math.round((gnf / (Number(sale.exchange_rate) || 1)) * 100) / 100;
  });
  protected readonly remainingAfter = computed(() => {
    const sale = this.sale();
    return sale ? Number(sale.remaining_amount) - this.credited() : 0;
  });

  constructor() {
    this.load();
    this.#api.rates().subscribe({ next: (rates) => this.#rates.set(rates), error: () => undefined });
    this.form.controls.client_id.valueChanges.subscribe((clientId) => {
      const sales = this.openSales().filter((sale) => sale.client_id === clientId);
      this.form.controls.sale_id.setValue(sales.length === 1 ? sales[0].id : null);
    });
    // Un champ notifie avant que le formulaire entier soit à jour : on attend la fin du tour
    this.form.controls.sale_id.valueChanges.subscribe(() => queueMicrotask(() => this.#suggestRate()));
    this.form.controls.currency.valueChanges.subscribe(() => queueMicrotask(() => this.#suggestRate()));
  }

  protected load(): void {
    forkJoin([this.#api.payments({ per_page: 100 }), this.#api.sales()]).subscribe({
      next: ([payments, sales]) => {
        this.payments.set(payments.data);
        this.openSales.set(sales.filter((sale) => sale.status === 'EN_COURS' || sale.status === 'PAYE_PARTIEL'));
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.#toast.error(apiError(error, 'Les encaissements n\'ont pas pu être chargés.'));
      },
    });
  }

  protected methodLabel(value: string): string {
    return this.methods.find((method) => method.value === value)?.label ?? value;
  }

  /** Crédit réel d'un encaissement dans la devise de sa vente. */
  protected creditOf(payment: Payment): { amount: number; currency: string } | null {
    const sale = payment.container_sale;
    if (!sale || sale.currency === payment.currency || payment.amount_gnf === null) {
      return null;
    }
    const gnf = Number(payment.amount_gnf);
    return {
      currency: sale.currency,
      amount: sale.currency === 'GNF' ? gnf : Math.round((gnf / (Number(sale.exchange_rate) || 1)) * 100) / 100,
    };
  }

  /** Lignes du reçu d'un encaissement. */
  protected receiptLines(payment: Payment): ReceiptLine[] {
    const sale = payment.container_sale;
    const credit = this.creditOf(payment);
    return [
      { label: 'Reçu de', value: payment.client?.name ?? '' },
      { label: 'Montant versé', value: formatMoney(payment.amount, payment.currency), main: true },
      ...(credit
        ? [
            { label: 'Taux du jour', value: `${formatNumber(payment.exchange_rate)} GNF` },
            { label: 'Crédité sur la vente', value: formatMoney(credit.amount, credit.currency) },
          ]
        : []),
      { label: 'Pour', value: `Conteneur ${sale?.container_arrival?.container?.container_number ?? ''}, ${formatNumber(sale?.quantity_sold)} balles` },
      { label: 'Mode de paiement', value: this.methodLabel(payment.payment_method) + (payment.reference ? ` · ${payment.reference}` : '') },
      ...(sale ? [{ label: 'Reste à payer sur cette vente', value: formatMoney(sale.remaining_amount, sale.currency) }] : []),
    ];
  }

  protected open(): void {
    this.form.reset({ currency: 'GNF', payment_date: today(), payment_method: 'ESPECES' });
    this.creating.set(true);
  }

  protected save(): void {
    const value = this.form.getRawValue();
    const sale = this.sale();
    const rateFor = this.rateFor();
    if (this.form.invalid || !sale || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    if (rateFor && !(Number(value.rate) > 1)) {
      this.#toast.error(`Saisissez le taux du jour : 1 ${rateFor} en GNF.`);
      return;
    }
    if (this.remainingAfter() < -0.01) {
      this.#toast.error('Le montant dépasse le reste à payer de cette vente.');
      return;
    }

    this.saving.set(true);
    this.#api
      .createPayment({
        container_sale_id: sale.id,
        amount: value.amount,
        currency: value.currency,
        exchange_rate: rateFor ? value.rate : null,
        payment_date: value.payment_date,
        payment_method: value.payment_method,
        reference: value.reference || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.creating.set(false);
          this.#toast.success('Encaissement enregistré au compte du client.');
          this.load();
        },
        error: (error) => {
          this.saving.set(false);
          this.#toast.error(apiError(error));
        },
      });
  }

  protected confirmDelete(): void {
    const payment = this.deleting();
    if (!payment || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.#api.deletePayment(payment.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.deleting.set(null);
        this.#toast.success('Encaissement supprimé : le reste à payer est rétabli.');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }

  #suggestRate(): void {
    const foreign = this.rateFor();
    this.form.controls.rate.setValue(foreign ? (this.#rates()[foreign] ?? null) : null);
  }
}
