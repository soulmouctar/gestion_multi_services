import { DOCUMENT } from '@angular/common';
import { inject, Injectable, NgZone, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import Swal from 'sweetalert2';

import { ApiService } from './api.service';
import { AuthService } from './auth.service';

/** Délais d'inactivité proposés dans les paramètres (minutes). */
export const IDLE_TIMEOUT_CHOICES = [2, 3, 5, 10, 15, 30];
/** Délai appliqué tant que l'organisation n'a rien choisi. */
export const DEFAULT_IDLE_TIMEOUT_MINUTES = 5;
/** Délai de prévenance : l'utilisateur est averti avant d'être déconnecté. */
const WARNING_MS = 30 * 1000;
const ACTIVITY_KEY = 'last_activity_at';
const TIMEOUT_KEY = 'idle_timeout_minutes';
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'];

/**
 * Déconnecte l'utilisateur après un délai sans activité, réglé par
 * l'organisation dans les paramètres (5 minutes par défaut).
 *
 * La dernière activité est horodatée dans localStorage : tous les onglets de
 * l'application partagent donc le même compte à rebours (travailler dans un
 * onglet garde les autres ouverts), et un poste sorti de veille est déconnecté
 * dès son réveil si le délai est dépassé.
 */
@Injectable({ providedIn: 'root' })
export class IdleLogoutService {
  readonly #document = inject(DOCUMENT);
  readonly #zone = inject(NgZone);
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);
  readonly #api = inject(ApiService);

  /** Délai en vigueur, en minutes. */
  readonly timeoutMinutes = signal(this.#storedTimeout());

  #ticker?: ReturnType<typeof setInterval>;
  #lastWrite = 0;
  #warningOpen = false;

  readonly #onActivity = () => {
    // Pendant l'avertissement, seul le bouton « Rester connecté » prolonge la session
    if (this.#warningOpen) {
      return;
    }
    const now = Date.now();
    // Une écriture par seconde suffit : inutile de solliciter le stockage à chaque mouvement de souris
    if (now - this.#lastWrite > 1000) {
      this.#lastWrite = now;
      this.#touch(now);
    }
  };

  /** Démarre la surveillance (à l'entrée dans l'espace connecté). */
  start(): void {
    this.stop();
    this.#touch(Date.now());
    this.#loadTimeout();

    // Hors zone Angular : ces événements très fréquents ne doivent pas relancer la détection de changements
    this.#zone.runOutsideAngular(() => {
      for (const event of ACTIVITY_EVENTS) {
        this.#document.addEventListener(event, this.#onActivity, { passive: true, capture: true });
      }
      this.#document.addEventListener('visibilitychange', this.#check);
      this.#document.defaultView?.addEventListener('storage', this.#onStorage);
      this.#ticker = setInterval(this.#check, 5000);
    });
  }

  /** Arrête la surveillance (à la sortie de l'espace connecté). */
  stop(): void {
    for (const event of ACTIVITY_EVENTS) {
      this.#document.removeEventListener(event, this.#onActivity, { capture: true });
    }
    this.#document.removeEventListener('visibilitychange', this.#check);
    this.#document.defaultView?.removeEventListener('storage', this.#onStorage);
    clearInterval(this.#ticker);
    this.#ticker = undefined;
    this.#closeWarning();
  }

  /** Enregistre le délai choisi pour l'organisation et l'applique aussitôt. */
  saveTimeout(minutes: number): Observable<number> {
    return this.#api.put<{ minutes: number }>('session-timeout', { minutes }).pipe(
      map((response) => Number(response.data?.minutes) || minutes),
      tap((saved) => this.#applyTimeout(saved)),
    );
  }

  /** Un autre onglet a changé le délai : celui-ci s'aligne. */
  readonly #onStorage = (event: StorageEvent) => {
    if (event.key === TIMEOUT_KEY) {
      this.#zone.run(() => this.timeoutMinutes.set(this.#storedTimeout()));
    }
  };

  readonly #check = () => {
    if (!this.#auth.isAuthenticated) {
      this.stop();
      return;
    }
    const timeoutMs = this.timeoutMinutes() * 60 * 1000;
    const idle = Date.now() - this.#lastActivity();

    if (idle >= timeoutMs) {
      this.#zone.run(() => this.#expire());
    } else if (idle >= timeoutMs - WARNING_MS) {
      if (!this.#warningOpen) {
        this.#zone.run(() => this.#warn(timeoutMs - idle));
      }
    } else if (this.#warningOpen) {
      // Activité reprise dans un autre onglet : l'avertissement n'a plus lieu d'être
      this.#closeWarning();
    }
  };

  #warn(remainingMs: number): void {
    this.#warningOpen = true;
    Swal.fire({
      icon: 'warning',
      title: 'Toujours là ?',
      html: 'Vous allez être déconnecté pour inactivité dans <b></b> seconde(s).',
      confirmButtonText: 'Rester connecté',
      confirmButtonColor: '#0f3460',
      timer: remainingMs,
      timerProgressBar: true,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: (popup) => {
        const counter = popup.querySelector('b');
        const refresh = () => {
          if (counter) {
            counter.textContent = String(Math.ceil((Swal.getTimerLeft() ?? 0) / 1000));
          }
        };
        refresh();
        const interval = setInterval(refresh, 250);
        (popup as any).__idleInterval = interval;
      },
      willClose: (popup) => clearInterval((popup as any).__idleInterval),
    }).then((result) => {
      if (!this.#warningOpen) {
        return;
      }
      this.#warningOpen = false;
      if (result.isConfirmed) {
        this.#touch(Date.now());
      } else {
        this.#check();
      }
    });
  }

  #closeWarning(): void {
    if (this.#warningOpen) {
      this.#warningOpen = false;
      Swal.close();
    }
  }

  #expire(): void {
    this.stop();
    Swal.close();
    this.#auth.logout();
    this.#router.navigate(['/auth/login'], {
      queryParams: { message: `Vous avez été déconnecté après ${this.timeoutMinutes()} minutes d'inactivité.` },
    });
  }

  /** Le délai de l'organisation fait foi ; la copie locale évite d'attendre le serveur au rechargement. */
  #loadTimeout(): void {
    this.#api.get<{ minutes: number }>('session-timeout', { params: {} }).subscribe({
      next: (response) => this.#applyTimeout(Number(response.data?.minutes)),
      error: () => undefined,
    });
  }

  #applyTimeout(minutes: number): void {
    if (!IDLE_TIMEOUT_CHOICES.includes(minutes)) {
      return;
    }
    this.timeoutMinutes.set(minutes);
    try {
      localStorage.setItem(TIMEOUT_KEY, String(minutes));
    } catch {
      // Stockage indisponible : le délai reste en mémoire
    }
  }

  #storedTimeout(): number {
    try {
      const stored = Number(localStorage.getItem(TIMEOUT_KEY));
      return IDLE_TIMEOUT_CHOICES.includes(stored) ? stored : DEFAULT_IDLE_TIMEOUT_MINUTES;
    } catch {
      return DEFAULT_IDLE_TIMEOUT_MINUTES;
    }
  }

  #lastActivity(): number {
    try {
      return Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
    } catch {
      return this.#lastWrite;
    }
  }

  #touch(timestamp: number): void {
    this.#lastWrite = timestamp;
    try {
      localStorage.setItem(ACTIVITY_KEY, String(timestamp));
    } catch {
      // Stockage indisponible (navigation privée stricte) : on garde l'horodatage en mémoire
    }
  }
}
