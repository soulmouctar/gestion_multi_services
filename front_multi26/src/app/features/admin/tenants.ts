import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, map } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { apiError } from '../../shared/format';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { Pager, paginate } from '../../shared/pager';
import { ToastService } from '../../shared/toast.service';
import { Page } from '../textile/textile.api';
import { ButtonIcon } from '../../shared/button-icon';

interface Tenant {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  subscription_status: 'ACTIVE' | 'SUSPENDED' | string;
  logo_url?: string | null;
  modules?: { id: number }[];
}

interface Module {
  id: number;
  code: string;
  name: string;
}

/** Organisations clientes de la plateforme : création, suspension, modules ouverts. */
@Component({
  selector: 'app-admin-tenants',
  imports: [ReactiveFormsModule, PageHeader, Modal, Pager, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tenants.html',
})
export class Tenants {
  readonly #api = inject(ApiService);
  readonly #toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly tenants = signal<Tenant[]>([]);
  protected readonly search = signal('');
  protected readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    return term ? this.tenants().filter((tenant) => `${tenant.name} ${tenant.phone ?? ''} ${tenant.email ?? ''}`.toLowerCase().includes(term)) : this.tenants();
  });
  protected readonly pager = paginate(this.visible);
  readonly #modules = signal<Module[]>([]);

  protected readonly editing = signal<Tenant | 'new' | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    email: ['', Validators.email],
    phone: [''],
    address: [''],
    subscription_status: ['ACTIVE'],
  });

  /** Organisation dont on règle les modules, et l'état de chaque module. */
  protected readonly modulesFor = signal<Tenant | null>(null);
  protected readonly moduleStates = signal<{ module: Module; active: boolean; busy: boolean }[]>([]);

  constructor() {
    this.load();
    this.#api
      .get<Page<Module>>('modules', { per_page: 100 })
      .pipe(map((page) => page.data))
      .subscribe({ next: (modules) => this.#modules.set(modules), error: () => undefined });
  }

  protected load(): void {
    this.#api
      .get<Page<Tenant>>('tenants', { per_page: 200 })
      .pipe(map((page) => page.data))
      .subscribe({
        next: (tenants) => {
          this.tenants.set(tenants);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.#toast.error(apiError(error, 'Les organisations n\'ont pas pu être chargées.'));
        },
      });
  }

  protected open(tenant: Tenant | 'new'): void {
    this.form.reset(
      tenant === 'new'
        ? { subscription_status: 'ACTIVE' }
        : { name: tenant.name, email: tenant.email ?? '', phone: tenant.phone ?? '', address: tenant.address ?? '', subscription_status: tenant.subscription_status },
    );
    this.editing.set(tenant);
  }

  protected save(): void {
    const target = this.editing();
    if (!target || this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const body = { ...value, email: value.email || null, phone: value.phone || null, address: value.address || null };
    this.saving.set(true);
    (target === 'new' ? this.#api.post('tenants', body) : this.#api.put(`tenants/${target.id}`, body)).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.#toast.success(target === 'new' ? 'Organisation créée.' : 'Organisation modifiée.');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }

  /** Entre dans une organisation : toutes les fenêtres de gestion portent ensuite sur elle. */
  protected manage(tenant: Tenant): void {
    this.#api.get<Module[]>(`tenants/${tenant.id}/modules`).subscribe({
      next: (modules) => {
        this.auth.manage({ id: tenant.id, name: tenant.name, logo_url: tenant.logo_url ?? null, modules: modules.map((module) => module.code) });
        window.location.assign('/dashboard');
      },
      error: (error) => this.#toast.error(apiError(error)),
    });
  }

  protected openModules(tenant: Tenant): void {
    this.modulesFor.set(tenant);
    this.moduleStates.set([]);
    forkJoin([this.#api.get<Module[]>(`tenants/${tenant.id}/modules`)]).subscribe({
      next: ([active]) => {
        const activeIds = new Set(active.map((module) => module.id));
        this.moduleStates.set(this.#modules().map((module) => ({ module, active: activeIds.has(module.id), busy: false })));
      },
      error: (error) => {
        this.modulesFor.set(null);
        this.#toast.error(apiError(error));
      },
    });
  }

  /** Chaque case s'enregistre aussitôt : un module ouvert ou fermé prend effet à la prochaine connexion. */
  protected toggleModule(moduleId: number, active: boolean): void {
    const tenant = this.modulesFor();
    if (!tenant) {
      return;
    }
    const patch = (change: Partial<{ active: boolean; busy: boolean }>) =>
      this.moduleStates.update((states) => states.map((state) => (state.module.id === moduleId ? { ...state, ...change } : state)));

    patch({ busy: true });
    const request = active
      ? this.#api.post(`tenants/${tenant.id}/assign-module`, { module_id: moduleId, is_active: true })
      : this.#api.post(`tenants/${tenant.id}/remove-module`, { module_id: moduleId });
    request.subscribe({
      next: () => patch({ active, busy: false }),
      error: (error) => {
        patch({ busy: false });
        this.#toast.error(apiError(error));
      },
    });
  }
}
