import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { apiError, DayPipe, formatNumber, NumberPipe, today } from '../../shared/format';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { PdfService } from '../../shared/pdf.service';
import { Pager, paginate } from '../../shared/pager';
import { ToastService } from '../../shared/toast.service';
import { AdjustmentType, cartonsOf, CommercialApi, FamilyKey, StockCard, StockRow, StockSummary } from './commercial.api';
import { FamilyTabs } from './family-tabs';
import { ButtonIcon } from '../../shared/button-icon';

type Level = 'epuise' | 'bas' | 'ok';

const ADJUSTMENTS: { value: AdjustmentType; label: string; help: string }[] = [
  { value: 'AVARIE', label: 'Avarie constatée', help: 'Les pièces quittent le stock sain et passent en stock avarié. Elles restent vendables, à prix réduit.' },
  { value: 'PERTE', label: 'Perte', help: 'Les pièces sortent définitivement du stock : jetées, cassées, volées.' },
  { value: 'REMISE', label: 'Remise en état', help: 'Des pièces avariées redeviennent vendables au prix normal.' },
  { value: 'INVENTAIRE', label: 'Inventaire', help: 'Vous avez compté le stock : l\'écart avec le stock théorique est enregistré.' },
];

/** État du stock par produit — entré, vendu, avarié, perdu, reste — et fiche de mouvements. */
@Component({
  selector: 'app-commercial-stock',
  imports: [ReactiveFormsModule, PageHeader, Modal, FamilyTabs, NumberPipe, DayPipe, Pager, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stock.html',
})
export class Stock {
  readonly #api = inject(CommercialApi);
  readonly #toast = inject(ToastService);

  protected readonly cartonsOf = cartonsOf;
  readonly #pdf = inject(PdfService);

  /** État du stock tel qu'affiché (recherche et filtre compris). */
  protected print(): void {
    const totals = this.summary()?.totals;
    const cartons = !!this.family()?.cartons;
    this.#pdf.table({
      title: `État du stock — ${this.family()?.label ?? ''}`,
      subtitle: 'Quantités en pièces.',
      landscape: true,
      facts: totals
        ? [
            { label: 'Reste sain', value: formatNumber(totals.stock) },
            { label: 'Vendus', value: formatNumber(totals.sold) },
            { label: 'Avariés en stock', value: formatNumber(totals.damaged) },
            { label: 'Perdus', value: formatNumber(totals.lost) },
          ]
        : [],
      columns: [
        { header: cartons ? 'Désignation' : 'Dimension' },
        { header: 'Entrés', align: 'right' },
        { header: 'Vendus', align: 'right' },
        { header: 'Avariés', align: 'right' },
        { header: 'Perdus', align: 'right' },
        { header: 'Reste', align: 'right' },
        ...(cartons ? [{ header: 'Reste en cartons', align: 'right' as const }] : []),
        { header: 'État', width: 70 },
      ],
      rows: this.rows().map(({ product, level }) => {
        const split = cartonsOf(product.stock, product.units_per_carton);
        return [
          product.name,
          formatNumber(product.received),
          formatNumber(product.sold),
          formatNumber(product.damaged),
          formatNumber(product.lost),
          formatNumber(product.stock),
          ...(cartons ? [split ? `${formatNumber(split.cartons)}${split.pieces ? ' + ' + split.pieces : ''}` : ''] : []),
          this.levels[level].label,
        ];
      }),
    });
  }
  protected readonly adjustments = ADJUSTMENTS;
  protected readonly families = toSignal(this.#api.families$, { initialValue: [] });
  /** Famille imposée par la route (menu Pneus ou Cosmétique) : l'écran n'en propose alors pas d'autre. */
  readonly lockedFamily = input<FamilyKey | undefined>(undefined, { alias: 'family' });
  protected readonly familyKey = signal<FamilyKey>('pneus');
  protected readonly family = computed(() => this.families().find((family) => family.key === this.familyKey()));

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly search = signal('');
  protected readonly filter = signal<'tous' | 'surveiller' | 'avaries'>('tous');
  protected readonly summary = signal<StockSummary | null>(null);

  protected readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const filter = this.filter();
    return (this.summary()?.products ?? [])
      .map((product) => ({ product, level: this.#level(product) }))
      .filter(
        (row) =>
          (!term || row.product.name.toLowerCase().includes(term)) &&
          (filter === 'tous' || (filter === 'surveiller' ? row.level !== 'ok' : row.product.damaged > 0)),
      );
  });
  protected readonly pager = paginate(this.rows);
  protected readonly alerts = computed(() => (this.summary()?.products ?? []).filter((product) => this.#level(product) !== 'ok').length);

  protected readonly levels: Record<Level, { label: string; tone: string }> = {
    epuise: { label: 'Épuisé', tone: 'is-danger' },
    bas: { label: 'Stock bas', tone: 'is-warning' },
    ok: { label: 'En stock', tone: 'is-success' },
  };

  // --- Fiche ----------------------------------------------------------------
  protected readonly viewing = signal<StockRow | null>(null);
  protected readonly card = signal<StockCard | null>(null);

  // --- Ajustement -----------------------------------------------------------
  protected readonly adjusting = signal<StockRow | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    type: ['AVARIE' as AdjustmentType],
    quantity: [null as number | null, Validators.min(1)],
    source: ['AVARIE'],
    counted_stock: [null as number | null, Validators.min(0)],
    counted_damaged: [null as number | null, Validators.min(0)],
    reason: [''],
    adjustment_date: [today(), Validators.required],
  });
  readonly #form = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly type = computed(() => this.#form().type ?? 'AVARIE');
  protected readonly help = computed(() => ADJUSTMENTS.find((item) => item.value === this.type())?.help ?? '');
  /** Écart entre le comptage et le stock théorique, pour un inventaire. */
  protected readonly gap = computed(() => {
    const counted = this.#form().counted_stock;
    const product = this.adjusting();
    return counted === null || counted === undefined || !product ? null : Number(counted) - product.stock;
  });

  constructor() {
    effect(() => {
      const locked = this.lockedFamily();
      if (locked) {
        this.familyKey.set(locked);
      }
    });
    effect(() => {
      if (this.family()) {
        this.load();
      }
    });
  }

  protected load(): void {
    const family = this.family();
    if (!family?.categoryId) {
      this.summary.set(null);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.#api.stockSummary(family.categoryId).subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.#toast.error(apiError(error, 'Le stock n\'a pas pu être chargé.'));
      },
    });
  }

  protected open(product: StockRow): void {
    this.viewing.set(product);
    this.card.set(null);
    this.#api.stockCard(product.id).subscribe({
      next: (card) => this.card.set(card),
      error: (error) => {
        this.viewing.set(null);
        this.#toast.error(apiError(error, 'La fiche de stock n\'a pas pu être chargée.'));
      },
    });
  }

  protected openAdjustment(product: StockRow, type: AdjustmentType = 'AVARIE'): void {
    this.form.reset({ type, source: 'AVARIE', adjustment_date: today() });
    this.adjusting.set(product);
  }

  protected saveAdjustment(): void {
    const product = this.adjusting();
    const value = this.form.getRawValue();
    if (!product || this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const inventory = value.type === 'INVENTAIRE';
    if (inventory ? value.counted_stock === null : !(Number(value.quantity) >= 1)) {
      this.#toast.error(inventory ? 'Saisissez le nombre de pièces comptées.' : 'Saisissez le nombre de pièces.');
      return;
    }

    this.saving.set(true);
    this.#api
      .adjustStock(product.id, {
        type: value.type,
        quantity: inventory ? null : value.quantity,
        source: value.type === 'PERTE' ? value.source : null,
        counted_stock: inventory ? value.counted_stock : null,
        counted_damaged: inventory ? value.counted_damaged : null,
        reason: value.reason || null,
        adjustment_date: value.adjustment_date,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.adjusting.set(null);
          this.#toast.success(`Stock de ${product.name} mis à jour.`);
          this.load();
        },
        error: (error) => {
          this.saving.set(false);
          this.#toast.error(apiError(error));
        },
      });
  }

  #level(product: StockRow): Level {
    if (product.stock <= 0) {
      return 'epuise';
    }
    return product.stock <= product.low_stock_threshold ? 'bas' : 'ok';
  }
}
