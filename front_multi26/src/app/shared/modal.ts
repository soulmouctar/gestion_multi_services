import { ChangeDetectionStrategy, Component, computed, HostListener, input, output } from '@angular/core';

import { Icon, iconFor, IconName } from './icon';

/** Fenêtre de saisie ou de détail : icône, titre, contenu, pied avec les actions. */
@Component({
  selector: 'app-modal',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    <section class="dialog card" [class.wide]="wide()" role="dialog" aria-modal="true" [attr.aria-label]="title()">
      <header>
        <span class="chip" [class.danger]="danger()"><app-icon [name]="shownIcon()" [size]="19" /></span>
        <div class="titles">
          <h2>{{ title() }}</h2>
          @if (subtitle()) {
            <p>{{ subtitle() }}</p>
          }
        </div>
        <button class="close" type="button" aria-label="Fermer" (click)="closed.emit()"><app-icon name="close" [size]="18" /></button>
      </header>
      <div class="body"><ng-content /></div>
      <footer><ng-content select="[modal-footer]" /></footer>
    </section>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: grid;
      place-items: center;
      padding: 16px;
    }
    .backdrop { position: absolute; inset: 0; background: rgba(10, 16, 26, .55); backdrop-filter: blur(2px); animation: fade .18s ease both; }
    .dialog {
      position: relative;
      width: min(580px, 100%);
      max-height: calc(100vh - 32px);
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 60px rgba(10, 16, 26, .28);
      animation: rise .22s cubic-bezier(.2, .8, .2, 1) both;
    }
    .dialog.wide { width: min(900px, 100%); }
    header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px 20px;
      border-bottom: 1px solid var(--border);
      background: var(--surface-2);
    }
    .chip {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: 11px;
      background: var(--brand);
      color: var(--on-brand);
    }
    .chip.danger { background: var(--danger-soft); color: var(--danger); }
    .titles { flex: 1; min-width: 0; }
    h2 { font-size: 16.5px; font-weight: 700; letter-spacing: -.01em; }
    header p { margin-top: 2px; font-size: 13px; color: var(--text-soft); }
    .close {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 34px;
      height: 34px;
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: var(--text-soft);
    }
    .close:hover { background: var(--surface-3); color: var(--text); }
    .body { padding: 22px 20px; overflow-y: auto; }
    footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 20px;
      border-top: 1px solid var(--border);
      background: var(--surface-2);
    }
    footer:empty { display: none; }
    @keyframes fade { from { opacity: 0; } }
    @keyframes rise { from { opacity: 0; transform: translateY(10px) scale(.985); } }
    @media (prefers-reduced-motion: reduce) { .backdrop, .dialog { animation: none; } }
  `,
})
export class Modal {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly wide = input(false);
  /** Icône de l'en-tête ; à défaut, elle se déduit du titre. */
  readonly icon = input<IconName>();
  readonly closed = output<void>();

  protected readonly shownIcon = computed<IconName>(() => this.icon() ?? iconFor(this.title()) ?? 'file');
  /** Une fenêtre de suppression ou d'annulation s'annonce en rouge. */
  protected readonly danger = computed(() => /^(supprimer|annuler|confirmer la suppression)/i.test(this.title()));

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closed.emit();
  }
}
