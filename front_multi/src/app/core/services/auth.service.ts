import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, catchError, throwError } from 'rxjs';
import { User, AuthState, ApiResponse } from '../models';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = environment.apiUrl;
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'current_user';
  private readonly MANAGED_TENANT_KEY = 'managed_tenant_id';

  private authState = new BehaviorSubject<AuthState>({
    user: null,
    tenant: null,
    isAuthenticated: false,
    token: null
  });

  authState$ = this.authState.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.initializeAuthState();
  }

  private initializeAuthState(): void {
    const token = localStorage.getItem(this.TOKEN_KEY);
    const userStr = localStorage.getItem(this.USER_KEY);

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user && user.id && user.email) {
          const normalizedUser = this.normalizeModuleAccess(user);
          this.authState.next({
            user: normalizedUser,
            tenant: normalizedUser.tenant || null,
            isAuthenticated: true,
            token
          });
        } else {
          this.clearAuthData();
        }
      } catch {
        this.clearAuthData();
      }
    }
  }

  login(email: string, password: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.API_URL}/login`, { email, password }).pipe(
      tap(response => {
        if (response.success && response.data) {
          const normalizedUser = this.normalizeModuleAccess({
            ...response.data.user,
            tenant_active_modules: response.data.tenant_active_modules || [],
            module_permissions: response.data.user_module_permissions || []
          });
          const authData: AuthState = {
            user: normalizedUser,
            tenant: normalizedUser.tenant || null,
            isAuthenticated: true,
            token: response.data.token
          };
          this.setAuthState(authData);
        }
      }),
      catchError(error => this.handleError(error))
    );
  }

  logout(): void {
    const headers = this.getAuthHeaders();
    this.clearAuthData();

    this.http.post(`${this.API_URL}/logout`, {}, { headers }).subscribe({
      error: () => { /* Logout local déjà effectué */ }
    });

    this.router.navigate(['/auth/login']);
  }

  register(userData: {
    name: string;
    email: string;
    password: string;
    tenantName: string;
    tenantEmail: string;
    tenantPhone: string;
    planId: string;
  }): Observable<ApiResponse<AuthState>> {
    return this.http.post<ApiResponse<AuthState>>(`${this.API_URL}/register`, userData).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.setAuthState(response.data);
        }
      }),
      catchError(error => this.handleError(error))
    );
  }

  refreshToken(): Observable<ApiResponse<{ token: string }>> {
    const currentToken = this.getCurrentToken();
    if (!currentToken) {
      return throwError(() => new Error('No token to refresh'));
    }

    return this.http.post<ApiResponse<{ token: string }>>(`${this.API_URL}/refresh`, {}, {
      headers: new HttpHeaders({ 'Authorization': `Bearer ${currentToken}` })
    }).pipe(
      tap(response => {
        if (response.success && response.data) {
          localStorage.setItem(this.TOKEN_KEY, response.data.token);
          this.authState.next({ ...this.authState.value, token: response.data.token });
        }
      }),
      catchError(error => {
        this.clearAuthData();
        this.router.navigate(['/auth/login']);
        return this.handleError(error);
      })
    );
  }

  updateProfile(userData: Partial<User>): Observable<ApiResponse<User>> {
    return this.http.put<ApiResponse<User>>(`${this.API_URL}/me`, userData, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        if (response.success && response.data) {
          const updated = { ...this.currentUser, ...response.data };
          this.authState.next({ ...this.authState.value, user: updated as User });
          localStorage.setItem(this.USER_KEY, JSON.stringify(updated));
        }
      }),
      catchError(error => this.handleError(error))
    );
  }

  updateAvatar(avatar: File): Observable<ApiResponse<any>> {
    const fd = new FormData();
    fd.append('avatar', avatar);
    const token = this.getCurrentToken();
    return this.http.post<ApiResponse<any>>(`${this.API_URL}/me/avatar`, fd, {
      headers: new HttpHeaders({ 'Authorization': `Bearer ${token}` })
    }).pipe(
      tap(response => {
        if (response.success && response.data) {
          const updated = { ...this.currentUser, ...response.data };
          this.authState.next({ ...this.authState.value, user: updated as User });
          localStorage.setItem(this.USER_KEY, JSON.stringify(updated));
        }
      }),
      catchError(error => this.handleError(error))
    );
  }

  changePassword(data: { currentPassword: string; newPassword: string }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.API_URL}/user/change-password`, data, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(error => this.handleError(error))
    );
  }

  forgotPassword(email: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.API_URL}/forgot-password`, { email }).pipe(
      catchError(error => this.handleError(error))
    );
  }

  resetPassword(data: { token: string; email: string; password: string; password_confirmation: string }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.API_URL}/reset-password`, data).pipe(
      catchError(error => this.handleError(error))
    );
  }

  updateCurrentUser(data: Partial<User>): void {
    const current = this.currentUser;
    if (!current) return;
    const merged = { ...current, ...data };
    // Preserve existing roles/module data if the update response didn't include them
    if (!merged.roles?.length && current.roles?.length) {
      merged.roles = current.roles;
    }
    if (!(merged as any).tenant_active_modules?.length && (current as any).tenant_active_modules?.length) {
      (merged as any).tenant_active_modules = (current as any).tenant_active_modules;
    }
    if (!(merged as any).module_permissions?.length && (current as any).module_permissions?.length) {
      (merged as any).module_permissions = (current as any).module_permissions;
    }
    this.authState.next({ ...this.authState.value, user: merged });
    localStorage.setItem(this.USER_KEY, JSON.stringify(merged));
  }

  reloadCurrentUser(): Observable<any> {
    const currentUser = this.currentUser;
    if (!currentUser || !currentUser.id) {
      return throwError(() => new Error('No current user'));
    }

    return this.http.get<ApiResponse<any>>(`${this.API_URL}/users/${currentUser.id}/module-permissions`).pipe(
      tap(response => {
        if (response.success && response.data) {
          const updatedUser = this.normalizeModuleAccess({
            ...currentUser,
            module_permissions: response.data.module_permissions || [],
            tenant_active_modules: response.data.tenant_active_modules || []
          });
          this.authState.next({ ...this.authState.value, user: updatedUser });
          localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
        }
      }),
      catchError(error => this.handleError(error))
    );
  }

  // Getters
  get currentUser(): User | null {
    return this.authState.value.user;
  }

  get currentTenant(): User['tenant'] | null {
    return this.authState.value.tenant;
  }

  get selectedManagedTenantId(): number | null {
    const value = localStorage.getItem(this.MANAGED_TENANT_KEY);
    return value ? Number(value) : null;
  }

  get isAuthenticated(): boolean {
    return this.authState.value.isAuthenticated;
  }

  get userRole(): string | null {
    const user = this.authState.value.user;
    if (user?.roles && Array.isArray(user.roles) && user.roles.length > 0) {
      return user.roles[0].name;
    }
    // Fallback: singular role field returned at login
    return (user as any)?.role || null;
  }

  get isSuperAdmin(): boolean {
    return this.userRole === 'SUPER_ADMIN';
  }

  get isTenantAdmin(): boolean {
    return this.userRole === 'ADMIN';
  }

  get isTenantUser(): boolean {
    return this.userRole === 'USER';
  }

  getCurrentToken(): string | null {
    return this.authState.value.token;
  }

  setSelectedManagedTenantId(tenantId: number | null): void {
    if (tenantId == null) {
      localStorage.removeItem(this.MANAGED_TENANT_KEY);
      return;
    }

    localStorage.setItem(this.MANAGED_TENANT_KEY, String(tenantId));
  }

  get isSubscriptionActive(): boolean {
    const tenant = this.currentTenant;
    return (tenant as any)?.subscription?.status === 'ACTIVE' || this.isSuperAdmin;
  }

  hasModuleAccess(moduleCode: string): boolean {
    if (this.isSuperAdmin) return true;

    const user = this.currentUser;
    if (!user) return false;

    const tenantHasModule = user.tenant_active_modules?.some(
      (module: { code: string; is_active: boolean }) => module.code === moduleCode && module.is_active
    );

    if (!tenantHasModule) return false;

    const userHasPermission = user.module_permissions?.some(
      (permission: { module_code: string; is_active: boolean }) => permission.module_code === moduleCode && permission.is_active
    );

    return !!userHasPermission;
  }

  hasModulePermission(moduleCode: string, permission: string): boolean {
    if (this.isSuperAdmin || this.isTenantAdmin) return true;

    const user = this.currentUser;
    if (!user) return false;

    const modulePermission = user.module_permissions?.find(
      (item: { module_code: string; is_active: boolean }) => item.module_code === moduleCode && item.is_active
    );

    if (!modulePermission) return false;

    const permissions = Array.isArray(modulePermission.permissions) ? modulePermission.permissions : [];
    if (permissions.includes(permission)) return true;

    if (permission.startsWith('view_') && permissions.includes('view')) return true;
    if (permission.startsWith('create_') && permissions.includes('create')) return true;
    if (permission.startsWith('edit_') && permissions.includes('edit')) return true;
    if (permission.startsWith('delete_') && permissions.includes('delete')) return true;

    return false;
  }

  getTenantActiveModules(): { code: string; name: string; is_active: boolean }[] {
    const user = this.currentUser;
    if (this.isSuperAdmin) {
      return [
        { code: 'COMMERCE',          name: 'Gestion Commerciale',    is_active: true },
        { code: 'FINANCE',           name: 'Gestion Financière',     is_active: true },
        { code: 'CLIENTS_SUPPLIERS', name: 'Clients & Fournisseurs', is_active: true },
        { code: 'USERS',             name: 'Utilisateurs',           is_active: true },
        { code: 'PRODUCTS_STOCK',    name: 'Produits & Stock',       is_active: true },
        { code: 'CONTAINER',         name: 'Gestion Conteneurs',     is_active: true },
        { code: 'RENTAL',            name: 'Location Immobilière',   is_active: true },
        { code: 'TAXI',              name: 'Gestion Taxi',           is_active: true },
        { code: 'STATISTICS',        name: 'Statistiques',           is_active: true },
        { code: 'EXPENSES',          name: 'Dépenses Personnelles',  is_active: true },
        { code: 'BANKING',           name: 'Comptes Bancaires',       is_active: true },
      ];
    }
    return user?.tenant_active_modules || [];
  }

  getUserAccessibleModules(): { code: string; name: string; is_active: boolean }[] {
    const user = this.currentUser;
    if (!user) return [];

    if (this.isSuperAdmin) return this.getTenantActiveModules();

    if (this.isTenantAdmin) return user.tenant_active_modules || [];

    const tenantModules: { code: string; name: string; is_active: boolean }[] = user.tenant_active_modules || [];
    const userPermissions: { module_code: string; is_active: boolean }[] = user.module_permissions || [];

    return tenantModules.filter(module =>
      userPermissions.some(perm => perm.module_code === module.code && perm.is_active)
    );
  }

  private normalizeModuleAccess(user: any): any {
    if (!user) return user;

    const tenantModules = Array.isArray(user.tenant_active_modules) ? [...user.tenant_active_modules] : [];
    const modulePermissions = Array.isArray(user.module_permissions) ? [...user.module_permissions] : [];

    const hasCommerceAccess =
      tenantModules.some((module: { code?: string; is_active?: boolean }) => module?.code === 'COMMERCE' && module?.is_active) ||
      modulePermissions.some((permission: { module_code?: string; is_active?: boolean }) => permission?.module_code === 'COMMERCE' && permission?.is_active);

    if (hasCommerceAccess) {
      const clientSuppliersModule = {
        code: 'CLIENTS_SUPPLIERS',
        name: 'Clients & Fournisseurs',
        is_active: true,
      };

      if (!tenantModules.some((module: { code?: string }) => module?.code === 'CLIENTS_SUPPLIERS')) {
        tenantModules.push(clientSuppliersModule);
      }

      if (!modulePermissions.some((permission: { module_code?: string }) => permission?.module_code === 'CLIENTS_SUPPLIERS')) {
        modulePermissions.push({
          module_code: 'CLIENTS_SUPPLIERS',
          module_name: 'Clients & Fournisseurs',
          is_active: true,
          permissions: [
            'view',
            'create',
            'edit',
            'delete',
            'view_clients_general',
            'view_clients_pneus',
            'view_clients_textile',
            'view_clients_cosmetiques',
            'view_clients_conteneurs_pagne',
            'view_suppliers'
          ]
        });
      }
    }

    const hasUsersAccess =
      tenantModules.some((module: { code?: string; is_active?: boolean }) => module?.code === 'USERS' && module?.is_active) ||
      modulePermissions.some((permission: { module_code?: string; is_active?: boolean }) => permission?.module_code === 'USERS' && permission?.is_active);

    if (hasUsersAccess && !modulePermissions.some((permission: { module_code?: string }) => permission?.module_code === 'USERS')) {
      modulePermissions.push({
        module_code: 'USERS',
        module_name: 'Utilisateurs',
        is_active: true,
        permissions: ['view', 'create', 'edit', 'delete', 'view_users', 'manage_permissions', 'change_password', 'toggle_status']
      });
    }

    return {
      ...user,
      tenant_active_modules: tenantModules,
      module_permissions: modulePermissions,
    };
  }

  hasPermission(_permission: string): boolean {
    if (this.isSuperAdmin) return true;
    return true;
  }

  private setAuthState(authData: AuthState): void {
    const normalizedAuthData: AuthState = {
      ...authData,
      user: this.normalizeModuleAccess(authData.user)
    };

    this.authState.next(normalizedAuthData);
    localStorage.setItem(this.TOKEN_KEY, authData.token || '');
    localStorage.setItem(this.USER_KEY, JSON.stringify(normalizedAuthData.user));
  }

  private clearAuthData(): void {
    this.authState.next({
      user: null,
      tenant: null,
      isAuthenticated: false,
      token: null
    });
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getCurrentToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'An error occurred';

    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return throwError(() => new Error(errorMessage));
  }
}
