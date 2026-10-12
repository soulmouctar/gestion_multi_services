import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/** Tracés 24×24 au trait, dessinés pour l'application. */
export const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  cart: '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h3l2.6 11.4a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  users: '<path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-6A3.5 3.5 0 0 0 3 18.5V20"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M21 20v-1.5a3.5 3.5 0 0 0-2.5-3.3M15.5 4.2a3.5 3.5 0 0 1 0 6.6"/>',
  truck: '<path d="M1 5h13v11H1zM14 9h4l4 4v3h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5z"/><path d="m2 12 10 5 10-5M2 17l10 5 10-5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5-9 9"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v10a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><path d="M17 14h.01"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  exchange: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  building: '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 10h4a1 1 0 0 1 1 1v10M2 21h20M8 8h3M8 12h3M8 16h3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  logout: '<path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  tire: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.500 6-11 6-11z"/>',
  shirt: '<path d="M8 3 3 6l2 4 2-1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9l2 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.300 19a9 9 0 1 1 17.400 0"/>',
  tag: '<path d="M20.600 13.400 13.400 20.600a2 2 0 0 1-2.800 0L3 13V3h10l7.600 7.600a2 2 0 0 1 0 2.800z"/><circle cx="7.500" cy="7.500" r="1.500"/>',
  ship: '<path d="M3 17h18l-2 4H5z"/><path d="M6 17V9h12v8M9 9V5h6v4M10 13h4"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  bank: '<path d="m3 10 9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18"/>',
  car: '<path d="M5 17H3v-5l2-5h14l2 5v5h-2"/><path d="M9 17h6M3 12h18"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M14 9l2 2"/>',
  door: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18M14 12h.010"/>',
  pin: '<path d="M12 21s7-6.200 7-11a7 7 0 0 0-14 0c0 4.800 7 11 7 11z"/><circle cx="12" cy="10" r="2.500"/>',
  coins: '<circle cx="9" cy="9" r="6"/><path d="M15.500 9.500a6 6 0 1 1-6 9.800"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1"/><path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>',
  wrench: '<path d="M14.500 5.500a4 4 0 0 0-5 5L3 17l4 4 6.500-6.500a4 4 0 0 0 5-5l-2.500 2.500-2.500-1-1-2.500z"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.010M3 12h.010M3 18h.010"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.500"/>',
  idcard: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.600-1.500 5.400-1.500 6 0M15 10h3M15 14h3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.500 6.500 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>',
  printer: '<path d="M7 9V3h10v6M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2"/><path d="M7 14h10v7H7z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.500-3.500"/>',
  eye: '<path d="M2 12s3.600-7 10-7 10 7 10 7-3.600 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.010"/>',
  inbox: '<path d="M3 13h5l1 3h6l1-3h5"/><path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>',
  login: '<path d="M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.600 5.600 12.800 12.800"/>',
  shield: '<path d="m12 3 8 3v6c0 4.500-3.200 8-8 9-4.800-1-8-4.500-8-9V6z"/>',
} as const;

export type IconName = keyof typeof ICONS;

/** Règles d'icône par libellé : la première qui correspond l'emporte. */
const LABEL_ICONS: [RegExp, IconName][] = [
  [/^(nouveau|nouvelle|nouvel|ajouter|produit pris|suivre|encaisser un loyer)/, 'plus'],
  [/^(supprimer|retirer)/, 'trash'],
  [/^(desactiver)/, 'ban'],
  [/^(annuler|fermer|garder)/, 'close'],
  [/imprimer/, 'printer'],
  [/^recu/, 'receipt'],
  [/^facture/, 'file'],
  [/^(photo|joindre|changer le logo)/, 'camera'],
  [/^(modifier|corriger|remplacer)/, 'pencil'],
  [/^ajuster/, 'sliders'],
  [/^(encaisser|paiement)/, 'wallet'],
  [/^(releve|fiche)/, 'list'],
  [/^(afficher|rechercher)/, 'search'],
  [/^voir/, 'eye'],
  [/^(modules|droits)/, 'shield'],
  [/^(gerer|ouvrir|statistiques)/, 'arrow'],
  [/^(se connecter|connexion)/, 'login'],
  [/^(tous les|retour|precedent)/, 'back'],
  [/^suivant/, 'arrow'],
  [/^(enregistrer|creer|porter|marquer|rester|reactiver|livraison)/, 'check'],
];

/** Icône qui convient à un libellé de bouton ou à un titre de fenêtre ; aucune si rien ne correspond. */
export function iconFor(label: string): IconName | null {
  const text = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^[^a-z0-9]+/i, '')
    .trim()
    .toLowerCase();
  return LABEL_ICONS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" [innerHTML]="paths()"
    ></svg>
  `,
  styles: ':host { display: inline-flex; flex-shrink: 0; }',
})
export class Icon {
  readonly #sanitizer = inject(DomSanitizer);

  readonly name = input.required<IconName>();
  readonly size = input(18);

  // Contenu fixe défini ci-dessus, jamais issu d'une saisie
  protected readonly paths = computed(() => this.#sanitizer.bypassSecurityTrustHtml(ICONS[this.name()]));
}
