import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { apiError } from '../../shared/format';
import { compressImage } from '../../shared/image-compression';
import { PageHeader } from '../../shared/page-header';
import { ToastService } from '../../shared/toast.service';
import { ButtonIcon } from '../../shared/button-icon';

interface Tenant {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
}

/** Identité de l'entreprise : nom, coordonnées, logo. */
@Component({
  selector: 'app-admin-organisation',
  imports: [ReactiveFormsModule, PageHeader, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Administration" title="Organisation" description="Ces informations figurent sur les reçus et les relevés." />

    <section class="card card-pad" style="max-width: 760px">
      @if (loading()) {
        <div class="empty">Chargement…</div>
      } @else {
        <div class="logo-row">
          <div class="logo">
            @if (logoUrl()) {
              <img [src]="logoUrl()" alt="Logo de l'organisation" />
            } @else {
              <span>Aucun logo</span>
            }
          </div>
          <label class="btn">
            Changer le logo
            <input #picker type="file" accept="image/*" hidden (change)="pickLogo(picker)" />
          </label>
        </div>

        <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
          <div class="field full">
            <label for="org-name">Nom de l'entreprise *</label>
            <input id="org-name" class="input" formControlName="name" />
          </div>
          <div class="field">
            <label for="org-phone">Téléphone</label>
            <input id="org-phone" class="input" formControlName="phone" />
          </div>
          <div class="field">
            <label for="org-email">Adresse e-mail</label>
            <input id="org-email" class="input" type="email" formControlName="email" />
          </div>
          <div class="field full">
            <label for="org-address">Adresse</label>
            <input id="org-address" class="input" formControlName="address" />
          </div>
          <div class="full"><button class="btn btn-primary" type="submit" [disabled]="saving()">Enregistrer</button></div>
        </form>
      }
    </section>
  `,
  styles: `
    .logo-row { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
    .logo {
      display: grid; place-items: center; width: 132px; height: 76px; padding: 6px;
      border: 1px solid var(--border); border-radius: var(--radius); background: #fff;
      color: var(--text-muted); font-size: 12px;
    }
    .logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
    label.btn { cursor: pointer; }
  `,
})
export class Organisation {
  readonly #api = inject(ApiService);
  readonly #toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly logoUrl = signal<string | null>(null);
  #logo: File | null = null;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    phone: [''],
    email: ['', Validators.email],
    address: [''],
  });

  constructor() {
    this.#api.get<Tenant | null>('organisation/tenant').subscribe({
      next: (tenant) => {
        if (tenant) {
          this.form.reset({ name: tenant.name, phone: tenant.phone ?? '', email: tenant.email ?? '', address: tenant.address ?? '' });
          this.logoUrl.set(tenant.logo_url);
        }
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.#toast.error(apiError(error, 'L\'organisation n\'a pas pu être chargée.'));
      },
    });
  }

  protected async pickLogo(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    // Le logo garde son format (la transparence d'un PNG compte) s'il est déjà léger
    this.#logo = file.size > 400 * 1024 ? await compressImage(file) : file;
    this.logoUrl.set(URL.createObjectURL(this.#logo));
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const body = new FormData();
    // Laravel ne lit un envoi de fichier qu'en POST : la méthode réelle est précisée à part
    body.append('_method', 'PUT');
    for (const [key, value] of Object.entries(this.form.getRawValue())) {
      body.append(key, value);
    }
    if (this.#logo) {
      body.append('logo', this.#logo);
    }

    this.saving.set(true);
    this.#api.post<Tenant>('organisation/tenant', body).subscribe({
      next: () => {
        this.saving.set(false);
        this.#logo = null;
        this.#toast.success('Organisation mise à jour.');
      },
      error: (error) => {
        this.saving.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }
}
