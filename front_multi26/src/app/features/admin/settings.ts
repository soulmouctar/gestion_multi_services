import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { ApiService } from '../../core/api.service';
import { IDLE_TIMEOUT_CHOICES, IdleLogoutService } from '../../core/idle-logout.service';
import { ACCENTS, ThemeService } from '../../core/theme.service';
import { apiError } from '../../shared/format';
import { PageHeader } from '../../shared/page-header';
import { ToastService } from '../../shared/toast.service';

/** Réglages de l'application : déconnexion automatique et thème. */
@Component({
  selector: 'app-admin-settings',
  imports: [PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Administration" title="Paramètres" description="Réglages communs à toute l'organisation, et préférences de ce poste." />

    <section class="card card-pad block">
      <h2 class="section-title">Déconnexion automatique</h2>
      <p class="muted">Délai sans activité au bout duquel chaque utilisateur de l'organisation est déconnecté. Un avertissement s'affiche 30 secondes avant.</p>
      <div class="choices" role="radiogroup" aria-label="Délai de déconnexion automatique">
        @for (minutes of choices; track minutes) {
          <button type="button" role="radio" class="choice" [class.active]="minutes === idle.timeoutMinutes()" [attr.aria-checked]="minutes === idle.timeoutMinutes()" [disabled]="saving()" (click)="choose(minutes)">
            <strong class="num">{{ minutes }}</strong> minutes
          </button>
        }
      </div>
    </section>

    <section class="card card-pad block">
      <h2 class="section-title">Couleur de l'application</h2>
      <p class="muted">La couleur des boutons, du menu et des repères. Le choix est gardé sur cet appareil.</p>
      <div class="choices" role="radiogroup" aria-label="Couleur de l'application">
        @for (accent of accents; track accent.value) {
          <button type="button" role="radio" class="swatch" [class.active]="accent.value === theme.accent()" [attr.aria-checked]="accent.value === theme.accent()" (click)="theme.setAccent(accent.value)">
            <span [style.background]="accent.value"></span> {{ accent.name }}
          </button>
        }
      </div>
    </section>

    <section class="card card-pad block">
      <h2 class="section-title">Thème de ce poste</h2>
      <p class="muted">Le choix est gardé sur cet appareil.</p>
      <div class="choices">
        <button type="button" class="choice" [class.active]="!theme.isDark()" (click)="theme.isDark() && theme.toggle()">Clair</button>
        <button type="button" class="choice" [class.active]="theme.isDark()" (click)="!theme.isDark() && theme.toggle()">Sombre</button>
      </div>
    </section>
  `,
  styles: `
    .block { margin-bottom: 16px; max-width: 760px; }
    .muted { color: var(--text-soft); margin: 4px 0 14px; }
    .choices { display: flex; flex-wrap: wrap; gap: 8px; }
    .choice {
      min-width: 104px; height: 44px; padding: 0 14px;
      border: 1px solid var(--border-strong); border-radius: var(--radius);
      background: var(--surface); color: var(--text);
    }
    .choice:hover:not(:disabled):not(.active) { background: var(--surface-2); }
    .choice.active { border-color: var(--brand); background: var(--brand); color: var(--on-brand); }
    .choice:disabled:not(.active) { opacity: .6; }
    .swatch {
      display: inline-flex; align-items: center; gap: 10px; height: 44px; padding: 0 14px 0 10px;
      border: 1px solid var(--border-strong); border-radius: var(--radius); background: var(--surface); color: var(--text);
    }
    .swatch span { width: 22px; height: 22px; border-radius: 50%; }
    .swatch.active { border-color: var(--brand); box-shadow: 0 0 0 2px var(--brand-soft); font-weight: 600; }
  `,
})
export class Settings {
  readonly #api = inject(ApiService);
  readonly #toast = inject(ToastService);
  protected readonly idle = inject(IdleLogoutService);
  protected readonly theme = inject(ThemeService);

  protected readonly choices = IDLE_TIMEOUT_CHOICES;
  protected readonly accents = ACCENTS;
  protected readonly saving = signal(false);

  protected choose(minutes: number): void {
    if (minutes === this.idle.timeoutMinutes() || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.#api.put<{ minutes: number }>('session-timeout', { minutes }).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.idle.apply(Number(saved.minutes));
        this.#toast.success(`Déconnexion automatique après ${saved.minutes} minutes d'inactivité.`);
      },
      error: (error) => {
        this.saving.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }
}
