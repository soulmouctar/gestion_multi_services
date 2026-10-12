import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, map, of } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { apiError, DayPipe, formatMoney, formatNumber, MoneyPipe, NumberPipe, today } from '../../shared/format';
import { compressImage } from '../../shared/image-compression';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { PdfService } from '../../shared/pdf.service';
import { Pager, paginate } from '../../shared/pager';
import { Receipt } from '../../shared/receipt';
import { ToastService } from '../../shared/toast.service';
import { RESOURCES } from './resources';
import { Column, Field, Option, Row } from './resource.types';
import { ButtonIcon } from '../../shared/button-icon';

/**
 * Fenêtre de liste et de saisie décrite par une configuration :
 * même tableau, même formulaire et mêmes messages pour toutes les ressources simples.
 */
@Component({
  selector: 'app-resource-page',
  imports: [ReactiveFormsModule, PageHeader, Modal, Receipt, MoneyPipe, NumberPipe, DayPipe, Pager, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resource-page.html',
})
export class ResourcePage {
  readonly #api = inject(ApiService);
  readonly #toast = inject(ToastService);

  /** Clé de la ressource, fournie par la route. */
  readonly resource = input.required<string>();
  protected readonly config = computed(() => RESOURCES[this.resource()]);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly search = signal('');
  readonly #rows = signal<Row[]>([]);
  protected readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const config = this.config();
    const chosen = this.filters();
    return this.#rows().filter(
      (row) =>
        (!term || config.searchText(row).toLowerCase().includes(term)) &&
        this.filterColumns().every((column) => !chosen[column.label] || String(column.value(row)) === chosen[column.label]),
    );
  });
  /** Une colonne d'état (pastille) devient d'office un filtre. */
  protected readonly filterColumns = computed(() => this.config().columns.filter((column) => column.kind === 'badge' && column.badges));
  protected readonly filters = signal<Record<string, string>>({});

  protected badgeOptions(column: Column): { value: string; label: string }[] {
    return Object.entries(column.badges ?? {}).map(([value, badge]) => ({ value, label: badge.label }));
  }

  protected filterValue(label: string): string {
    return this.filters()[label] ?? '';
  }

  protected setFilter(label: string, value: string): void {
    this.filters.update((filters) => ({ ...filters, [label]: value }));
  }
  /** Options des listes déroulantes, par clé de champ. */
  protected readonly pager = paginate(this.rows);
  protected readonly options = signal<Record<string, Option[]>>({});

  protected readonly editing = signal<Row | 'new' | null>(null);
  protected readonly deleting = signal<Row | null>(null);
  protected readonly receipt = signal<Row | null>(null);
  protected form = new FormGroup<Record<string, FormControl>>({});
  protected readonly visibleFields = computed(() => {
    const creating = this.editing() === 'new';
    return this.config().fields.filter((field) => creating || !field.createOnly);
  });

  constructor() {
    // La même fenêtre sert plusieurs routes : tout se recharge quand la ressource change
    effect(() => {
      const config = this.config();
      this.#rows.set([]);
      this.search.set('');
      this.filters.set({});
      this.editing.set(null);
      this.load();
      this.#loadOptions(config.fields);
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.#list(this.config().endpoint, { per_page: 500 }).subscribe({
      next: (rows) => {
        this.#rows.set(rows);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.#toast.error(apiError(error, 'La liste n\'a pas pu être chargée.'));
      },
    });
  }

  protected open(row: Row | 'new'): void {
    const controls: Record<string, FormControl> = {};
    for (const field of this.config().fields) {
      if (row !== 'new' && field.createOnly) {
        continue;
      }
      controls[field.key] = new FormControl(row === 'new' ? this.#initial(field) : this.#stored(row, field), {
        validators: field.required ? [Validators.required] : [],
      });
    }
    this.form = new FormGroup(controls);
    this.editing.set(row);
  }

  protected save(): void {
    const target = this.editing();
    const config = this.config();
    if (!target || this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    // Un champ laissé vide part comme « non renseigné », pas comme une chaîne vide
    const value: Row = {};
    for (const [key, raw] of Object.entries(this.form.getRawValue())) {
      value[key] = raw === '' ? null : raw;
    }
    const body = config.toBody ? config.toBody(value) : value;

    this.saving.set(true);
    const request =
      target === 'new'
        ? this.#api.post(config.createEndpoint ? config.createEndpoint(body) : config.endpoint, body)
        : this.#api.put(`${config.endpoint}/${target['id']}`, body);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.#toast.success(target === 'new' ? 'Enregistré.' : 'Modification enregistrée.');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }

  /** Joint un fichier à une ligne ; une photo est allégée avant l'envoi. */
  protected async attach(row: Row, input: HTMLInputElement): Promise<void> {
    const model = this.config().attachment;
    const picked = input.files?.[0];
    input.value = '';
    if (!model || !picked) {
      return;
    }
    const file = await compressImage(picked);
    const body = new FormData();
    body.append(model.field, file);
    this.saving.set(true);
    this.#api.post(model.endpoint(row), body).subscribe({
      next: () => {
        this.saving.set(false);
        this.#toast.success(`${model.label} enregistré.`);
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }

  readonly #pdf = inject(PdfService);

  /** Liste telle qu'affichée (recherche et filtres compris), toutes pages confondues. */
  protected print(): void {
    const config = this.config();
    const day = (value: unknown) => (typeof value === 'string' && value.length >= 10 ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : '');
    this.#pdf.table({
      title: config.title,
      subtitle: config.description,
      landscape: config.columns.length > 4,
      columns: config.columns.map((column) => ({ header: column.label, align: column.kind === 'money' || column.kind === 'num' ? ('right' as const) : ('left' as const) })),
      rows: this.rows().map((row) =>
        config.columns.map((column) => {
          const value = column.value(row);
          const sub = column.sub?.(row);
          const text =
            column.kind === 'money'
              ? formatMoney(value, column.currency ? column.currency(row) : 'GNF')
              : column.kind === 'num'
                ? formatNumber(value)
                : column.kind === 'day'
                  ? day(value)
                  : column.kind === 'badge'
                    ? (column.badges?.[String(value)]?.label ?? String(value ?? ''))
                    : String(value ?? '');
          return sub ? `${text}\n${sub}` : text;
        }),
      ),
    });
  }

  protected optionsFor(field: Field): Option[] {
    return field.options ?? this.options()[field.key] ?? [];
  }

  protected confirmDelete(): void {
    const row = this.deleting();
    const config = this.config();
    if (!row || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.#api.delete(config.deleteEndpoint ? config.deleteEndpoint(row) : `${config.endpoint}/${row['id']}`).subscribe({
      next: () => {
        this.saving.set(false);
        this.deleting.set(null);
        this.#toast.success('Supprimé.');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }

  /** Le serveur renvoie tantôt une page, tantôt un tableau, tantôt un tableau sous une clé. */
  #list(endpoint: string, query: Record<string, string | number>) {
    return this.#api.get<unknown>(endpoint, query).pipe(
      map((data): Row[] => {
        if (Array.isArray(data)) {
          return data as Row[];
        }
        const inner = (data as { data?: unknown })?.data;
        if (Array.isArray(inner)) {
          return inner as Row[];
        }
        const firstArray = Object.values((data as Row) ?? {}).find(Array.isArray);
        return (firstArray as Row[]) ?? [];
      }),
    );
  }

  #loadOptions(fields: Field[]): void {
    const sources = fields.filter((field) => field.optionsFrom);
    this.options.set({});
    if (!sources.length) {
      return;
    }
    forkJoin(
      sources.map((field) =>
        this.#list(field.optionsFrom!.endpoint, { per_page: 500, ...field.optionsFrom!.query }).pipe(
          map((items) => [field.key, items.map((item) => ({ value: item['id'], label: field.optionsFrom!.label(item) }))] as const),
        ),
      ),
    ).subscribe({ next: (entries) => this.options.set(Object.fromEntries(entries)), error: () => of(null) });
  }

  #initial(field: Field): unknown {
    if (field.initial === 'today') {
      return today();
    }
    if (field.initial === 'month') {
      return today().slice(0, 7);
    }
    return field.initial ?? null;
  }

  #stored(row: Row, field: Field): unknown {
    const value = row[field.key];
    // Les dates arrivent avec l'heure : le champ n'attend que le jour
    return field.type === 'date' && typeof value === 'string' ? value.slice(0, 10) : (value ?? null);
  }
}
