import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ApiService } from '../../core/api.service';
import { ButtonIcon } from '../../shared/button-icon';
import { apiError, DayPipe, NumberPipe } from '../../shared/format';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { Pager, paginate } from '../../shared/pager';
import { ToastService } from '../../shared/toast.service';

interface TrashGroup {
  key: string;
  label: string;
  count: number;
}

interface TrashItem {
  id: number;
  title: string | null;
  subtitle: string | null;
  deleted_at: string;
}

/** Libellés au pluriel, plus naturels dans la liste des corbeilles. */
const PLURALS: Record<string, string> = {
  product: 'Produits',
  client: 'Clients',
  supplier: 'Fournisseurs',
  invoice: 'Ventes et factures',
  payment: 'Encaissements',
  category: 'Catégories',
  unit: 'Unités de mesure',
  expense: 'Dépenses',
  container: 'Conteneurs textile',
  'container-arrival': 'Arrivages textile',
  'container-sale': 'Ventes textile',
  location: 'Emplacements',
  building: 'Bâtiments',
  floor: 'Étages',
  'housing-unit': 'Logements',
  lease: 'Baux',
  driver: 'Conducteurs',
  taxi: 'Véhicules',
  'vehicle-expense': 'Dépenses des véhicules',
  'daily-payment': 'Versements journaliers',
  'bank-account': 'Comptes bancaires',
  'bank-transaction': 'Opérations bancaires',
};

/** Corbeille : tout ce qui a été supprimé peut être restauré, ou effacé pour de bon. */
@Component({
  selector: 'app-admin-trash',
  imports: [PageHeader, Modal, Pager, ButtonIcon, DayPipe, NumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trash.html',
  styleUrl: './trash.scss',
})
export class Trash {
  readonly #api = inject(ApiService);
  readonly #toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly groups = signal<TrashGroup[]>([]);
  protected readonly total = computed(() => this.groups().reduce((sum, group) => sum + group.count, 0));
  /** Les corbeilles qui contiennent quelque chose d'abord. */
  protected readonly ordered = computed(() => [...this.groups()].sort((a, b) => Number(b.count > 0) - Number(a.count > 0)));

  protected readonly selected = signal<TrashGroup | null>(null);
  protected readonly items = signal<TrashItem[]>([]);
  protected readonly itemsLoading = signal(false);
  protected readonly search = signal('');
  protected readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    return term ? this.items().filter((item) => `${item.title ?? ''} ${item.subtitle ?? ''}`.toLowerCase().includes(term)) : this.items();
  });
  protected readonly pager = paginate(this.visible);

  /** Élément dont la suppression définitive attend une confirmation. */
  protected readonly erasing = signal<TrashItem | null>(null);
  protected readonly emptying = signal(false);

  constructor() {
    this.load();
  }

  protected label(group: TrashGroup): string {
    return PLURALS[group.key] ?? group.label;
  }

  protected load(): void {
    this.#api.get<TrashGroup[]>('trash').subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.loading.set(false);
        // La corbeille ouverte reste à jour ; à défaut, on ouvre la première qui n'est pas vide
        const current = this.selected();
        const next = (current && groups.find((group) => group.key === current.key)) || groups.find((group) => group.count > 0) || null;
        if (next) {
          this.open(next);
        }
      },
      error: (error) => {
        this.loading.set(false);
        this.#toast.error(apiError(error, 'La corbeille n\'a pas pu être chargée.'));
      },
    });
  }

  protected open(group: TrashGroup): void {
    this.selected.set(group);
    this.search.set('');
    this.itemsLoading.set(true);
    this.#api.get<TrashItem[]>(`trash/${group.key}`, { per_page: 500 }).subscribe({
      next: (items) => {
        this.items.set(items);
        this.itemsLoading.set(false);
      },
      error: (error) => {
        this.itemsLoading.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }

  protected restore(item: TrashItem): void {
    const group = this.selected();
    if (!group || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.#api.post(`trash/${group.key}/${item.id}/restore`, {}).subscribe({
      next: () => {
        this.busy.set(false);
        this.#toast.success(`${item.title ?? 'Élément'} restauré.`);
        this.load();
      },
      error: (error) => {
        this.busy.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }

  protected confirmErase(): void {
    const group = this.selected();
    const item = this.erasing();
    if (!group || !item || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.#api.delete(`trash/${group.key}/${item.id}/force`).subscribe({
      next: () => {
        this.busy.set(false);
        this.erasing.set(null);
        this.#toast.success('Supprimé définitivement.');
        this.load();
      },
      error: (error) => {
        this.busy.set(false);
        this.#toast.error(apiError(error, 'Suppression impossible : cet élément est encore utilisé ailleurs.'));
      },
    });
  }

  protected confirmEmpty(): void {
    const group = this.selected();
    if (!group || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.#api.delete(`trash/${group.key}/empty`).subscribe({
      next: () => {
        this.busy.set(false);
        this.emptying.set(false);
        this.#toast.success('Corbeille vidée.');
        this.load();
      },
      error: (error) => {
        this.busy.set(false);
        this.#toast.error(apiError(error, 'La corbeille n\'a pas pu être vidée : des éléments sont encore utilisés ailleurs.'));
      },
    });
  }
}
