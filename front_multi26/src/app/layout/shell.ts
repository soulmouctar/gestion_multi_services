import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ApiService } from '../core/api.service';
import { AuthService, ManagedTenant } from '../core/auth.service';
import { IdleLogoutService } from '../core/idle-logout.service';
import { ThemeService } from '../core/theme.service';
import { findWindow, MODULES } from '../core/windows';
import { Avatar } from '../shared/avatar';
import { Icon } from '../shared/icon';
import { ToastService } from '../shared/toast.service';
import { ButtonIcon } from '../shared/button-icon';

const MENU_KEY = 'menu_groups';

/** Coquille de l'espace connecté : menu latéral, barre supérieure, contenu. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Avatar, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly idle = inject(IdleLogoutService);
  protected readonly toasts = inject(ToastService);

  protected readonly menuOpen = signal(false);

  /** Modules dépliés dans le menu ; le choix est gardé sur le poste. */
  protected readonly expanded = signal<Record<string, boolean>>(this.#storedGroups());
  readonly #router = inject(Router);
  readonly #api = inject(ApiService);

  // --- Organisation gérée par le super administrateur ----------------------
  protected readonly tenants = signal<{ id: number; name: string; logo_url?: string | null }[]>([]);
  protected readonly switching = signal(false);
  readonly #url = signal(this.#router.url);
  /** Vrai quand la fenêtre demandée a besoin d'une organisation et qu'aucune n'est choisie. */
  protected readonly needsTenant = computed(() => {
    if (!this.auth.isSuperAdmin() || this.auth.managedTenant()) {
      return false;
    }
    const path = this.#url().split('?')[0].replace(/^\//, '');
    return !findWindow(path)?.window.superAdminOnly;
  });

  /** Le menu ne montre que les fenêtres permises au rôle. */
  protected readonly modules = computed(() =>
    MODULES.map((module) => ({
      ...module,
      windows: module.windows.filter((window) => this.auth.canOpen(window)),
    })).filter((module) => module.windows.length > 0),
  );

  /** Logo de l'organisation affichée ; à défaut, celui de l'application. */
  protected readonly logoUrl = computed(() => this.auth.managedTenant()?.logo_url || this.auth.user()?.tenant?.logo_url || 'images/logo.png');

  /**
   * Change l'organisation gérée. La page est rechargée : toutes les listes déjà affichées
   * appartiennent à l'ancienne organisation et ne doivent pas rester à l'écran.
   */
  protected manage(tenantId: string): void {
    const tenant = this.tenants().find((candidate) => candidate.id === Number(tenantId));
    if (!tenant) {
      this.auth.manage(null);
      window.location.assign('/admin/tenants');
      return;
    }
    this.switching.set(true);
    this.#api.get<{ code: string }[]>(`tenants/${tenant.id}/modules`).subscribe({
      next: (modules) => this.#apply({ id: tenant.id, name: tenant.name, logo_url: tenant.logo_url ?? null, modules: modules.map((module) => module.code) }),
      error: () => this.switching.set(false),
    });
  }

  #apply(tenant: ManagedTenant): void {
    this.auth.manage(tenant);
    window.location.assign('/dashboard');
  }

  protected toggleGroup(id: string): void {
    this.expanded.update((groups) => ({ ...groups, [id]: !groups[id] }));
    try {
      localStorage.setItem(MENU_KEY, JSON.stringify(this.expanded()));
    } catch {
      // le menu reste utilisable, sans mémoire du choix
    }
  }

  /** Déplie le module de la fenêtre affichée, pour que la ligne active soit toujours visible. */
  #revealActive(url: string): void {
    const module = MODULES.find((candidate) => candidate.windows.some((window) => url.startsWith('/' + window.path)));
    if (module && !this.expanded()[module.id]) {
      this.expanded.update((groups) => ({ ...groups, [module.id]: true }));
    }
  }

  #storedGroups(): Record<string, boolean> {
    try {
      return JSON.parse(localStorage.getItem(MENU_KEY) ?? '{}') ?? {};
    } catch {
      return {};
    }
  }

  #navigation?: { unsubscribe(): void };

  ngOnInit(): void {
    this.idle.start();
    if (this.auth.isSuperAdmin()) {
      this.#api.get<{ data: { id: number; name: string; logo_url?: string | null }[] }>('tenants', { per_page: 500 }).subscribe({
        next: (page) => this.tenants.set(page.data),
        error: () => undefined,
      });
    }
    this.#revealActive(this.#router.url);
    this.#navigation = this.#router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.#url.set(event.urlAfterRedirects);
        this.#revealActive(event.urlAfterRedirects);
      }
    });
  }

  ngOnDestroy(): void {
    this.idle.stop();
    this.#navigation?.unsubscribe();
  }
}
