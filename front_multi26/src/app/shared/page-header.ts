import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';

import { findWindow } from '../core/windows';
import { Icon, IconName } from './icon';

/** En-tête unique de toutes les fenêtres : icône, fil d'Ariane, titre, description, actions à droite. */
@Component({
  selector: 'app-page-header',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="chip"><app-icon [name]="shownIcon()" [size]="22" /></span>
    <div class="text">
      @if (eyebrow()) {
        <span class="eyebrow">{{ eyebrow() }}</span>
      }
      <h1>{{ title() }}</h1>
      @if (description()) {
        <p>{{ description() }}</p>
      }
    </div>
    <div class="actions"><ng-content /></div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 26px;
    }
    .chip {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: var(--brand);
      color: var(--on-brand);
      box-shadow: 0 6px 16px color-mix(in srgb, var(--brand) 30%, transparent);
    }
    .text { display: grid; gap: 3px; flex: 1; min-width: 240px; }
    h1 { font-size: 24px; font-weight: 700; letter-spacing: -.02em; line-height: 1.2; }
    p { color: var(--text-soft); max-width: 72ch; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .actions:empty { display: none; }
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly eyebrow = input('');
  readonly description = input('');
  /** Icône de la fenêtre ; à défaut, celle de la fenêtre ouverte dans le menu. */
  readonly icon = input<IconName>();

  readonly #router = inject(Router);

  protected readonly shownIcon = computed<IconName>(() => {
    const path = this.#router.url.split('?')[0].replace(/^\//, '');
    return this.icon() ?? findWindow(path)?.window.icon ?? (path === 'dashboard' ? 'gauge' : 'file');
  });
}
