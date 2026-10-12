import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { Avatar } from '../../shared/avatar';
import { apiError, DayPipe, formatMoney, formatNumber, MoneyPipe, NumberPipe, today } from '../../shared/format';
import { compressImage } from '../../shared/image-compression';
import { Receipt, ReceiptLine } from '../../shared/receipt';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { PdfService } from '../../shared/pdf.service';
import { Pager, paginate } from '../../shared/pager';
import { ToastService } from '../../shared/toast.service';
import { convert, CURRENCIES, PAYMENT_METHODS, rateCurrency, TextileApi } from '../textile/textile.api';
import { CommercialApi, Product, Purchase, SupplierBalance, SupplierHistory } from './commercial.api';
import { ButtonIcon } from '../../shared/button-icon';

/** Fournisseurs : produits pris chez eux, paiements versés, solde par devise. */
@Component({
  selector: 'app-commercial-suppliers',
  imports: [ReactiveFormsModule, PageHeader, Modal, Receipt, Avatar, MoneyPipe, NumberPipe, DayPipe, Pager, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suppliers.html',
})
export class Suppliers {
  readonly #api = inject(CommercialApi);
  readonly #toast = inject(ToastService);
  readonly #fb = inject(FormBuilder).nonNullable;

  protected readonly currencies = CURRENCIES;
  protected readonly methods = PAYMENT_METHODS;
  protected readonly families = toSignal(this.#api.families$, { initialValue: [] });
  readonly #rates = toSignal(inject(TextileApi).rates(), { initialValue: {} as Record<string, number> });

  readonly #pdf = inject(PdfService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly suppliers = signal<SupplierBalance[]>([]);

  protected readonly search = signal('');
  protected readonly visibleSuppliers = computed(() => {
    const term = this.search().trim().toLowerCase();
    const category = this.categoryFilter();
    return this.suppliers().filter(
      (supplier) =>
        (!term || `${supplier.name} ${supplier.phone1 ?? ''}`.toLowerCase().includes(term)) && (!category || (supplier.category ?? '') === category),
    );
  });
  /** Activité du fournisseur ; vide pour toutes. */
  protected readonly categoryFilter = signal('');
  protected readonly categories = computed(() => [...new Set(this.suppliers().map((supplier) => supplier.category ?? '').filter(Boolean))].sort());
  protected readonly deleting = signal<SupplierBalance | null>(null);

  protected confirmDelete(): void {
    const supplier = this.deleting();
    if (!supplier || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.#api.deleteSupplier(supplier.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.deleting.set(null);
        this.#toast.success(`${supplier.name} est dans la corbeille.`);
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }
  protected readonly pager = paginate(this.visibleSuppliers);
  /** Devises présentes dans les comptes des fournisseurs, le GNF en premier. */
  protected readonly listCurrencies = computed(() => {
    const codes = new Set<string>(['GNF']);
    for (const supplier of this.suppliers()) {
      Object.keys(supplier.by_currency ?? {}).forEach((code) => codes.add(code));
    }
    return [...codes].sort((a, b) => (a === 'GNF' ? -1 : b === 'GNF' ? 1 : a.localeCompare(b)));
  });
  /** Ce que nous devons par devise : seuls les soldes positifs comptent, une avance à l'un ne réduit pas la dette envers un autre. */
  protected readonly listTotals = computed(() =>
    this.listCurrencies().map((currency) => ({
      currency,
      due: this.suppliers().reduce((sum, supplier) => sum + Math.max(0, this.total(supplier, currency, 'final_balance')), 0),
      advance: this.suppliers().reduce((sum, supplier) => sum + Math.max(0, -this.total(supplier, currency, 'final_balance')), 0),
    })),
  );

  protected total(supplier: SupplierBalance, currency: string, field: 'total_debit' | 'total_credit' | 'final_balance'): number {
    return Number(supplier.by_currency?.[currency]?.[field]) || 0;
  }

  /**
   * Relevé du fournisseur ouvert : produits pris au débit, paiements au crédit,
   * dans l'ordre des dates, avec le solde de chaque devise après chaque ligne.
   */
  protected readonly statement = computed(() => {
    const history = this.history();
    if (!history) {
      return [];
    }
    const entries = [
      ...this.purchases()
        .filter((purchase) => Number(purchase.total_amount) > 0)
        .map((purchase) => ({
        date: purchase.purchase_date.slice(0, 10),
        label: `${purchase.designation} — ${formatNumber(purchase.quantity)} × ${formatMoney(purchase.unit_price, purchase.currency)}`,
        reference: purchase.purchase_number,
        currency: purchase.currency,
        debit: Number(purchase.total_amount) || 0,
        credit: 0,
        rate: purchase.currency !== 'GNF' ? Number(purchase.exchange_rate) : 0,
        order: 0,
      })),
      ...history.arrivals.map((arrival) => ({
        date: arrival.arrival_date.slice(0, 10),
        label: `Conteneur ${arrival.container_number ?? ''} — ${formatNumber(arrival.total_quantity)} balles`,
        reference: 'Arrivage textile',
        currency: arrival.currency,
        debit: Number(arrival.purchase_price) || 0,
        credit: 0,
        rate: 0,
        order: 0,
      })),
      ...history.payments.map((payment) => ({
        date: payment.date.slice(0, 10),
        label:
          payment.currency !== payment.target_currency
            ? `Paiement de ${formatMoney(payment.amount, payment.currency)} converti`
            : `Paiement — ${this.methodLabel(payment.payment_method)}`,
        reference: payment.reference ?? '',
        currency: payment.target_currency,
        debit: 0,
        credit: Number(payment.converted_amount) || 0,
        rate: payment.currency !== payment.target_currency ? Number(payment.exchange_rate) : 0,
        order: 1,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);

    const balances = new Map<string, number>();
    return entries.map((entry) => {
      const balance = (balances.get(entry.currency) ?? 0) + entry.debit - entry.credit;
      balances.set(entry.currency, balance);
      return { ...entry, balance };
    });
  });

  /** Relevé imprimable du fournisseur ouvert : un tableau par devise. */
  protected printStatement(): void {
    const supplier = this.selected();
    const history = this.history();
    if (!supplier || !history) {
      return;
    }
    const day = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
    this.#pdf.tables(
      `Relevé de compte fournisseur — ${supplier.name}`,
      supplier.phone1 ?? '',
      history.summary.currencies.map((currency) => {
        const totals = history.summary.by_currency[currency];
        return {
          title: `Compte ${currency}`,
          subtitle: totals.final_balance < 0 ? `Avance versée : ${formatMoney(-totals.final_balance, currency)}` : `Reste à payer : ${formatMoney(totals.final_balance, currency)}`,
          columns: [
            { header: 'Date', width: 58 },
            { header: 'Opération' },
            { header: 'Taux', align: 'right' as const },
            { header: 'Pris (débit)', align: 'right' as const },
            { header: 'Payé (crédit)', align: 'right' as const },
            { header: 'Solde', align: 'right' as const },
          ],
          rows: this.statement()
            .filter((row) => row.currency === currency)
            .map((row) => [day(row.date), [row.label, row.reference].filter(Boolean).join(' — '), row.rate > 1 ? formatNumber(row.rate) : '', row.debit ? formatNumber(row.debit) : '', row.credit ? formatNumber(row.credit) : '', formatNumber(row.balance)]),
          totals: [['', 'Totaux', '', formatNumber(totals.total_debit), formatNumber(totals.total_credit), formatNumber(totals.final_balance)]],
        };
      }),
    );
  }

  /** Situation de tous les fournisseurs affichés, compte par compte. */
  protected printList(): void {
    const currencies = this.listCurrencies();
    this.#pdf.table({
      title: 'Situation des fournisseurs',
      subtitle: 'Solde positif : nous devons. Solde négatif : avance versée.',
      landscape: currencies.length > 1,
      facts: this.listTotals().map((line) => ({ label: `Nous devons en ${line.currency}`, value: formatMoney(line.due, line.currency) })),
      columns: [{ header: 'Fournisseur' }, { header: 'Téléphone', width: 80 }, ...currencies.flatMap((currency) => [{ header: `Pris ${currency}`, align: 'right' as const }, { header: `Payé ${currency}`, align: 'right' as const }, { header: `Solde ${currency}`, align: 'right' as const }])],
      rows: this.visibleSuppliers().map((supplier) => [
        supplier.name,
        supplier.phone1 ?? '',
        ...currencies.flatMap((currency) => [formatNumber(this.total(supplier, currency, 'total_debit')), formatNumber(this.total(supplier, currency, 'total_credit')), formatNumber(this.total(supplier, currency, 'final_balance'))]),
      ]),
    });
  }

  // --- Fournisseur ouvert ---------------------------------------------------
  protected readonly selected = signal<SupplierBalance | null>(null);
  protected readonly history = signal<SupplierHistory | null>(null);
  protected readonly purchases = signal<Purchase[]>([]);
  protected readonly accountCurrencies = computed(() => this.history()?.summary.currencies ?? []);

  // --- Nouveau fournisseur --------------------------------------------------
  protected readonly creating = signal(false);
  protected readonly supplierForm = this.#fb.group({ name: ['', Validators.required], phone: [''] });

  // --- Produit pris ---------------------------------------------------------
  protected readonly buying = signal(false);
  protected readonly familyProducts = signal<Product[]>([]);
  protected readonly purchaseForm = this.#fb.group({
    family: ['pneus'],
    product_id: [null as number | null],
    designation: [''],
    unit: ['piece'],
    quantity: [null as number | null, [Validators.required, Validators.min(0.01)]],
    unit_price: [null as number | null, [Validators.required, Validators.min(0)]],
    currency: ['GNF'],
    rate: [null as number | null],
    purchase_date: [today(), Validators.required],
    reference: [''],
  });
  readonly #purchase = toSignal(this.purchaseForm.valueChanges, { initialValue: this.purchaseForm.getRawValue() });
  protected readonly purchaseProduct = computed(() => this.familyProducts().find((p) => p.id === this.#purchase().product_id));
  /** Pièces par carton du produit choisi ; 1 si le produit ne se compte pas en cartons. */
  protected readonly perCarton = computed(() => Math.max(1, Number(this.purchaseProduct()?.units_per_carton) || 1));
  protected readonly byCarton = computed(() => this.perCarton() > 1 && this.#purchase().unit === 'carton');
  protected readonly purchasePieces = computed(() => (Number(this.#purchase().quantity) || 0) * (this.byCarton() ? this.perCarton() : 1));
  protected readonly purchaseTotal = computed(() => (Number(this.#purchase().quantity) || 0) * (Number(this.#purchase().unit_price) || 0));
  protected readonly purchaseForeign = computed(() => (this.#purchase().currency === 'GNF' ? null : this.#purchase().currency!));

  // --- Paiement -------------------------------------------------------------
  protected readonly paying = signal(false);
  protected readonly paymentForm = this.#fb.group({
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    currency: ['GNF'],
    target_currency: ['GNF'],
    rate: [null as number | null],
    payment_date: [today(), Validators.required],
    payment_method: ['ESPECES'],
    reference: [''],
  });
  readonly #payment = toSignal(this.paymentForm.valueChanges, { initialValue: this.paymentForm.getRawValue() });
  /** Devise dont le taux est demandé : dès qu'une devise étrangère est en jeu. */
  protected readonly paymentRateFor = computed(() => {
    const { currency = 'GNF', target_currency = 'GNF' } = this.#payment();
    const foreign = rateCurrency(currency, target_currency);
    return foreign === null ? (currency === 'GNF' ? null : currency) : foreign;
  });
  protected readonly paymentConverted = computed(() => {
    const { amount, currency = 'GNF', target_currency = 'GNF', rate } = this.#payment();
    return convert(Number(amount) || 0, currency, target_currency, Number(rate) || 0);
  });
  protected readonly paymentConverts = computed(() => this.#payment().currency !== this.#payment().target_currency);

  constructor() {
    this.load();
    this.purchaseForm.controls.family.valueChanges.subscribe((key) => this.#loadFamilyProducts(key));
    this.purchaseForm.controls.currency.valueChanges.subscribe((currency) =>
      this.purchaseForm.controls.rate.setValue(currency === 'GNF' ? null : (this.#rates()[currency] ?? null)),
    );
    const suggest = () =>
      queueMicrotask(() => {
        const foreign = this.paymentRateFor();
        this.paymentForm.controls.rate.setValue(foreign ? (this.#rates()[foreign] ?? null) : null);
      });
    this.paymentForm.controls.currency.valueChanges.subscribe(suggest);
    this.paymentForm.controls.target_currency.valueChanges.subscribe(suggest);
  }

  protected load(): void {
    this.#api.suppliers().subscribe({
      next: (suppliers) => {
        this.suppliers.set(suppliers);
        this.loading.set(false);
        // Garde le fournisseur ouvert à jour après une écriture
        const open = this.selected();
        if (open) {
          this.selected.set(suppliers.find((supplier) => supplier.id === open.id) ?? open);
        }
      },
      error: (error) => {
        this.loading.set(false);
        this.#toast.error(apiError(error, 'Les fournisseurs n\'ont pas pu être chargés.'));
      },
    });
  }

  protected balances(supplier: SupplierBalance): { currency: string; balance: number }[] {
    return Object.entries(supplier.by_currency ?? {})
      .map(([currency, totals]) => ({ currency, balance: Number(totals.final_balance) || 0 }))
      .filter((line) => line.balance !== 0);
  }

  protected open(supplier: SupplierBalance): void {
    this.selected.set(supplier);
    this.history.set(null);
    this.purchases.set([]);
    this.#loadDetail();
  }

  protected async setPhoto(supplier: SupplierBalance, input: HTMLInputElement): Promise<void> {
    const picked = input.files?.[0];
    input.value = '';
    if (!picked) {
      return;
    }
    const photo = await compressImage(picked);
    this.#api.uploadPhoto(`suppliers/${supplier.id}/photo`, 'photo', photo).subscribe({
      next: () => {
        this.#toast.success(`Photo de ${supplier.name} enregistrée.`);
        this.#loadDetail();
      },
      error: (error) => this.#toast.error(apiError(error)),
    });
  }

  protected saveSupplier(): void {
    if (this.supplierForm.invalid || this.saving()) {
      this.supplierForm.markAllAsTouched();
      return;
    }
    const { name, phone } = this.supplierForm.getRawValue();
    this.saving.set(true);
    this.#api.createSupplier(name.trim(), phone.trim()).subscribe({
      next: () => {
        this.saving.set(false);
        this.creating.set(false);
        this.#toast.success('Fournisseur ajouté.');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }

  protected openPurchase(): void {
    this.purchaseForm.reset({ family: 'pneus', unit: 'piece', currency: 'GNF', purchase_date: today() });
    this.#loadFamilyProducts('pneus');
    this.buying.set(true);
  }

  protected savePurchase(): void {
    const supplier = this.selected();
    const value = this.purchaseForm.getRawValue();
    const product = this.purchaseProduct();
    if (!supplier || this.purchaseForm.invalid || this.saving()) {
      this.purchaseForm.markAllAsTouched();
      return;
    }
    if (!product && !value.designation.trim()) {
      this.#toast.error('Choisissez un produit du catalogue ou saisissez une désignation.');
      return;
    }
    if (this.purchaseForeign() && !(Number(value.rate) > 1)) {
      this.#toast.error(`Saisissez le taux du jour : 1 ${this.purchaseForeign()} en GNF.`);
      return;
    }
    const family = this.families().find((item) => item.key === value.family);
    const pieces = this.purchasePieces();

    this.saving.set(true);
    this.#api
      .createPurchase(supplier.id, {
        designation: product?.name ?? value.designation.trim(),
        category: family?.purchaseCategory ?? 'AUTRE',
        product_category_id: family?.categoryId ?? null,
        product_id: product?.id ?? null,
        // Le stock est tenu à la pièce : un achat au carton est enregistré en pièces
        quantity: pieces,
        unit_price: pieces ? this.purchaseTotal() / pieces : 0,
        currency: value.currency,
        exchange_rate: this.purchaseForeign() ? value.rate : null,
        purchase_date: value.purchase_date,
        reference: value.reference || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.buying.set(false);
          this.#toast.success(product ? 'Achat enregistré : la dette et le stock sont à jour.' : 'Achat enregistré : la dette est à jour.');
          this.#refresh();
        },
        error: (error) => {
          this.saving.set(false);
          this.#toast.error(apiError(error));
        },
      });
  }

  protected deletePurchase(purchase: Purchase): void {
    this.#api.deletePurchase(purchase.id).subscribe({
      next: () => {
        this.#toast.success('Achat supprimé : la dette et le stock sont corrigés.');
        this.#refresh();
      },
      error: (error) => this.#toast.error(apiError(error)),
    });
  }

  protected openPayment(): void {
    // Par défaut, on règle le compte où la dette est la plus probable
    const target = this.accountCurrencies()[0] ?? 'GNF';
    this.paymentForm.reset({ currency: target, target_currency: target, payment_date: today(), payment_method: 'ESPECES' });
    this.paying.set(true);
  }

  protected savePayment(): void {
    const supplier = this.selected();
    const value = this.paymentForm.getRawValue();
    const rateFor = this.paymentRateFor();
    if (!supplier || this.paymentForm.invalid || this.saving()) {
      this.paymentForm.markAllAsTouched();
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

    this.saving.set(true);
    this.#api
      .createSupplierPayment(supplier.id, {
        amount: value.amount,
        currency: value.currency,
        target_currency: value.target_currency,
        exchange_rate: rateFor ? value.rate : null,
        payment_date: value.payment_date,
        payment_method: value.payment_method,
        reference: value.reference || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.paying.set(false);
          this.#toast.success('Paiement enregistré au compte du fournisseur.');
          this.#refresh();
        },
        error: (error) => {
          this.saving.set(false);
          this.#toast.error(apiError(error));
        },
      });
  }

  protected deletePayment(paymentId: number): void {
    const supplier = this.selected();
    if (!supplier) {
      return;
    }
    this.#api.deleteSupplierPayment(supplier.id, paymentId).subscribe({
      next: () => {
        this.#toast.success('Paiement supprimé : la dette est rétablie.');
        this.#refresh();
      },
      error: (error) => this.#toast.error(apiError(error)),
    });
  }

  /** Paiement dont le reçu est affiché. */
  protected readonly receipt = signal<SupplierHistory['payments'][number] | null>(null);

  protected receiptLines(payment: SupplierHistory['payments'][number]): ReceiptLine[] {
    const converted = payment.currency !== payment.target_currency;
    return [
      { label: 'Payé à', value: this.selected()?.name ?? '' },
      { label: 'Montant versé', value: formatMoney(payment.amount, payment.currency), main: true },
      ...(converted
        ? [
            { label: 'Taux du jour', value: `${formatNumber(payment.exchange_rate)} GNF` },
            { label: `Imputé au compte ${payment.target_currency}`, value: formatMoney(payment.converted_amount, payment.target_currency) },
          ]
        : []),
      { label: 'Mode de paiement', value: this.methodLabel(payment.payment_method) + (payment.reference ? ` · ${payment.reference}` : '') },
    ];
  }

  protected methodLabel(value: string): string {
    return this.methods.find((method) => method.value === value)?.label ?? value;
  }

  #refresh(): void {
    this.load();
    this.#loadDetail();
  }

  #loadDetail(): void {
    const supplier = this.selected();
    if (!supplier) {
      return;
    }
    forkJoin([this.#api.supplierHistory(supplier.id), this.#api.purchases(supplier.id)]).subscribe({
      next: ([history, purchases]) => {
        this.history.set(history);
        this.purchases.set(purchases);
      },
      error: (error) => this.#toast.error(apiError(error, 'Le compte du fournisseur n\'a pas pu être chargé.')),
    });
  }

  #loadFamilyProducts(key: string): void {
    this.purchaseForm.controls.product_id.setValue(null);
    const family = this.families().find((item) => item.key === key);
    if (!family?.categoryId) {
      this.familyProducts.set([]);
      return;
    }
    this.#api.products(family.categoryId).subscribe({ next: (products) => this.familyProducts.set(products), error: () => this.familyProducts.set([]) });
  }
}
