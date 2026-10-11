import { DOCUMENT } from '@angular/common';
import { inject, Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

import { AuthService } from './auth.service';

/** Durée d'inactivité avant déconnexion automatique. */
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
/** Délai de prévenance : l'utilisateur est averti avant d'être déconnecté. */
const WARNING_MS = 30 * 1000;
const ACTIVITY_KEY = 'last_activity_at';
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'];

/**
 * Déconnecte l'utilisateur après 5 minutes sans activité.
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

    // Hors zone Angular : ces événements très fréquents ne doivent pas relancer la détection de changements
    this.#zone.runOutsideAngular(() => {
      for (const event of ACTIVITY_EVENTS) {
        this.#document.addEventListener(event, this.#onActivity, { passive: true, capture: true });
      }
      this.#document.addEventListener('visibilitychange', this.#check);
      this.#ticker = setInterval(this.#check, 5000);
    });
  }

  /** Arrête la surveillance (à la sortie de l'espace connecté). */
  stop(): void {
    for (const event of ACTIVITY_EVENTS) {
      this.#document.removeEventListener(event, this.#onActivity, { capture: true });
    }
    this.#document.removeEventListener('visibilitychange', this.#check);
    clearInterval(this.#ticker);
    this.#ticker = undefined;
    this.#closeWarning();
  }

  readonly #check = () => {
    if (!this.#auth.isAuthenticated) {
      this.stop();
      return;
    }
    const idle = Date.now() - this.#lastActivity();

    if (idle >= IDLE_TIMEOUT_MS) {
      this.#zone.run(() => this.#expire());
    } else if (idle >= IDLE_TIMEOUT_MS - WARNING_MS) {
      if (!this.#warningOpen) {
        this.#zone.run(() => this.#warn(IDLE_TIMEOUT_MS - idle));
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
      queryParams: { message: 'Vous avez été déconnecté après 5 minutes d\'inactivité.' },
    });
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
