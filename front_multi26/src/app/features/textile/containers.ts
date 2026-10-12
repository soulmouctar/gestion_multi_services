import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, Observable, switchMap } from 'rxjs';

import { apiError, DayPipe, MoneyPipe, NumberPipe, today } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { Pager, paginate } from '../../shared/pager';
import { ToastService } from '../../shared/toast.service';
import { Arrival, Container, convert, CURRENCIES, rateCurrency, TextileApi } from './textile.api';
import { ButtonIcon } from '../../shared/button-icon';

/** Conteneurs textile : envoi, puis livraison avec enregistrement de la dette fournisseur. */
@Component({
  selector: 'app-textile-containers',
  imports: [ReactiveFormsModule, RouterLink, PageHeader, Modal, Icon, MoneyPipe, NumberPipe, DayPipe, Pager, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './containers.html',
})
export class Containers {
  readonly #api = inject(TextileApi);
  readonly #toast = inject(ToastService);
  readonly #fb = inject(FormBuilder).nonNullable;

  protected readonly currencies = CURRENCIES;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly containers = signal<Container[]>([]);
  protected readonly arrivals = signal<Arrival[]>([]);
  protected readonly suppliers = signal<{ id: number; name: string }[]>([]);
  readonly #rates = signal<Record<string, number>>({});
  #textileCategoryId: number | null = null;

  protected readonly search = signal('');
  protected readonly statusFilter = signal('');

  /** Un conteneur et l'arrivage enregistré à sa livraison, s'il existe. */
  protected readonly rows = computed(() => {
    const byContainer = new Map(this.arrivals().map((arrival) => [arrival.container_id, arrival]));
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.containers()
      .filter(
        (container) =>
          (!status || container.delivery_status === status) &&
          (!term || `${container.container_number} ${container.shipping_number} ${container.bl_number ?? ''}`.toLowerCase().includes(term)),
      )
      .map((container) => ({ container, arrival: byContainer.get(container.id) }));
  });
  protected readonly pager = paginate(this.rows);
  protected readonly sentCount = computed(() => this.containers().filter((c) => c.delivery_status !== 'LIVRE').length);
  protected readonly deliveredCount = computed(() => this.containers().length - this.sentCount());
  protected readonly balesLeft = computed(() => this.arrivals().reduce((sum, a) => sum + Number(a.remaining_quantity), 0));

  // --- Envoi d'un conteneur -------------------------------------------------
  protected readonly editing = signal<Container | 'new' | null>(null);
  protected readonly containerForm = this.#fb.group({
    shipping_number: ['', [Validators.required, Validators.maxLength(100)]],
    bl_number: [''],
    capacity: [null as number | null, [Validators.min(1)]],
    entry_port: [''],
    entry_date: [today()],
    expected_delivery_date: [''],
  });

  // --- Livraison ------------------------------------------------------------
  protected readonly delivering = signal<Container | null>(null);
  /** Arrivage en cours de correction ; null quand on enregistre une livraison. */
  protected readonly correcting = signal<Arrival | null>(null);
  protected readonly deliveryForm = this.#fb.group({
    arrival_date: [today(), Validators.required],
    supplier_id: [null as number | null],
    bales: [null as number | null, [Validators.required, Validators.min(1)]],
    unit_price: [null as number | null, [Validators.required, Validators.min(0)]],
    price_currency: ['USD'],
    debt_currency: ['USD'],
    rate: [null as number | null],
  });
  readonly #delivery = toSignal(this.deliveryForm.valueChanges, { initialValue: this.deliveryForm.getRawValue() });

  protected readonly total = computed(() => (Number(this.#delivery().bales) || 0) * (Number(this.#delivery().unit_price) || 0));
  /** Devise dont le taux en GNF est demandé ; null si aucun taux n'est nécessaire. */
  protected readonly rateFor = computed(() => {
    const { price_currency = 'GNF', debt_currency = 'GNF' } = this.#delivery();
    const foreign = rateCurrency(price_currency, debt_currency);
    // Même devise étrangère : pas de conversion, mais le taux valorise la dette en GNF
    return foreign === null ? (debt_currency === 'GNF' ? null : debt_currency) : foreign;
  });
  protected readonly debt = computed(() => {
    const { price_currency = 'GNF', debt_currency = 'GNF', rate } = this.#delivery();
    return convert(this.total(), price_currency, debt_currency, Number(rate) || 0);
  });
  protected readonly converted = computed(() => this.#delivery().price_currency !== this.#delivery().debt_currency);

  constructor() {
    this.load();
    forkJoin([this.#api.suppliers(), this.#api.rates(), this.#api.textileCategoryId()]).subscribe({
      next: ([suppliers, rates, categoryId]) => {
        this.suppliers.set(suppliers);
        this.#rates.set(rates);
        this.#textileCategoryId = categoryId;
      },
      error: () => undefined,
    });
    // Le taux configuré est proposé dès qu'une devise étrangère est choisie ; il reste modifiable
    // (un champ notifie avant que le formulaire entier soit à jour : on attend la fin du tour)
    this.deliveryForm.controls.price_currency.valueChanges.subscribe(() => queueMicrotask(() => this.#suggestRate()));
    this.deliveryForm.controls.debt_currency.valueChanges.subscribe(() => queueMicrotask(() => this.#suggestRate()));
  }

  protected load(): void {
    this.loading.set(true);
    forkJoin([this.#api.containers(), this.#api.arrivals()]).subscribe({
      next: ([containers, arrivals]) => {
        this.containers.set(containers);
        this.arrivals.set(arrivals);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.#toast.error(apiError(error, 'Les conteneurs n\'ont pas pu être chargés.'));
      },
    });
  }

  protected openContainer(container: Container | 'new'): void {
    this.containerForm.reset(
      container === 'new'
        ? { entry_date: today() }
        : {
            shipping_number: container.shipping_number,
            bl_number: container.bl_number ?? '',
            capacity: container.capacity,
            entry_port: container.entry_port ?? '',
            entry_date: container.entry_date?.slice(0, 10) ?? '',
            expected_delivery_date: container.expected_delivery_date?.slice(0, 10) ?? '',
          },
    );
    this.editing.set(container);
  }

  protected saveContainer(): void {
    const target = this.editing();
    if (!target || this.containerForm.invalid || this.saving()) {
      this.containerForm.markAllAsTouched();
      return;
    }
    const value = this.containerForm.getRawValue();
    const body = {
      ...value,
      bl_number: value.bl_number || null,
      entry_port: value.entry_port || null,
      entry_date: value.entry_date || null,
      expected_delivery_date: value.expected_delivery_date || null,
    };
    this.saving.set(true);
    const request =
      target === 'new'
        ? this.#api.createContainer({ ...body, expected_product_category_id: this.#textileCategoryId })
        : this.#api.updateContainer(target.id, body);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.#toast.success(target === 'new' ? 'Conteneur enregistré comme envoyé.' : 'Conteneur modifié.');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }

  /** Rouvre l'arrivage tel qu'il a été saisi, pour corriger le prix, les balles ou le fournisseur. */
  protected openCorrection(container: Container, arrival: Arrival): void {
    const entered = !!arrival.price_currency && arrival.price_total !== null;
    const bales = arrival.bale_quantity ?? arrival.total_quantity;
    this.deliveryForm.reset({
      arrival_date: arrival.arrival_date.slice(0, 10),
      supplier_id: arrival.supplier_id,
      bales,
      unit_price: entered ? Number(arrival.unit_price) : bales ? Number(arrival.purchase_price) / bales : null,
      price_currency: entered ? arrival.price_currency! : arrival.currency,
      debt_currency: arrival.currency,
      rate: Number(arrival.price_rate) > 1 ? Number(arrival.price_rate) : null,
    });
    this.correcting.set(arrival);
    this.delivering.set(container);
  }

  protected openDelivery(container: Container): void {
    this.correcting.set(null);
    this.deliveryForm.reset({
      arrival_date: today(),
      bales: container.capacity,
      price_currency: 'USD',
      debt_currency: 'USD',
      rate: this.#rates()['USD'] ?? null,
    });
    this.delivering.set(container);
  }

  protected saveDelivery(): void {
    const container = this.delivering();
    const rateFor = this.rateFor();
    const value = this.deliveryForm.getRawValue();
    if (!container || this.deliveryForm.invalid || this.saving()) {
      this.deliveryForm.markAllAsTouched();
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

    const corrected = this.correcting();
    const sold = corrected ? (corrected.bale_quantity ?? corrected.total_quantity) - corrected.remaining_quantity : 0;
    if (corrected && Number(value.bales) < sold) {
      this.#toast.error(`${sold} balle(s) sont déjà vendues : le nombre de balles ne peut pas être inférieur.`);
      return;
    }

    this.saving.set(true);
    const rate = rateFor ? Number(value.rate) : null;
    const body = {
      supplier_id: value.supplier_id,
      arrival_date: value.arrival_date,
      total_quantity: value.bales,
      bale_quantity: value.bales,
      // Dette due au fournisseur, dans la devise retenue
      purchase_price: this.debt(),
      currency: value.debt_currency,
      exchange_rate: value.debt_currency === 'GNF' ? 1 : rate,
      // Prix tel que saisi, gardé pour référence
      price_currency: value.price_currency,
      unit_price: value.unit_price,
      price_total: this.total(),
      price_rate: rate,
    };
    const request: Observable<unknown> = corrected
      ? this.#api.updateArrival(corrected.id, body)
      : this.#api
          .createArrival({ ...body, container_id: container.id, product_type: 'TEXTILE', product_category_id: this.#textileCategoryId })
          // Le conteneur ne passe à « livré » qu'une fois l'arrivage enregistré
          .pipe(switchMap(() => this.#api.updateContainer(container.id, { delivery_status: 'LIVRE' })));

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.delivering.set(null);
        this.#toast.success(
          corrected
            ? `Arrivage du conteneur ${container.container_number} corrigé : la dette fournisseur est à jour.`
            : `Conteneur ${container.container_number} livré. Les ventes sont ouvertes.`,
        );
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.#toast.error(apiError(error));
        this.load();
      },
    });
  }

  #suggestRate(): void {
    const foreign = this.rateFor();
    this.deliveryForm.controls.rate.setValue(foreign ? (this.#rates()[foreign] ?? null) : null);
  }
}
