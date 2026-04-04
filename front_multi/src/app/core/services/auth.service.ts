import { Injectable, signal } from '@angular/core';
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
        // Validation simple des données
        if (user && user.id && user.email) {
          const authState = {
            user,
            tenant: user.tenant || null,
            isAuthenticated: true,
            token
          };
          this.authState.next(authState);
        } else {
          this.clearAuthData();
        }
      } catch (error) {
        console.error('Erreur lors de l\'initialisation de l\'authentification:', error);
        this.clearAuthData();
      }
    }
  }
  
  login(email: string, password: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.API_URL}/login`, { email, password }).pipe(
      tap(response => {
        if (response.success && response.data) {
          console.log('AuthService - Login response:', response.data);
          console.log('AuthService - tenant_active_modules from backend:', response.data.tenant_active_modules);
          console.log('AuthService - user_module_permissions from backend:', response.data.user_module_permissions);
          
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
          
          console.log('AuthService - Final user object:', authData.user);
          console.log('AuthService - Final tenant_active_modules:', authData.user?.tenant_active_modules);
          console.log('AuthService - Final module_permissions:', authData.user?.module_permissions);
          
          this.setAuthState(authData);
        }
      }),
      catchError(error => this.handleError(error))
    );
  }
  
  private loadUserModulePermissions(userId: number): void {
    this.http.get<ApiResponse<any>>(`${this.API_URL}/users/${userId}/module-permissions-public`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const currentState = this.authState.value;
          if (currentState.user) {
            currentState.user.module_permissions = response.data;
            this.authState.next(currentState);
            // Update localStorage with module permissions
            localStorage.setItem(this.USER_KEY, JSON.stringify(currentState.user));
          }
        }
      },
      error: (error) => {
        console.error('Error loading user module permissions:', error);
      }
    });
  }
  
  logout(): void {
    // Clear local auth data immediately
    this.clearAuthData();
    
    // Try to notify backend with current token, but don't wait for it
    // Use try-catch to handle expired tokens gracefully
    try {
      this.http.post(`${this.API_URL}/logout`, {}, {
        headers: this.getAuthHeaders()
      }).subscribe({
        error: () => {
          // Ignore errors during logout - user is already logged out locally
          console.log('Logout request failed, but user was logged out locally');
        }
      });
    } catch (error) {
      // If we can't even get headers (no token), just proceed with local logout
      console.log('No valid token for logout request, proceeding with local logout');
    }
    
    // Navigate to login immediately - use direct auth path
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
      headers: new HttpHeaders({
        'Authorization': `Bearer ${currentToken}`
      })
    }).pipe(
      tap(response => {
        if (response.success && response.data) {
          localStorage.setItem(this.TOKEN_KEY, response.data.token);
          this.authState.next({
            ...this.authState.value,
            token: response.data.token
          });
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
          this.authState.next({
            ...this.authState.value,
            user: response.data
          });
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
  
  // Getters
  get currentUser(): User | null {
    return this.authState.value.user;
  }
  
  get currentTenant(): any | null {
    return this.authState.value.tenant;
  }
  
  get isAuthenticated(): boolean {
    // Vérification directe du localStorage pour éviter les problèmes de BehaviorSubject
    const token = localStorage.getItem(this.TOKEN_KEY);
    const userStr = localStorage.getItem(this.USER_KEY);
    return !!(token && userStr);
  }
  
  get userRole(): string | null {
    const user = this.authState.value.user;
    if (!user || !user.roles || !Array.isArray(user.roles) || user.roles.length === 0) {
      return null;
    }
    // Laravel Spatie returns roles as array, get the first role name
    return user.roles[0].name;
  }
  
  get isSuperAdmin(): boolean {
    const role = this.userRole;
    console.log('Current user role:', role);
    return role === 'SUPER_ADMIN';
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
  
  // Check subscription status
  get isSubscriptionActive(): boolean {
    const tenant = this.currentTenant;
    return tenant?.subscription?.status === 'ACTIVE' || this.isSuperAdmin;
  }
  
  // Module access check - vérifie à la fois la souscription du tenant et les permissions utilisateur
  hasModuleAccess(moduleCode: string): boolean {
    if (this.isSuperAdmin) return true;
    
    const user = this.currentUser;
    if (!user) return false;
    
    // Vérifier si le tenant a souscrit au module
    const tenantHasModule = user.tenant_active_modules?.some((module: any) => 
      module.code === moduleCode && module.is_active
    );
    
    if (!tenantHasModule) {
      console.warn(`Tenant n'a pas souscrit au module: ${moduleCode}`);
      return false;
    }
    
    // Vérifier si l'utilisateur a la permission d'accéder au module
    const userHasPermission = user.module_permissions?.some((permission: any) => 
      permission.module_code === moduleCode && permission.is_active
    );
    
    if (!userHasPermission) {
      console.warn(`Utilisateur n'a pas la permission pour le module: ${moduleCode}`);
      return false;
    }
    
    return true;
  }
  
  // Get list of tenant's active modules
  getTenantActiveModules(): any[] {
    const user = this.currentUser;
    if (this.isSuperAdmin) {
      // Super admin has access to all modules
      return [
        { code: 'COMMERCE', name: 'Module Commerce', is_active: true },
        { code: 'FINANCE', name: 'Module Finance', is_active: true },
        { code: 'CONTAINER', name: 'Gestion Conteneurs', is_active: true },
        { code: 'IMMOBILIER', name: 'Location Immobilière', is_active: true },
        { code: 'TAXI', name: 'Gestion Taxi', is_active: true },
        { code: 'STATISTICS', name: 'Statistiques', is_active: true }
      ];
    }
    return user?.tenant_active_modules || [];
  }
  
  // Get list of user's accessible modules (intersection of tenant modules and user permissions)
  getUserAccessibleModules(): any[] {
    const user = this.currentUser;
    if (!user) {
      console.log('AuthService - getUserAccessibleModules: No user');
      return [];
    }
    
    console.log('AuthService - getUserAccessibleModules for:', user.email);
    console.log('AuthService - User role:', this.userRole);
    console.log('AuthService - tenant_active_modules:', user.tenant_active_modules);
    console.log('AuthService - module_permissions:', user.module_permissions);
    
    // SUPER_ADMIN has access to all modules
    if (this.isSuperAdmin) {
      const modules = this.getTenantActiveModules();
      console.log('AuthService - SUPER_ADMIN modules:', modules);
      return modules;
    }
    
    // ADMIN has access to all tenant modules (to manage users and assign permissions)
    if (this.isTenantAdmin) {
      const modules = user.tenant_active_modules || [];
      console.log('AuthService - ADMIN modules:', modules);
      return modules;
    }
    
    // USER has access only to modules with explicit permissions
    const tenantModules = user.tenant_active_modules || [];
    const userPermissions = user.module_permissions || [];
    
    console.log('AuthService - USER filtering...');
    console.log('AuthService - Tenant modules:', tenantModules);
    console.log('AuthService - User permissions:', userPermissions);
    
    // Return only modules that are both subscribed by tenant AND permitted for user
    const filtered = tenantModules.filter((module: any) => {
      const hasPermission = userPermissions.some((perm: any) => {
        const match = perm.module_code === module.code && perm.is_active;
        console.log(`AuthService - Checking module ${module.code} vs permission ${perm.module_code}: ${match}`);
        return match;
      });
      return hasPermission;
    });
    
    console.log('AuthService - Filtered modules:', filtered);
    return filtered;
  }
  
  // Permission check
  hasPermission(permission: string): boolean {
    if (this.isSuperAdmin) return true;
    
    // Implementation depends on your permission system
    return true; // Placeholder
  }
  
  // Private methods
  private setAuthState(authData: AuthState): void {
    try {
      this.authState.next(authData);
      localStorage.setItem(this.TOKEN_KEY, authData.token || '');
      localStorage.setItem(this.USER_KEY, JSON.stringify(authData.user));
    } catch (error) {
      console.error('Error setting auth state:', error);
    }
  }
  
  reloadCurrentUser(): Observable<any> {
    const currentUser = this.currentUser;
    if (!currentUser || !currentUser.id) {
      return throwError(() => new Error('No current user'));
    }

    // Fetch fresh user data from backend
    return this.http.get<ApiResponse<any>>(`${this.API_URL}/users/${currentUser.id}/module-permissions-public`).pipe(
      tap(response => {
        if (response.success && response.data) {
          // Update user with fresh module permissions
          const updatedUser = {
            ...currentUser,
            module_permissions: response.data.module_permissions || [],
            tenant_active_modules: response.data.tenant_active_modules || []
          };
          
          // Update auth state
          const currentState = this.authState.value;
          this.authState.next({
            ...currentState,
            user: updatedUser
          });
          
          // Update localStorage
          localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
          
          console.log('Current user data reloaded with fresh permissions');
        }
      }),
      catchError(error => {
        console.error('Error reloading current user:', error);
        return throwError(() => error);
      })
    );
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
  
  private getAuthHeaders(): HttpHeaders {
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
