import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';

import { environment } from '../../environments/environment';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  tenant_id: number | null;
  role?: string | null;
  roles?: { name: string }[];
  avatar_url?: string | null;
  tenant?: { id: number; name: string; logo_url?: string | null } | null;
  /** Codes des modules ouverts à cet utilisateur ; absent pour une session ouverte avant ce réglage. */
  modules?: string[];
}

interface LoginPayload {
  token: string;
  user: SessionUser;
  user_module_permissions?: { module_code: string; is_active: boolean }[];
}

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'current_user';
const MANAGED_TENANT_KEY = 'managed_tenant';

/** Organisation qu'un super administrateur a choisi de gérer. */
export interface ManagedTenant {
  id: number;
  name: string;
  logo_url?: string | null;
  /** Codes des modules ouverts à cette organisation. */
  modules: string[];
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super administrateur',
  ADMIN: 'Administrateur',
  USER: 'Utilisateur',
};

/** Session de l'utilisateur connecté : jeton, identité, rôle. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly #http = inject(HttpClient);
  readonly #router = inject(Router);

  readonly #token = signal<string | null>(null);
  readonly user = signal<SessionUser | null>(null);

  /** Organisation gérée par le super administrateur ; null tant qu'il n'en a pas choisi. */
  readonly managedTenant = signal<ManagedTenant | null>(null);

  readonly isAuthenticated = computed(() => !!this.#token() && !!this.user());
  readonly role = computed(() => this.user()?.roles?.[0]?.name ?? this.user()?.role ?? null);
  readonly roleLabel = computed(() => ROLE_LABELS[this.role() ?? ''] ?? '');
  readonly isAdmin = computed(() => this.role() === 'ADMIN' || this.role() === 'SUPER_ADMIN');
  readonly isSuperAdmin = computed(() => this.role() === 'SUPER_ADMIN');
  /** Organisation dont les données sont affichées : celle de l'utilisateur, ou celle choisie par le super administrateur. */
  readonly tenantName = computed(() => (this.isSuperAdmin() ? (this.managedTenant()?.name ?? '') : (this.user()?.tenant?.name ?? '')));
  /** Vrai quand les fenêtres de gestion peuvent s'ouvrir : un super administrateur doit d'abord choisir une organisation. */
  readonly hasTenant = computed(() => (this.isSuperAdmin() ? !!this.managedTenant() : !!this.user()?.tenant_id));

  constructor() {
    this.#restore();
  }

  /** Chacun voit les fenêtres des modules qui lui sont ouverts ; l'administration est réservée aux administrateurs. */
  canOpen(window: { adminOnly?: boolean; superAdminOnly?: boolean; module?: string }): boolean {
    if (window.superAdminOnly) {
      return this.isSuperAdmin();
    }
    if (this.isSuperAdmin()) {
      // Sans organisation choisie, seules les fenêtres de la plateforme sont ouvertes
      const managed = this.managedTenant();
      return !!managed && (!window.module || managed.modules.includes(window.module));
    }
    if (window.adminOnly) {
      return this.isAdmin();
    }
    // Le serveur refuse un module non ouvert même à un administrateur : le menu suit la même règle
    const modules = this.user()?.modules;
    return !window.module || !modules || modules.includes(window.module);
  }

  get token(): string | null {
    return this.#token();
  }

  login(email: string, password: string): Observable<SessionUser> {
    return this.#http.post<ApiResponse<LoginPayload>>(`${environment.apiUrl}/login`, { email, password }).pipe(
      tap(({ data }) =>
        this.#open(data.token, {
          ...data.user,
          modules: (data.user_module_permissions ?? []).filter((m) => m.is_active).map((m) => m.module_code),
        }),
      ),
      map(({ data }) => data.user),
    );
  }

  /** Choisit l'organisation à gérer (super administrateur) ; null pour revenir à la plateforme. */
  manage(tenant: ManagedTenant | null): void {
    this.managedTenant.set(tenant);
    try {
      if (tenant) {
        localStorage.setItem(MANAGED_TENANT_KEY, JSON.stringify(tenant));
      } else {
        localStorage.removeItem(MANAGED_TENANT_KEY);
      }
    } catch {
      // le choix vaut pour cette visite
    }
  }

  /** Ferme la session ici, prévient le serveur, puis renvoie à la connexion. */
  logout(reason?: Record<string, string | number>): void {
    const token = this.#token();
    this.#clear();
    if (token) {
      this.#http
        .post(`${environment.apiUrl}/logout`, {}, { headers: { Authorization: `Bearer ${token}` } })
        .subscribe({ error: () => undefined });
    }
    this.#router.navigate(['/login'], { queryParams: reason });
  }

  #open(token: string, user: SessionUser): void {
    this.#token.set(token);
    this.user.set(user);
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // Stockage indisponible : la session vit le temps de l'onglet
    }
  }

  #clear(): void {
    this.#token.set(null);
    this.user.set(null);
    this.managedTenant.set(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(MANAGED_TENANT_KEY);
    } catch {
      // rien à nettoyer
    }
  }

  #restore(): void {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const user = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') as SessionUser | null;
      if (token && user?.id && user.email) {
        this.#token.set(token);
        this.user.set(user);
        const managed = JSON.parse(localStorage.getItem(MANAGED_TENANT_KEY) ?? 'null') as ManagedTenant | null;
        this.managedTenant.set(managed?.id ? managed : null);
      }
    } catch {
      this.#clear();
    }
  }
}
