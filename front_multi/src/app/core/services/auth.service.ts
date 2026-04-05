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
          this.authState.next({
            user,
            tenant: user.tenant || null,
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
          const authData: AuthState = {
            user: {
              ...response.data.user,
              tenant_active_modules: response.data.tenant_active_modules || [],
              module_permissions: response.data.user_module_permissions || []
            },
            tenant: response.data.user?.tenant || null,
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
          this.authState.next({ ...this.authState.value, user: response.data });
          localStorage.setItem(this.USER_KEY, JSON.stringify(response.data));
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

  reloadCurrentUser(): Observable<any> {
    const currentUser = this.currentUser;
    if (!currentUser || !currentUser.id) {
      return throwError(() => new Error('No current user'));
    }

    return this.http.get<ApiResponse<any>>(`${this.API_URL}/users/${currentUser.id}/module-permissions`).pipe(
      tap(response => {
        if (response.success && response.data) {
          const updatedUser = {
            ...currentUser,
            module_permissions: response.data.module_permissions || [],
            tenant_active_modules: response.data.tenant_active_modules || []
          };
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

  get isAuthenticated(): boolean {
    return this.authState.value.isAuthenticated;
  }

  get userRole(): string | null {
    const user = this.authState.value.user;
    if (!user?.roles || !Array.isArray(user.roles) || user.roles.length === 0) {
      return null;
    }
    return user.roles[0].name;
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

  getTenantActiveModules(): { code: string; name: string; is_active: boolean }[] {
    const user = this.currentUser;
    if (this.isSuperAdmin) {
      return [
        { code: 'COMMERCE',          name: 'Gestion Commerciale',    is_active: true },
        { code: 'FINANCE',           name: 'Gestion Financière',     is_active: true },
        { code: 'CLIENTS_SUPPLIERS', name: 'Clients & Fournisseurs', is_active: true },
        { code: 'PRODUCTS_STOCK',    name: 'Produits & Stock',       is_active: true },
        { code: 'CONTAINER',         name: 'Gestion Conteneurs',     is_active: true },
        { code: 'RENTAL',            name: 'Location Immobilière',   is_active: true },
        { code: 'TAXI',              name: 'Gestion Taxi',           is_active: true },
        { code: 'STATISTICS',        name: 'Statistiques',           is_active: true },
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

  hasPermission(_permission: string): boolean {
    if (this.isSuperAdmin) return true;
    return true;
  }

  private setAuthState(authData: AuthState): void {
    this.authState.next(authData);
    localStorage.setItem(this.TOKEN_KEY, authData.token || '');
    localStorage.setItem(this.USER_KEY, JSON.stringify(authData.user));
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