import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

import { Icon } from '../../shared/icon';
import { Family, FamilyKey } from './commercial.api';

/** Choix de la famille de produits : pneus ou cosmétique. */
@Component({
  selector: 'app-family-tabs',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (family of families(); track family.key) {
      <button type="button" role="tab" [class.active]="family.key === selected()" [attr.aria-selected]="family.key === selected()" (click)="selected.set(family.key)">
        <app-icon [name]="family.key === 'pneus' ? 'tire' : 'drop'" /> {{ family.label }}
      </button>
    }
  `,
  styles: `
    :host { display: inline-flex; gap: 4px; padding: 4px; border-radius: var(--radius); background: var(--surface-3); margin-bottom: 16px; }
    button {
      display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 16px;
      border: 0; border-radius: 7px; background: transparent; color: var(--text-soft); font-weight: 500;
    }
    button.active { background: var(--surface); color: var(--brand); box-shadow: var(--shadow-sm); }
  `,
  host: { role: 'tablist' },
})
export class FamilyTabs {
  readonly families = input.required<Family[]>();
  readonly selected = model.required<FamilyKey>();
}
