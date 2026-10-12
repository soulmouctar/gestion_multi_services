import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { apiError, DayPipe, MoneyPipe, NumberPipe, today } from '../../shared/format';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { ToastService } from '../../shared/toast.service';
import { CURRENCIES, TextileApi } from '../textile/textile.api';
import { CommercialApi, FamilyKey, Product } from './commercial.api';
import { FamilyTabs } from './family-tabs';
import { ButtonIcon } from '../../shared/button-icon';

interface Expense {
  id: number;
  label: string;
  amount: number;
  expense_date: string;
}

interface TyreContainer {
  id: number;
  reference: string;
  supplier: { id: number; name: string } | null;
  arrival_date: string;
  /** Arrivée du conteneur suivant ; null pour le conteneur en cours de vente. */
  period_end: string | null;
  purchase_price: number;
  currency: string;
  exchange_rate: number;
  price_gnf: number;
  sales_gnf: number;
  tyres_sold: number;
  expenses_gnf: number;
  after_expenses_gnf: number;
  result_gnf: number;
  expenses: Expense[];
}

interface Line {
  product: Product;
  quantity: number;
}

/** Conteneurs de pneus et de cosmétique : prix d'achat, ventes de la période, dépenses et résultat. */
@Component({
  selector: 'app-tyre-containers',
  imports: [ReactiveFormsModule, PageHeader, Modal, FamilyTabs, MoneyPipe, NumberPipe, DayPipe, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tyre-containers.html',
  styleUrl: './tyre-containers.scss',
})
export class TyreContainers {
  readonly #api = inject(ApiService);
  readonly #commercial = inject(CommercialApi);
  readonly #toast = inject(ToastService);
  readonly #fb = inject(FormBuilder).nonNullable;

  protected readonly currencies = CURRENCIES;
  readonly #rates = toSignal(inject(TextileApi).rates(), { initialValue: {} as Record<string, number> });
  protected readonly suppliers = toSignal(inject(TextileApi).suppliers(), { initialValue: [] });

  protected readonly families = toSignal(this.#commercial.families$, { initialValue: [] });
  /** Famille imposée par la route (menu Pneus ou Cosmétique) : l'écran n'en propose alors pas d'autre. */
  readonly lockedFamily = input<FamilyKey | undefined>(undefined, { alias: 'family' });
  protected readonly familyKey = signal<FamilyKey>('pneus');
  protected readonly family = computed(() => this.families().find((family) => family.key === this.familyKey()));
  /** Le cosmétique se reçoit en cartons ; le pneu, à la pièce. */
  protected readonly cartons = computed(() => !!this.family()?.cartons);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly containers = signal<TyreContainer[]>([]);
  protected readonly deleting = signal<TyreContainer | null>(null);

  // --- Nouveau conteneur ----------------------------------------------------
  protected readonly creating = signal(false);
  protected readonly form = this.#fb.group({
    reference: ['', [Validators.required, Validators.maxLength(100)]],
    supplier_id: [null as number | null, Validators.required],
    arrival_date: [today(), Validators.required],
    purchase_price: [null as number | null, [Validators.required, Validators.min(0)]],
    currency: ['GNF'],
    rate: [null as number | null],
  });
  readonly #value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly foreign = computed(() => (this.#value().currency === 'GNF' ? null : this.#value().currency!));
  protected readonly priceGnf = computed(() => Math.round((Number(this.#value().purchase_price) || 0) * (Number(this.#value().rate) || 0)));

  readonly #tyres = signal<Product[]>([]);
  protected readonly search = signal('');
  protected readonly lines = signal<Line[]>([]);
  protected readonly matches = computed(() => {
    const term = this.search().trim().toLowerCase();
    const taken = new Set(this.lines().map((line) => line.product.id));
    return term ? this.#tyres().filter((tyre) => !taken.has(tyre.id) && tyre.name.toLowerCase().includes(term)).slice(0, 6) : [];
  });
  /** Pièces d'une ligne : une quantité en cartons est convertie. */
  protected pieces(line: Line): number {
    return Math.round(line.quantity * (this.cartons() ? Math.max(1, Number(line.product.units_per_carton) || 1) : 1));
  }
  protected readonly totalTyres = computed(() => this.lines().reduce((sum, line) => sum + this.pieces(line), 0));

  // --- Dépense --------------------------------------------------------------
  protected readonly expenseFor = signal<TyreContainer | null>(null);
  protected readonly expenseForm = this.#fb.group({
    label: ['', Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    expense_date: [today(), Validators.required],
  });

  constructor() {
    effect(() => {
      const locked = this.lockedFamily();
      if (locked) {
        this.familyKey.set(locked);
      }
    });
    // Conteneurs et produits proposés suivent la famille choisie
    effect(() => {
      const family = this.family();
      if (!family) {
        return;
      }
      this.load();
      this.#tyres.set([]);
      if (family.categoryId) {
        this.#commercial.products(family.categoryId).subscribe({ next: (products) => this.#tyres.set(products), error: () => undefined });
      }
    });
    this.form.controls.currency.valueChanges.subscribe((currency) =>
      this.form.controls.rate.setValue(currency === 'GNF' ? null : (this.#rates()[currency] ?? null)),
    );
  }

  protected load(): void {
    this.loading.set(true);
    this.#api.get<TyreContainer[]>('tyre-containers', { family: this.familyKey() }).subscribe({
      next: (containers) => {
        this.containers.set(containers);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.#toast.error(apiError(error, 'Les conteneurs n\'ont pas pu être chargés.'));
      },
    });
  }

  protected open(): void {
    this.form.reset({ arrival_date: today(), currency: 'GNF' });
    this.lines.set([]);
    this.search.set('');
    this.creating.set(true);
  }

  protected add(product: Product): void {
    this.lines.update((lines) => [...lines, { product, quantity: 1 }]);
    this.search.set('');
  }

  protected setQuantity(index: number, quantity: number): void {
    this.lines.update((lines) => lines.map((line, position) => (position === index ? { ...line, quantity } : line)));
  }

  protected remove(index: number): void {
    this.lines.update((lines) => lines.filter((_, position) => position !== index));
  }

  protected save(): void {
    const value = this.form.getRawValue();
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.foreign() && !(Number(value.rate) > 1)) {
      this.#toast.error(`Saisissez le taux du jour : 1 ${this.foreign()} en GNF.`);
      return;
    }
    const invalid = this.lines().find((line) => !(line.quantity >= 1));
    if (invalid) {
      this.#toast.error(`Vérifiez la quantité de ${invalid.product.name}.`);
      return;
    }

    this.saving.set(true);
    this.#api
      .post('tyre-containers', {
        reference: value.reference.trim(),
        supplier_id: value.supplier_id,
        arrival_date: value.arrival_date,
        purchase_price: value.purchase_price,
        currency: value.currency,
        exchange_rate: this.foreign() ? value.rate : null,
        family: this.familyKey(),
        lines: this.lines().map((line) => ({ product_id: line.product.id, quantity: this.pieces(line) })),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.creating.set(false);
          this.#toast.success('Conteneur enregistré : la marchandise est en stock et la dette fournisseur est à jour.');
          this.load();
        },
        error: (error) => {
          this.saving.set(false);
          this.#toast.error(apiError(error));
        },
      });
  }

  protected openExpense(container: TyreContainer): void {
    this.expenseForm.reset({ expense_date: today() });
    this.expenseFor.set(container);
  }

  protected saveExpense(): void {
    const container = this.expenseFor();
    if (!container || this.expenseForm.invalid || this.saving()) {
      this.expenseForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.#api.post(`tyre-containers/${container.id}/expenses`, this.expenseForm.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.expenseFor.set(null);
        this.#toast.success('Dépense ajoutée au conteneur.');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }

  protected removeExpense(expense: Expense): void {
    this.#api.delete(`tyre-container-expenses/${expense.id}`).subscribe({
      next: () => {
        this.#toast.success('Dépense supprimée.');
        this.load();
      },
      error: (error) => this.#toast.error(apiError(error)),
    });
  }

  protected confirmDelete(): void {
    const container = this.deleting();
    if (!container || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.#api.delete(`tyre-containers/${container.id}`).subscribe({
      next: () => {
        this.saving.set(false);
        this.deleting.set(null);
        this.#toast.success('Conteneur supprimé : le stock et la dette fournisseur sont corrigés.');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }
}
