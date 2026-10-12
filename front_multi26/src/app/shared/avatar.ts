import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/** Photo d'une personne, d'un produit ou d'une organisation ; à défaut, ses initiales. */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (src() && !broken()) {
      <img [src]="src()" alt="" loading="lazy" (error)="broken.set(true)" />
    } @else {
      <span aria-hidden="true">{{ initials() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      flex-shrink: 0;
      overflow: hidden;
      border-radius: 50%;
      background: var(--brand-soft);
      color: var(--brand);
      font-weight: 600;
    }
    :host(.square) { border-radius: var(--radius); }
    img { width: 100%; height: 100%; object-fit: cover; display: block; }
  `,
  host: {
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.font-size.px]': 'size() * 0.38',
    '[class.square]': 'square()',
  },
})
export class Avatar {
  readonly name = input('');
  readonly src = input<string | null | undefined>(null);
  readonly size = input(36);
  /** Coins arrondis plutôt que rond : pour un produit ou un logo. */
  readonly square = input(false);

  /** Une image introuvable laisse place aux initiales, au lieu d'une icône cassée. */
  protected readonly broken = signal(false);
  protected readonly initials = computed(() =>
    this.name()
      .split(/[\s-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join(''),
  );
}
