import { DOCUMENT } from '@angular/common';
import { inject, Injectable, NgZone, signal } from '@angular/core';

import { ApiService } from './api.service';
import { AuthService } from './auth.service';

/** Délais proposés dans les paramètres de l'organisation (minutes). */
export const IDLE_TIMEOUT_CHOICES = [2, 3, 5, 10, 15, 30];
const DEFAULT_TIMEOUT_MINUTES = 5;
const WARNING_SECONDS = 30;
const ACTIVITY_KEY = 'last_activity_at';
const TIMEOUT_KEY = 'idle_timeout_minutes';
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'];

/**
 * Déconnecte après un délai sans activité, réglé par l'organisation.
 *
 * La dernière activité est horodatée dans localStorage : tous les onglets
 * partagent le même compte à rebours, et un poste sorti de veille est
 * déconnecté dès son réveil si le délai est dépassé.
 */
@Injectable({ providedIn: 'root' })
export class IdleLogoutService {
  readonly #document = inject(DOCUMENT);
  readonly #zone = inject(NgZone);
  readonly #auth = inject(AuthService);
  readonly #api = inject(ApiService);

  readonly timeoutMinutes = signal(this.#storedTimeout());
  /** Secondes restantes pendant l'avertissement ; null hors avertissement. */
  readonly warningSeconds = signal<number | null>(null);

  #ticker?: ReturnType<typeof setInterval>;
  #lastWrite = 0;

  readonly #onActivity = () => {
    // Pendant l'avertissement, seul « Rester connecté » prolonge la session
    if (this.warningSeconds() !== null) {
      return;
    }
    const now = Date.now();
    if (now - this.#lastWrite > 1000) {
      this.#touch(now);
    }
  };

  start(): void {
    this.stop();
    this.#touch(Date.now());
    this.#api.get<{ minutes: number }>('session-timeout').subscribe({
      next: ({ minutes }) => this.#applyTimeout(Number(minutes)),
      error: () => undefined,
    });

    // Hors zone Angular : ces événements très fréquents ne doivent pas relancer l'affichage
    this.#zone.runOutsideAngular(() => {
      for (const event of ACTIVITY_EVENTS) {
        this.#document.addEventListener(event, this.#onActivity, { passive: true, capture: true });
      }
      this.#document.addEventListener('visibilitychange', this.#check);
      this.#ticker = setInterval(this.#check, 1000);
    });
  }

  stop(): void {
    for (const event of ACTIVITY_EVENTS) {
      this.#document.removeEventListener(event, this.#onActivity, { capture: true });
    }
    this.#document.removeEventListener('visibilitychange', this.#check);
    clearInterval(this.#ticker);
    this.#ticker = undefined;
    this.warningSeconds.set(null);
  }

  stayConnected(): void {
    this.warningSeconds.set(null);
    this.#touch(Date.now());
  }

  readonly #check = () => {
    if (!this.#auth.isAuthenticated()) {
      this.stop();
      return;
    }
    const remaining = Math.ceil((this.timeoutMinutes() * 60_000 - (Date.now() - this.#lastActivity())) / 1000);
    const warning = remaining <= 0 ? -1 : remaining <= WARNING_SECONDS ? remaining : null;

    if (warning === this.warningSeconds()) {
      return;
    }
    this.#zone.run(() => {
      if (warning === -1) {
        const minutes = this.timeoutMinutes();
        this.stop();
        this.#auth.logout({ reason: 'idle', minutes });
      } else {
        this.warningSeconds.set(warning);
      }
    });
  };

  /** Applique le délai choisi dans les paramètres. */
  apply(minutes: number): void {
    this.#applyTimeout(minutes);
  }

  #applyTimeout(minutes: number): void {
    if (!IDLE_TIMEOUT_CHOICES.includes(minutes)) {
      return;
    }
    this.timeoutMinutes.set(minutes);
    try {
      localStorage.setItem(TIMEOUT_KEY, String(minutes));
    } catch {
      // le délai reste en mémoire
    }
  }

  #storedTimeout(): number {
    try {
      const stored = Number(localStorage.getItem(TIMEOUT_KEY));
      return IDLE_TIMEOUT_CHOICES.includes(stored) ? stored : DEFAULT_TIMEOUT_MINUTES;
    } catch {
      return DEFAULT_TIMEOUT_MINUTES;
    }
  }

  #lastActivity(): number {
    try {
      return Number(localStorage.getItem(ACTIVITY_KEY)) || this.#lastWrite;
    } catch {
      return this.#lastWrite;
    }
  }

  #touch(timestamp: number): void {
    this.#lastWrite = timestamp;
    try {
      localStorage.setItem(ACTIVITY_KEY, String(timestamp));
    } catch {
      // l'horodatage reste en mémoire
    }
  }
}
