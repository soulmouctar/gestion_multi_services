import { AfterViewInit, Directive, ElementRef, inject, input, OnDestroy } from '@angular/core';

import { iconFor, IconName, ICONS } from './icon';

const SVG = 'http://www.w3.org/2000/svg';

/**
 * Donne son icône à chaque bouton de l'application.
 *
 * L'icône se déduit du libellé (« Nouveau… » → plus, « Imprimer » → imprimante, « Supprimer » → corbeille…),
 * pour que le même geste porte la même icône partout. `icon="nom"` l'impose, `icon="none"` l'enlève.
 */
@Directive({ selector: '.btn' })
export class ButtonIcon implements AfterViewInit, OnDestroy {
  readonly icon = input<IconName | 'none' | undefined>();

  readonly #host: HTMLElement = inject(ElementRef).nativeElement;
  #observer?: MutationObserver;
  #svg?: SVGElement;
  #shown: string | null = null;

  ngAfterViewInit(): void {
    this.#render();
    // Un libellé peut changer (« Enregistrer » → « Envoi… ») : l'icône suit
    this.#observer = new MutationObserver(() => this.#render());
    this.#observer.observe(this.#host, { childList: true, characterData: true, subtree: true });
  }

  ngOnDestroy(): void {
    this.#observer?.disconnect();
  }

  #render(): void {
    // Un bouton qui porte déjà une icône dans son gabarit garde la sienne
    if (this.#host.querySelector('app-icon')) {
      return;
    }
    const wanted = this.icon();
    const name = wanted === 'none' ? null : (wanted ?? iconFor(this.#host.textContent ?? ''));
    if (name === this.#shown) {
      return;
    }
    this.#svg?.remove();
    this.#svg = undefined;
    this.#shown = name;
    if (!name) {
      return;
    }
    const small = this.#host.classList.contains('btn-sm');
    const svg = document.createElementNS(SVG, 'svg');
    for (const [key, value] of Object.entries({
      width: small ? '14' : '16',
      height: small ? '14' : '16',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.9',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    })) {
      svg.setAttribute(key, value);
    }
    // Tracés fixes de l'application, jamais issus d'une saisie
    svg.innerHTML = ICONS[name];
    this.#host.insertBefore(svg, this.#host.firstChild);
    this.#svg = svg;
  }
}
