import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { apiError } from '../../shared/format';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { Pager, paginate } from '../../shared/pager';
import { ToastService } from '../../shared/toast.service';
import { Page } from '../textile/textile.api';
import { ButtonIcon } from '../../shared/button-icon';

interface UserRow {
  id: number;
  name: string;
  email: string;
  is_active: boolean | number | null;
  roles: { name: string }[];
}

interface ModuleRight {
  module_code: string;
  module_name: string;
  is_active: boolean;
  permissions: string[];
}

const ROLE_LABELS: Record<string, string> = { SUPER_ADMIN: 'Super administrateur', ADMIN: 'Administrateur', USER: 'Utilisateur' };

/** Comptes de l'organisation : création, rôle, activation. */
@Component({
  selector: 'app-admin-users',
  imports: [ReactiveFormsModule, PageHeader, Modal, Pager, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Administration" title="Utilisateurs" description="Les personnes qui peuvent se connecter à l'application.">
      <button class="btn btn-primary" type="button" (click)="open()">Nouvel utilisateur</button>
    </app-page-header>

    <section class="card">
      <div class="toolbar">
        <div class="field">
          <label for="user-search">Rechercher</label>
          <input id="user-search" class="input" type="search" #term placeholder="Nom ou adresse e-mail" (input)="search.set(term.value)" />
        </div>
      </div>
      @if (loading()) {
        <div class="empty">Chargement…</div>
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>Nom</th><th>Adresse e-mail</th><th>Rôle</th><th>État</th><th></th></tr>
            </thead>
            <tbody>
              @for (user of pager.rows(); track user.id) {
                <tr>
                  <td class="strong">{{ user.name }}</td>
                  <td>{{ user.email }}</td>
                  <td>{{ roleLabel(user) }}</td>
                  <td>
                    <span class="badge" [class.is-success]="active(user)" [class.is-danger]="!active(user)">{{ active(user) ? 'Actif' : 'Désactivé' }}</span>
                  </td>
                  <td class="actions">
                    @if (roleOf(user) === 'USER') {
                      <button class="btn btn-sm" type="button" (click)="openRights(user)">Droits</button>
                    }
                    @if (user.id !== me) {
                      <button class="btn btn-sm" type="button" [disabled]="busy() === user.id" (click)="toggle(user)">
                        {{ active(user) ? 'Désactiver' : 'Réactiver' }}
                      </button>
                    } @else {
                      <span class="muted">votre compte</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [state]="pager" />
      }
    </section>

    @if (rightsFor(); as user) {
      <app-modal [title]="'Droits de ' + user.name" subtitle="Les modules cochés apparaissent dans son menu." (closed)="rightsFor.set(null)">
        @if (rights(); as list) {
          <div class="rights">
            @for (right of list; track right.module_code) {
              <label class="check"><input type="checkbox" [checked]="right.is_active" (change)="setRight(right.module_code, $any($event.target).checked)" /> {{ right.module_name }}</label>
            } @empty {
              <p class="muted">Aucun module n'est activé pour l'organisation.</p>
            }
          </div>
        } @else {
          <div class="empty">Chargement…</div>
        }
        <ng-container modal-footer>
          <button class="btn" type="button" (click)="rightsFor.set(null)">Annuler</button>
          <button class="btn btn-primary" type="button" [disabled]="saving() || !rights()" (click)="saveRights()">Enregistrer</button>
        </ng-container>
      </app-modal>
    }

    @if (creating()) {
      <app-modal title="Nouvel utilisateur" (closed)="creating.set(false)">
        <form id="user-form" class="form-grid" [formGroup]="form" (ngSubmit)="save()">
          <div class="field full">
            <label for="user-name">Nom complet *</label>
            <input id="user-name" class="input" formControlName="name" autocomplete="off" />
          </div>
          <div class="field full">
            <label for="user-email">Adresse e-mail *</label>
            <input id="user-email" class="input" type="email" formControlName="email" autocomplete="off" />
          </div>
          <div class="field">
            <label for="user-password">Mot de passe provisoire *</label>
            <input id="user-password" class="input" type="password" formControlName="password" autocomplete="new-password" />
            <span class="hint">8 caractères au minimum.</span>
          </div>
          <div class="field">
            <label for="user-role">Rôle</label>
            <select id="user-role" class="input" formControlName="role">
              <option value="USER">Utilisateur</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </div>
        </form>
        <ng-container modal-footer>
          <button class="btn" type="button" (click)="creating.set(false)">Annuler</button>
          <button class="btn btn-primary" type="submit" form="user-form" [disabled]="saving()">Créer le compte</button>
        </ng-container>
      </app-modal>
    }
  `,
  styles: '.rights { display: grid; gap: 12px; } .rights .check { font-size: 14px; color: var(--text); }',
})
export class Users {
  readonly #api = inject(ApiService);
  readonly #toast = inject(ToastService);
  protected readonly me = inject(AuthService).user()?.id;

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly busy = signal<number | null>(null);
  protected readonly creating = signal(false);
  protected readonly users = signal<UserRow[]>([]);
  protected readonly search = signal('');
  protected readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    return term ? this.users().filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(term)) : this.users();
  });
  protected readonly pager = paginate(this.visible);

  // --- Droits par module -----------------------------------------------------
  protected readonly rightsFor = signal<UserRow | null>(null);
  protected readonly rights = signal<ModuleRight[] | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['USER'],
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.#api
      .get<Page<UserRow>>('users', { per_page: 200 })
      .pipe(map((page) => page.data))
      .subscribe({
        next: (users) => {
          this.users.set(users);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.#toast.error(apiError(error, 'Les utilisateurs n\'ont pas pu être chargés.'));
        },
      });
  }

  protected active(user: UserRow): boolean {
    return user.is_active === null || user.is_active === undefined || !!Number(user.is_active);
  }

  protected roleLabel(user: UserRow): string {
    const role = user.roles?.[0]?.name ?? '';
    return ROLE_LABELS[role] ?? role;
  }

  protected roleOf(user: UserRow): string {
    return user.roles?.[0]?.name ?? '';
  }

  protected openRights(user: UserRow): void {
    this.rightsFor.set(user);
    this.rights.set(null);
    this.#api.get<ModuleRight[]>(`users/${user.id}/module-permissions`).subscribe({
      next: (rights) => this.rights.set(rights),
      error: (error) => {
        this.rightsFor.set(null);
        this.#toast.error(apiError(error));
      },
    });
  }

  protected setRight(code: string, active: boolean): void {
    this.rights.update((list) => list?.map((right) => (right.module_code === code ? { ...right, is_active: active } : right)) ?? null);
  }

  protected saveRights(): void {
    const user = this.rightsFor();
    const rights = this.rights();
    if (!user || !rights || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.#api
      .post(`users/${user.id}/module-permissions`, {
        module_permissions: rights.map((right) => ({
          module_code: right.module_code,
          module_name: right.module_name,
          is_active: right.is_active,
          // Un module ouvert l'est entièrement : consulter, créer, modifier, supprimer
          permissions: right.is_active ? ['view', 'create', 'edit', 'delete'] : [],
        })),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.rightsFor.set(null);
          this.#toast.success(`Droits de ${user.name} enregistrés. Ils s'appliquent à sa prochaine connexion.`);
        },
        error: (error) => {
          this.saving.set(false);
          this.#toast.error(apiError(error));
        },
      });
  }

  protected open(): void {
    this.form.reset({ role: 'USER' });
    this.creating.set(true);
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.#api.post('users', this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.creating.set(false);
        this.#toast.success('Compte créé. Transmettez le mot de passe provisoire à la personne.');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }

  protected toggle(user: UserRow): void {
    this.busy.set(user.id);
    this.#api.post(`users/${user.id}/toggle-status`, {}).subscribe({
      next: () => {
        this.busy.set(null);
        this.#toast.success(this.active(user) ? `${user.name} ne peut plus se connecter.` : `${user.name} peut de nouveau se connecter.`);
        this.load();
      },
      error: (error) => {
        this.busy.set(null);
        this.#toast.error(apiError(error));
      },
    });
  }
}
