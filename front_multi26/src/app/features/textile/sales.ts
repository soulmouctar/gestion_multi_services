import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of, switchMap } from 'rxjs';

import { apiError, DayPipe, formatMoney, formatNumber, MoneyPipe, NumberPipe, today } from '../../shared/format';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { PdfService } from '../../shared/pdf.service';
import { Pager, paginate } from '../../shared/pager';
import { ToastService } from '../../shared/toast.service';
import { Arrival, Client, CURRENCIES, Sale, SALE_STATUS, TextileApi } from './textile.api';
import { ButtonIcon } from '../../shared/button-icon';

/** Ventes de balles sur les conteneurs livrés. */
@Component({
  selector: 'app-textile-sales',
  imports: [ReactiveFormsModule, PageHeader, Modal, MoneyPipe, NumberPipe, DayPipe, Pager, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales.html',
})
export class Sales {
  readonly #api = inject(TextileApi);
  readonly #toast = inject(ToastService);
  readonly #fb = inject(FormBuilder).nonNullable;

  protected readonly currencies = CURRENCIES;
  protected readonly statuses = SALE_STATUS;
  readonly #pdf = inject(PdfService);

  protected printInvoice(sale: Sale): void {
    const container = sale.container_arrival?.container?.container_number ?? '';
    this.#pdf.invoice({
      title: 'Facture',
      number: `TX-${sale.id}`,
      date: sale.sale_date,
      client: sale.client?.name ?? '',
      clientPhone: sale.client?.phone1,
      currency: sale.currency,
      status: sale.status === 'PAYE_TOTAL' ? 'PAYE' : sale.status === 'PAYE_PARTIEL' ? 'PARTIEL' : 'IMPAYE',
      items: [
        {
          designation: `Balles de textile — conteneur ${container}`,
          unit: 'Balle',
          quantity: formatNumber(sale.quantity_sold),
          unitPrice: formatMoney(this.unitPrice(sale), sale.currency),
          total: formatMoney(sale.sale_price, sale.currency),
        },
      ],
      totals: [
        { label: 'Total', value: formatMoney(sale.sale_price, sale.currency), strong: true },
        ...(sale.currency !== 'GNF' ? [{ label: 'Taux de la vente', value: `1 ${sale.currency} = ${formatNumber(sale.exchange_rate)} GNF` }] : []),
        { label: 'Déjà payé', value: formatMoney(sale.amount_paid, sale.currency) },
        { label: 'Reste à payer', value: formatMoney(sale.remaining_amount, sale.currency), strong: true },
      ],
      note: sale.notes,
    });
  }
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly sales = signal<Sale[]>([]);
  protected readonly arrivals = signal<Arrival[]>([]);
  protected readonly clients = signal<Client[]>([]);
  readonly #rates = signal<Record<string, number>>({});

  protected readonly statusFilter = signal('');
  protected readonly search = signal('');
  protected readonly visibleSales = computed(() => {
    const status = this.statusFilter();
    const term = this.search().trim().toLowerCase();
    return this.sales().filter(
      (sale) =>
        (!status || sale.status === status) &&
        (!term || `${sale.client?.name ?? ''} ${sale.container_arrival?.container?.container_number ?? ''}`.toLowerCase().includes(term)),
    );
  });
  protected readonly pager = paginate(this.visibleSales);
  /** Seuls les arrivages qui ont encore des balles peuvent être vendus. */
  protected readonly sellable = computed(() => this.arrivals().filter((arrival) => arrival.remaining_quantity > 0));

  protected readonly creating = signal(false);
  protected readonly cancelling = signal<Sale | null>(null);
  /** Vente dont on corrige le prix par balle. */
  protected readonly repricing = signal<Sale | null>(null);
  protected readonly newUnitPrice = signal<number | null>(null);
  protected readonly newTotal = computed(() => (Number(this.newUnitPrice()) || 0) * (this.repricing()?.quantity_sold ?? 0));
  protected readonly form = this.#fb.group({
    arrival_id: [null as number | null, Validators.required],
    client_id: [null as number | null],
    new_client: [false],
    client_name: [''],
    client_phone: [''],
    quantity: [null as number | null, [Validators.required, Validators.min(1)]],
    unit_price: [null as number | null, [Validators.required, Validators.min(0)]],
    currency: ['GNF'],
    rate: [null as number | null],
    sale_date: [today(), Validators.required],
    notes: [''],
  });
  readonly #value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly arrival = computed(() => this.arrivals().find((a) => a.id === this.#value().arrival_id));
  protected readonly total = computed(() => (Number(this.#value().quantity) || 0) * (Number(this.#value().unit_price) || 0));
  protected readonly foreign = computed(() => (this.#value().currency === 'GNF' ? null : this.#value().currency!));
  protected readonly totalGnf = computed(() => Math.round(this.total() * (Number(this.#value().rate) || 0)));
  protected readonly newClient = computed(() => !!this.#value().new_client);

  constructor() {
    this.load();
    this.#api.rates().subscribe({ next: (rates) => this.#rates.set(rates), error: () => undefined });
    this.form.controls.currency.valueChanges.subscribe((currency) =>
      this.form.controls.rate.setValue(currency === 'GNF' ? null : (this.#rates()[currency] ?? null)),
    );
  }

  protected load(): void {
    forkJoin([this.#api.sales(), this.#api.arrivals(), this.#api.clients()]).subscribe({
      next: ([sales, arrivals, clients]) => {
        this.sales.set(sales);
        this.arrivals.set(arrivals);
        this.clients.set(clients);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.#toast.error(apiError(error, 'Les ventes n\'ont pas pu être chargées.'));
      },
    });
  }

  protected unitPrice(sale: Sale): number {
    return sale.quantity_sold ? Number(sale.sale_price) / sale.quantity_sold : 0;
  }

  protected open(): void {
    const only = this.sellable().length === 1 ? this.sellable()[0].id : null;
    this.form.reset({ arrival_id: only, currency: 'GNF', sale_date: today() });
    this.creating.set(true);
  }

  protected save(): void {
    const value = this.form.getRawValue();
    const arrival = this.arrival();
    if (this.form.invalid || !arrival || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    if (value.new_client ? !value.client_name.trim() : !value.client_id) {
      this.#toast.error(value.new_client ? 'Saisissez le nom du nouveau client.' : 'Choisissez le client.');
      return;
    }
    if (Number(value.quantity) > arrival.remaining_quantity) {
      this.#toast.error(`Il ne reste que ${arrival.remaining_quantity} balle(s) sur ce conteneur.`);
      return;
    }
    if (this.foreign() && !(Number(value.rate) > 1)) {
      this.#toast.error(`Saisissez le taux du jour : 1 ${this.foreign()} en GNF.`);
      return;
    }

    this.saving.set(true);
    const client$ = value.new_client
      ? this.#api.createClient(value.client_name.trim(), value.client_phone.trim())
      : of({ id: value.client_id! });

    client$
      .pipe(
        switchMap((client) =>
          this.#api.createSale({
            container_arrival_id: arrival.id,
            client_id: client.id,
            sale_type: 'BALLE',
            quantity_sold: value.quantity,
            sale_price: this.total(),
            currency: value.currency,
            exchange_rate: this.foreign() ? value.rate : null,
            sale_date: value.sale_date,
            notes: value.notes || null,
          }),
        ),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.creating.set(false);
          this.#toast.success('Vente enregistrée et portée au compte du client.');
          this.load();
        },
        error: (error) => {
          this.saving.set(false);
          this.#toast.error(apiError(error));
          this.load();
        },
      });
  }

  protected openReprice(sale: Sale): void {
    this.newUnitPrice.set(this.unitPrice(sale));
    this.repricing.set(sale);
  }

  protected saveReprice(): void {
    const sale = this.repricing();
    if (!sale || this.saving()) {
      return;
    }
    if (!(this.newTotal() > 0)) {
      this.#toast.error('Saisissez le prix par balle.');
      return;
    }
    if (this.newTotal() < Number(sale.amount_paid) - 0.01) {
      this.#toast.error('Le nouveau total serait inférieur à ce que le client a déjà payé.');
      return;
    }
    this.saving.set(true);
    this.#api.updateSalePrice(sale.id, this.newTotal()).subscribe({
      next: () => {
        this.saving.set(false);
        this.repricing.set(null);
        this.#toast.success('Prix corrigé : le compte du client est à jour.');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }

  protected confirmCancel(): void {
    const sale = this.cancelling();
    if (!sale || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.#api.cancelSale(sale.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.cancelling.set(null);
        this.#toast.success('Vente annulée : les balles sont remises en stock.');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }
}
