import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';

/** Couleurs d'accent proposées dans les paramètres. */
export const ACCENTS: { name: string; value: string }[] = [
  { name: 'Bleu marine', value: '#0f3460' },
  { name: 'Bleu', value: '#1d4ed8' },
  { name: 'Émeraude', value: '#047857' },
  { name: 'Violet', value: '#6d28d9' },
  { name: 'Bordeaux', value: '#9f1239' },
  { name: 'Orange', value: '#c2410c' },
  { name: 'Ardoise', value: '#334155' },
];
const ACCENT_KEY = 'accent_color';

export type ThemeMode = 'auto' | 'clair' | 'sombre';
const THEME_KEY = 'theme_mode';

/** Mode clair / sombre. Le thème initial est posé par index.html avant l'affichage. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly #document = inject(DOCUMENT);
  readonly #system = this.#document.defaultView?.matchMedia('(prefers-color-scheme: dark)');
  readonly #systemDark = signal(this.#system?.matches ?? false);

  readonly mode = signal<ThemeMode>(this.#stored());
  /** Couleur d'accent de ce poste. */
  readonly accent = signal(this.#storedAccent());
  readonly isDark = computed(() => this.mode() === 'sombre' || (this.mode() === 'auto' && this.#systemDark()));

  constructor() {
    this.#system?.addEventListener('change', (event) => {
      this.#systemDark.set(event.matches);
      this.#apply();
    });
  }

  setAccent(value: string): void {
    if (!ACCENTS.some((accent) => accent.value === value)) {
      return;
    }
    this.accent.set(value);
    this.#document.documentElement.style.setProperty('--accent', value);
    try {
      localStorage.setItem(ACCENT_KEY, value);
    } catch {
      // le choix reste valable pour cette visite
    }
  }

  #storedAccent(): string {
    try {
      const stored = localStorage.getItem(ACCENT_KEY);
      return ACCENTS.some((accent) => accent.value === stored) ? stored! : ACCENTS[0].value;
    } catch {
      return ACCENTS[0].value;
    }
  }

  toggle(): void {
    this.mode.set(this.isDark() ? 'clair' : 'sombre');
    try {
      localStorage.setItem(THEME_KEY, this.mode());
    } catch {
      // le choix reste valable pour cette visite
    }
    this.#apply();
  }

  #apply(): void {
    this.#document.documentElement.setAttribute('data-theme', this.isDark() ? 'dark' : 'light');
  }

  #stored(): ThemeMode {
    try {
      const mode = localStorage.getItem(THEME_KEY);
      return mode === 'clair' || mode === 'sombre' ? mode : 'auto';
    } catch {
      return 'auto';
    }
  }
}
