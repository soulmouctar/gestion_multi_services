import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Avatar } from '../../shared/avatar';
import { apiError, MoneyPipe, NumberPipe } from '../../shared/format';
import { compressImage } from '../../shared/image-compression';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { Pager, paginate } from '../../shared/pager';
import { ToastService } from '../../shared/toast.service';
import { CommercialApi, FamilyKey, Product } from './commercial.api';
import { FamilyTabs } from './family-tabs';
import { ButtonIcon } from '../../shared/button-icon';

/** Catalogue des produits, classé par famille. */
@Component({
  selector: 'app-commercial-products',
  imports: [ReactiveFormsModule, PageHeader, Modal, FamilyTabs, Avatar, MoneyPipe, NumberPipe, Pager, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products.html',
})
export class Products {
  readonly #api = inject(CommercialApi);
  readonly #toast = inject(ToastService);

  protected readonly families = toSignal(this.#api.families$, { initialValue: [] });
  /** Famille imposée par la route (menu Pneus ou Cosmétique) : l'écran n'en propose alors pas d'autre. */
  readonly lockedFamily = input<FamilyKey | undefined>(undefined, { alias: 'family' });
  protected readonly familyKey = signal<FamilyKey>('pneus');
  protected readonly family = computed(() => this.families().find((family) => family.key === this.familyKey()));

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly search = signal('');
  readonly #products = signal<Product[]>([]);
  protected readonly products = computed(() => {
    const term = this.search().trim().toLowerCase();
    return term ? this.#products().filter((product) => product.name.toLowerCase().includes(term)) : this.#products();
  });

  protected readonly pager = paginate(this.products);
  protected readonly editing = signal<Product | 'new' | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    selling_price: [null as number | null, Validators.min(0)],
    units_per_carton: [null as number | null, Validators.min(1)],
    carton_selling_price: [null as number | null, Validators.min(0)],
    purchase_price: [null as number | null, Validators.min(0)],
    low_stock_threshold: [null as number | null, Validators.min(0)],
    stock_quantity: [null as number | null, Validators.min(0)],
  });

  constructor() {
    effect(() => {
      const locked = this.lockedFamily();
      if (locked) {
        this.familyKey.set(locked);
      }
    });
    // Recharge le catalogue à chaque changement de famille
    effect(() => {
      const family = this.family();
      if (family) {
        this.load();
      }
    });
  }

  protected load(): void {
    const family = this.family();
    if (!family?.categoryId) {
      this.#products.set([]);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.#api.products(family.categoryId).subscribe({
      next: (products) => {
        this.#products.set(products);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.#toast.error(apiError(error, 'Les produits n\'ont pas pu être chargés.'));
      },
    });
  }

  protected open(product: Product | 'new'): void {
    this.form.reset(
      product === 'new'
        ? {}
        : {
            name: product.name,
            selling_price: Number(product.selling_price) || null,
            units_per_carton: product.units_per_carton,
            carton_selling_price: Number(product.carton_selling_price) || null,
            purchase_price: Number(product.purchase_price) || null,
            low_stock_threshold: product.low_stock_threshold,
          },
    );
    this.editing.set(product);
  }

  /** Photo du produit : allégée, puis envoyée aussitôt. */
  protected async setPhoto(product: Product, input: HTMLInputElement): Promise<void> {
    const picked = input.files?.[0];
    input.value = '';
    if (!picked) {
      return;
    }
    const photo = await compressImage(picked);
    this.#api.uploadPhoto(`products/${product.id}/image`, 'image', photo).subscribe({
      next: () => {
        this.#toast.success(`Photo de ${product.name} enregistrée.`);
        this.load();
      },
      error: (error) => this.#toast.error(apiError(error)),
    });
  }

  protected save(): void {
    const target = this.editing();
    const family = this.family();
    if (!target || !family || this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const { stock_quantity, ...value } = this.form.getRawValue();
    const body: Record<string, unknown> = {
      ...value,
      name: value.name.trim(),
      product_category_id: family.categoryId,
      // Un pneu se compte à la pièce : pas de carton
      units_per_carton: family.cartons ? value.units_per_carton || 1 : 1,
      carton_selling_price: family.cartons ? value.carton_selling_price : null,
    };
    if (target === 'new') {
      body['stock_quantity'] = stock_quantity ?? 0;
    }

    this.saving.set(true);
    this.#api.saveProduct(target === 'new' ? null : target.id, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.#toast.success(target === 'new' ? 'Produit ajouté au catalogue.' : 'Produit modifié.');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }
}
