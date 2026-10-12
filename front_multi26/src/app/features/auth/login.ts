import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { ButtonIcon } from '../../shared/button-icon';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);

  /** Raison du retour à la connexion, transmise dans l'adresse. */
  readonly reason = input<string>();
  readonly minutes = input<string>();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly sending = signal(false);
  protected readonly error = signal('');
  protected readonly showPassword = signal(false);

  protected readonly notice = computed(() => {
    if (this.reason() === 'idle') {
      return `Vous avez été déconnecté après ${this.minutes() ?? 5} minutes d'inactivité.`;
    }
    return this.reason() === 'session' ? 'Votre session a expiré. Reconnectez-vous.' : '';
  });

  protected submit(): void {
    if (this.form.invalid || this.sending()) {
      this.form.markAllAsTouched();
      return;
    }
    this.sending.set(true);
    this.error.set('');
    const { email, password } = this.form.getRawValue();

    this.#auth.login(email, password).subscribe({
      next: () => this.#router.navigate(['/dashboard']),
      error: (response: HttpErrorResponse) => {
        this.sending.set(false);
        this.error.set(this.#message(response));
      },
    });
  }

  #message(response: HttpErrorResponse): string {
    if (response.status === 0) {
      return 'Le serveur ne répond pas. Vérifiez votre connexion.';
    }
    if (response.status === 401 || response.status === 422) {
      return 'Adresse e-mail ou mot de passe incorrect.';
    }
    if (response.status === 429) {
      return 'Trop de tentatives. Patientez une minute avant de réessayer.';
    }
    return response.error?.message || 'La connexion a échoué. Réessayez.';
  }
}
