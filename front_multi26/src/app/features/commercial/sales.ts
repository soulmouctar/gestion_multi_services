import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { Avatar } from '../../shared/avatar';
import { apiError, DayPipe, formatMoney, formatNumber, MoneyPipe, NumberPipe, today } from '../../shared/format';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { PdfService } from '../../shared/pdf.service';
import { Pager, paginate } from '../../shared/pager';
import { ToastService } from '../../shared/toast.service';
import { Client, convert, CURRENCIES, rateCurrency, TextileApi } from '../textile/textile.api';
import { CommercialApi, FamilyKey, Invoice, Product } from './commercial.api';
import { FamilyTabs } from './family-tabs';
import { ButtonIcon } from '../../shared/button-icon';

type Unit = 'UNITE' | 'DEMI_CARTON' | 'CARTON';

interface Line {
  product: Product;
  /** Vente à la pièce, au demi-carton ou au carton entier. */
  unit: Unit;
  quantity: number;
  unitPrice: number;
  /** Pièces prises sur le stock avarié, vendues à prix libre. */
  damaged: boolean;
}

const STATUS: Record<Invoice['status'], { label: string; tone: string }> = {
  IMPAYE: { label: 'Non payée', tone: 'is-warning' },
  PARTIEL: { label: 'Payée en partie', tone: 'is-info' },
  PAYE: { label: 'Soldée', tone: 'is-success' },
};

/** Ventes de pneus et de cosmétique : on choisit la famille, puis les produits. */
@Component({
  selector: 'app-commercial-sales',
  imports: [ReactiveFormsModule, PageHeader, Modal, FamilyTabs, MoneyPipe, NumberPipe, DayPipe, Pager, ButtonIcon, Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales.html',
  styleUrl: './sales.scss',
})
export class Sales {
  readonly #api = inject(CommercialApi);
  readonly #toast = inject(ToastService);

  protected readonly currencies = CURRENCIES;
  protected readonly statuses = STATUS;
  readonly #pdf = inject(PdfService);

  /** Facture imprimable d'une vente : ses lignes, puis ce qui est payé et ce qu'il reste. */
  protected printInvoice(invoice: Invoice): void {
    const units: Record<string, string> = { UNITE: 'Pièce', CARTON: 'Carton', DEMI_CARTON: 'Demi-carton', DOUZAINE: 'Douzaine' };
    this.#pdf.invoice({
      title: invoice.items.length ? 'Facture' : 'Solde d\'ouverture',
      number: invoice.invoice_number,
      date: invoice.created_at,
      client: invoice.client?.name ?? 'Vente au comptant',
      currency: invoice.currency,
      status: invoice.status,
      items: invoice.items.length
        ? invoice.items.map((item) => ({
            designation: item.description,
            unit: units[item.sale_type] ?? item.sale_type,
            quantity: formatNumber(item.quantity),
            unitPrice: formatMoney(item.unit_price, invoice.currency),
            total: formatMoney(item.line_total, invoice.currency),
          }))
        : [{ designation: invoice.notes || 'Solde repris à l\'ouverture du compte', unit: '—', quantity: '—', unitPrice: '—', total: formatMoney(invoice.total_amount, invoice.currency) }],
      totals: [
        { label: 'Total', value: formatMoney(invoice.total_amount, invoice.currency), strong: true },
        { label: 'Déjà payé', value: formatMoney(invoice.paid_amount, invoice.currency) },
        { label: 'Reste à payer', value: formatMoney(invoice.remaining_balance, invoice.currency), strong: true },
      ],
      note: invoice.items.length ? invoice.notes : null,
    });
  }
  protected readonly families = toSignal(this.#api.families$, { initialValue: [] });
  readonly #rates = toSignal(inject(TextileApi).rates(), { initialValue: {} as Record<string, number> });

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  readonly #invoices = signal<Invoice[]>([]);
  /** Ventes réelles, ou soldes repris à l'ouverture des comptes (factures sans ligne). */
  protected readonly view = signal<'ventes' | 'ouvertures'>('ventes');
  protected readonly listSearch = signal('');
  protected readonly statusFilter = signal('');
  protected readonly invoices = computed(() => {
    const opening = this.view() === 'ouvertures';
    // Dans le menu d'une famille, seules ses ventes sont listées
    const ids = this.lockedFamily() ? new Set(this.#products().map((product) => product.id)) : null;
    return this.#invoices().filter((invoice) => {
      const items = invoice.items ?? [];
      const term = this.listSearch().trim().toLowerCase();
      if (term && !`${invoice.client?.name ?? 'comptant'} ${invoice.invoice_number}`.toLowerCase().includes(term)) {
        return false;
      }
      if (this.statusFilter() && invoice.status !== this.statusFilter()) {
        return false;
      }
      if (opening || !items.length) {
        return opening === !items.length;
      }
      return !ids || items.some((item) => item.product_id !== null && ids.has(item.product_id));
    });
  });
  protected readonly pager = paginate(this.invoices);
  protected readonly openingCount = computed(() => this.#invoices().filter((invoice) => !invoice.items?.length).length);
  protected readonly clients = signal<Client[]>([]);

  // --- Nouvelle vente -------------------------------------------------------
  protected readonly creating = signal(false);
  /** Famille imposée par la route (menu Pneus ou Cosmétique) : l'écran n'en propose alors pas d'autre. */
  readonly lockedFamily = input<FamilyKey | undefined>(undefined, { alias: 'family' });
  protected readonly familyKey = signal<FamilyKey>('pneus');
  protected readonly family = computed(() => this.families().find((family) => family.key === this.familyKey()));
  protected readonly search = signal('');
  readonly #products = signal<Product[]>([]);
  protected readonly matches = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.#products()
      .filter((product) => !term || product.name.toLowerCase().includes(term))
      .slice(0, 8);
  });
  protected readonly lines = signal<Line[]>([]);
  protected readonly total = computed(() => this.lines().reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));

  protected readonly form = inject(FormBuilder).nonNullable.group({
    client_id: [null as number | null],
    currency: ['GNF'],
    rate: [null as number | null, Validators.min(1)],
    notes: [''],
  });
  readonly #value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly currency = computed(() => this.#value().currency ?? 'GNF');
  protected readonly foreign = computed(() => (this.currency() === 'GNF' ? null : this.currency()));

  // --- Encaissement d'une vente ---------------------------------------------
  protected readonly methods = [
    { value: 'ESPECES', label: 'Espèces' },
    { value: 'VIREMENT', label: 'Virement' },
    { value: 'CHEQUE', label: 'Chèque' },
    { value: 'ORANGE_MONEY', label: 'Orange Money' },
    { value: 'MTN_MONEY', label: 'MTN Money' },
    { value: 'WAVE', label: 'Wave' },
  ];
  protected readonly paying = signal<Invoice | null>(null);
  protected readonly cancelling = signal<Invoice | null>(null);
  protected readonly payForm = inject(FormBuilder).nonNullable.group({
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    currency: ['GNF'],
    rate: [null as number | null],
    payment_date: [today(), Validators.required],
    method: ['ESPECES'],
    reference: [''],
  });
  readonly #pay = toSignal(this.payForm.valueChanges, { initialValue: this.payForm.getRawValue() });
  /** Devise dont le taux du jour est demandé quand la devise versée diffère de celle de la vente. */
  protected readonly payRateFor = computed(() => {
    const invoice = this.paying();
    return invoice ? rateCurrency(this.#pay().currency ?? 'GNF', invoice.currency) : null;
  });
  protected readonly payCredited = computed(() => {
    const invoice = this.paying();
    return invoice ? convert(Number(this.#pay().amount) || 0, this.#pay().currency ?? 'GNF', invoice.currency, Number(this.#pay().rate) || 0) : 0;
  });
  protected readonly payRemaining = computed(() => (Number(this.paying()?.remaining_balance) || 0) - this.payCredited());

  constructor() {
    effect(() => {
      const locked = this.lockedFamily();
      if (locked) {
        this.familyKey.set(locked);
      }
    });
    this.payForm.controls.currency.valueChanges.subscribe(() =>
      queueMicrotask(() => {
        const foreign = this.payRateFor();
        this.payForm.controls.rate.setValue(foreign ? (this.#rates()[foreign] ?? null) : null);
      }),
    );
    this.load();
    this.#api.clients().subscribe({ next: (clients) => this.clients.set(clients), error: () => undefined });
    // Les produits proposés suivent la famille choisie ; une vente ne mélange pas les familles
    effect(() => {
      const family = this.family();
      this.creating();
      if (!family) {
        return;
      }
      this.lines.set([]);
      this.search.set('');
      if (!family.categoryId) {
        this.#products.set([]);
        return;
      }
      this.#api.products(family.categoryId).subscribe({ next: (products) => this.#products.set(products), error: () => this.#products.set([]) });
    });
    this.form.controls.currency.valueChanges.subscribe((currency) =>
      this.form.controls.rate.setValue(currency === 'GNF' ? null : (this.#rates()[currency] ?? null)),
    );
  }

  protected load(): void {
    forkJoin([this.#api.invoices()]).subscribe({
      next: ([invoices]) => {
        this.#invoices.set(invoices);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.#toast.error(apiError(error, 'Les ventes n\'ont pas pu être chargées.'));
      },
    });
  }

  protected summary(invoice: Invoice): string {
    // Une facture sans ligne est un solde repris à l'ouverture du compte
    if (!invoice.items?.length) {
      return invoice.notes || 'Solde d\'ouverture';
    }
    const first = invoice.items[0].description;
    const more = (invoice.items?.length ?? 0) - 1;
    return more > 0 ? `${first} + ${more} autre(s)` : first;
  }

  protected openPayment(invoice: Invoice): void {
    this.paying.set(invoice);
    this.payForm.reset({ amount: Number(invoice.remaining_balance) || null, currency: invoice.currency, payment_date: today(), method: 'ESPECES' });
  }

  protected savePayment(): void {
    const invoice = this.paying();
    const value = this.payForm.getRawValue();
    const rateFor = this.payRateFor();
    if (!invoice?.client || this.payForm.invalid || this.saving()) {
      this.payForm.markAllAsTouched();
      return;
    }
    if (rateFor === undefined) {
      this.#toast.error('La conversion directe entre deux devises étrangères n\'est pas gérée : passez par le GNF.');
      return;
    }
    if (rateFor && !(Number(value.rate) > 1)) {
      this.#toast.error(`Saisissez le taux du jour : 1 ${rateFor} en GNF.`);
      return;
    }
    if (this.payRemaining() < -0.01) {
      this.#toast.error('Le montant dépasse le reste à payer de cette vente.');
      return;
    }

    this.saving.set(true);
    this.#api
      .payInvoice({
        client_id: invoice.client.id,
        invoice_id: invoice.id,
        amount: value.amount,
        currency: value.currency,
        target_currency: invoice.currency,
        exchange_rate: rateFor ? value.rate : null,
        payment_date: value.payment_date,
        method: value.method,
        reference: value.reference || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.paying.set(null);
          this.#toast.success('Encaissement enregistré au compte du client.');
          this.load();
        },
        error: (error) => {
          this.saving.set(false);
          this.#toast.error(apiError(error));
        },
      });
  }

  protected confirmCancel(): void {
    const invoice = this.cancelling();
    if (!invoice || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.#api.cancelInvoice(invoice.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.cancelling.set(null);
        this.#toast.success('Vente annulée : les produits sont remis en stock.');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }

  protected open(): void {
    this.form.reset({ currency: 'GNF' });
    this.lines.set([]);
    this.creating.set(true);
  }

  protected add(product: Product): void {
    // Un produit sans stock sain mais avec des avariés se vend d'office en avarié
    const damaged = product.stock_quantity <= 0 && product.damaged_quantity > 0;
    this.lines.update((lines) => [...lines, { product, unit: 'UNITE', quantity: 1, unitPrice: this.#listPrice(product, 'UNITE', damaged), damaged }]);
    this.search.set('');
  }

  protected patch(index: number, change: Partial<Line>): void {
    this.lines.update((lines) =>
      lines.map((line, position) => {
        if (position !== index) {
          return line;
        }
        const next = { ...line, ...change };
        // Changer d'unité ou d'état repropose le prix correspondant
        if (change.unit !== undefined || change.damaged !== undefined) {
          next.unitPrice = this.#listPrice(next.product, next.unit, next.damaged);
        }
        return next;
      }),
    );
  }

  /** Pièces par unité de vente : un demi-carton de 48 sort 24 pièces. */
  protected factor(line: Pick<Line, 'product' | 'unit'>): number {
    const perCarton = Math.max(1, Number(line.product.units_per_carton) || 1);
    return line.unit === 'CARTON' ? perCarton : line.unit === 'DEMI_CARTON' ? perCarton / 2 : 1;
  }

  /** Vrai quand la ligne est vendue sous le prix d'achat : le cas d'un produit avarié qu'on brade. */
  protected belowCost(line: Line): boolean {
    const cost = Number(line.product.purchase_price) || 0;
    return this.currency() === 'GNF' && cost > 0 && line.unitPrice > 0 && line.unitPrice / this.factor(line) < cost;
  }

  /** Stock où la ligne puise : sain ou avarié. */
  protected available(line: Line): number {
    return line.damaged ? line.product.damaged_quantity : line.product.stock_quantity;
  }

  /**
   * Prix du catalogue, en GNF seulement : il n'est proposé ni pour une vente en devise,
   * ni pour de l'avarié, dont le prix se discute à chaque vente.
   */
  #listPrice(product: Product, unit: Unit, damaged: boolean): number {
    if (damaged || this.currency() !== 'GNF') {
      return 0;
    }
    const carton = Number(product.carton_selling_price) || 0;
    return unit === 'CARTON' ? carton : unit === 'DEMI_CARTON' ? carton / 2 : Number(product.selling_price) || 0;
  }

  protected remove(index: number): void {
    this.lines.update((lines) => lines.filter((_, position) => position !== index));
  }

  /** Pièces que la ligne sort du stock. */
  protected pieces(line: Line): number {
    return Math.ceil(line.quantity * this.factor(line));
  }

  protected save(): void {
    const value = this.form.getRawValue();
    const lines = this.lines();
    if (this.saving()) {
      return;
    }
    if (!lines.length) {
      this.#toast.error('Ajoutez au moins un produit à la vente.');
      return;
    }
    const invalid = lines.find((line) => !(line.quantity > 0) || line.unitPrice < 0);
    if (invalid) {
      this.#toast.error(`Vérifiez la quantité et le prix de ${invalid.product.name}.`);
      return;
    }
    const unpriced = lines.find((line) => !(line.unitPrice > 0));
    if (unpriced) {
      this.#toast.error(`Saisissez le prix de ${unpriced.product.name}.`);
      return;
    }
    // Plusieurs lignes peuvent puiser dans le même stock : on compare leur total au disponible
    const short = lines.find((line) => {
      const taken = lines.filter((other) => other.product.id === line.product.id && other.damaged === line.damaged).reduce((sum, other) => sum + this.pieces(other), 0);
      return taken > this.available(line);
    });
    if (short) {
      this.#toast.error(`Stock ${short.damaged ? 'avarié ' : ''}insuffisant pour ${short.product.name} : ${this.available(short)} pièce(s) disponible(s).`);
      return;
    }
    if (this.foreign() && !(Number(value.rate) > 1)) {
      this.#toast.error(`Saisissez le taux du jour : 1 ${this.foreign()} en GNF.`);
      return;
    }

    this.saving.set(true);
    this.#api
      .createInvoice({
        client_id: value.client_id,
        currency: value.currency,
        exchange_rate: this.foreign() ? value.rate : null,
        notes: value.notes || null,
        // La vente porte son seul montant ; la dette antérieure reste sur le compte du client
        include_previous_balance: false,
        // Sans client, la vente est au comptant : elle est réglée sur place
        status: value.client_id ? 'IMPAYE' : 'PAYE',
        line_items: lines.map((line) => ({
          product_id: line.product.id,
          description: line.product.name + (line.damaged ? ' (avarié)' : ''),
          sale_type: line.unit,
          from_damaged: line.damaged,
          quantity: line.quantity,
          unit_price: line.unitPrice,
        })),
      })
      .subscribe({
        next: (invoice) => {
          this.saving.set(false);
          this.creating.set(false);
          this.#toast.success(`Vente ${invoice.invoice_number} enregistrée : le stock est à jour.`);
          this.load();
        },
        error: (error) => {
          this.saving.set(false);
          this.#toast.error(apiError(error));
        },
      });
  }
}
