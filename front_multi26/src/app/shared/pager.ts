import { ChangeDetectionStrategy, Component, computed, input, Signal, signal, WritableSignal } from '@angular/core';

import { NumberPipe } from './format';

export interface PageState<T> {
  page: WritableSignal<number>;
  size: WritableSignal<number>;
  /** Lignes de la page affichée. */
  rows: Signal<T[]>;
  total: Signal<number>;
  pages: Signal<number>;
  /** Page réellement affichée : la page demandée, ramenée dans les bornes. */
  current: Signal<number>;
}

/**
 * Découpe une liste en pages. La liste source peut changer (recherche, filtre) :
 * la page affichée est ramenée dans les bornes sans rien avoir à remettre à zéro.
 */
export function paginate<T>(source: Signal<T[]>, pageSize = 15): PageState<T> {
  const page = signal(1);
  const size = signal(pageSize);
  const total = computed(() => source().length);
  const pages = computed(() => Math.max(1, Math.ceil(total() / size())));
  const current = computed(() => Math.min(Math.max(1, page()), pages()));
  const rows = computed(() => source().slice((current() - 1) * size(), current() * size()));
  return { page, size, rows, total, pages, current };
}

/** Pied de tableau : lignes affichées, taille de page, pages précédente et suivante. */
@Component({
  selector: 'app-pager',
  imports: [NumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = state();
    @if (s.total() > sizes[0]) {
      <span class="range num">{{ first() | num }}–{{ last() | num }} sur {{ s.total() | num }}</span>
      <label>
        Lignes par page
        <select #pick [value]="s.size()" (change)="s.size.set(+pick.value); s.page.set(1)">
          @for (option of sizes; track option) {
            <option [value]="option">{{ option }}</option>
          }
        </select>
      </label>
      <div class="moves">
        <button type="button" [disabled]="s.current() <= 1" (click)="s.page.set(1)" aria-label="Première page">«</button>
        <button type="button" [disabled]="s.current() <= 1" (click)="s.page.set(s.current() - 1)">Précédent</button>
        <span class="num">Page {{ s.current() | num }} / {{ s.pages() | num }}</span>
        <button type="button" [disabled]="s.current() >= s.pages()" (click)="s.page.set(s.current() + 1)">Suivant</button>
        <button type="button" [disabled]="s.current() >= s.pages()" (click)="s.page.set(s.pages())" aria-label="Dernière page">»</button>
      </div>
    }
  `,
  styles: `
    :host { display: flex; align-items: center; gap: 12px 20px; flex-wrap: wrap; padding: 12px 16px; border-top: 1px solid var(--border); font-size: 13px; color: var(--text-soft); }
    :host:empty { display: none; }
    .range { margin-right: auto; }
    label { display: inline-flex; align-items: center; gap: 8px; }
    select { height: 30px; padding: 0 6px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font: inherit; }
    .moves { display: inline-flex; align-items: center; gap: 6px; }
    button { height: 30px; padding: 0 10px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font: inherit; }
    button:hover:not(:disabled) { background: var(--surface-2); }
    button:disabled { opacity: .45; cursor: not-allowed; }
  `,
})
export class Pager<T> {
  readonly state = input.required<PageState<T>>();
  protected readonly sizes = [10, 15, 25, 50, 100];

  protected readonly first = computed(() => (this.state().current() - 1) * this.state().size() + 1);
  protected readonly last = computed(() => Math.min(this.state().total(), this.state().current() * this.state().size()));
}
