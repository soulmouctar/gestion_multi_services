import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { ColorModeService } from '@coreui/angular';

export type ThemeMode = 'light' | 'dark' | 'auto';

/** Cle de stockage du choix de theme ; reprise telle quelle par le script de index.html. */
export const THEME_STORAGE_KEY = 'coreui-free-angular-admin-template-theme-default';

/**
 * Pilote le theme clair / sombre / automatique.
 * CoreUI (ColorModeService) persiste le choix et pose data-coreui-theme sur <html> ;
 * ce service ajoute le suivi du theme systeme en mode automatique et une bascule sans a-coup.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly #document = inject(DOCUMENT);
  readonly #colorModeService = inject(ColorModeService);
  #switchTimer?: ReturnType<typeof setTimeout>;

  /** Choix de l'utilisateur : clair, sombre ou automatique. */
  readonly mode = computed<ThemeMode>(() => (this.#colorModeService.colorMode() as ThemeMode) ?? 'auto');

  /** Theme reellement affiche (le mode automatique est resolu). */
  readonly #resolved = signal<'light' | 'dark'>('light');
  readonly isDark = computed(() => this.#resolved() === 'dark');

  init(): void {
    const root = this.#document.documentElement;
    const eventName = 'ColorSchemeChange';

    this.#colorModeService.localStorageItemName.set(THEME_STORAGE_KEY);
    this.#colorModeService.eventName.set(eventName);

    const sync = () => this.#resolved.set(root.dataset['coreuiTheme'] === 'dark' ? 'dark' : 'light');
    root.addEventListener(eventName, sync);
    sync();

    // Mode automatique : suivre le systeme en direct (passage jour/nuit de l'OS)
    this.#document.defaultView
      ?.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (event) => {
        if (this.mode() !== 'auto') {
          return;
        }
        this.#animate();
        root.dataset['coreuiTheme'] = event.matches ? 'dark' : 'light';
        root.dispatchEvent(new Event(eventName));
      });
  }

  setMode(mode: ThemeMode): void {
    if (mode === this.#colorModeService.colorMode()) {
      return;
    }
    this.#animate();
    this.#colorModeService.colorMode.set(mode);
  }

  /** Fondu des couleurs le temps de la bascule (voir .theme-switching dans _dark.scss). */
  #animate(): void {
    const root = this.#document.documentElement;
    root.classList.add('theme-switching');
    clearTimeout(this.#switchTimer);
    this.#switchTimer = setTimeout(() => root.classList.remove('theme-switching'), 300);
  }
}
