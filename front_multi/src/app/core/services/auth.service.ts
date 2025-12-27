import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, catchError, throwError } from 'rxjs';
import { User, AuthState, ApiResponse } from '../models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://127.0.0.1:8003/api';
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
    
    console.log('AuthService.initializeAuthState: token trouvé =', !!token, 'userStr trouvé =', !!userStr);
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        const authState = {
          user,
          tenant: user.tenant || null,
          isAuthenticated: true,
          token
        };
        this.authState.next(authState);
        console.log('AuthService.initializeAuthState: État authentification défini sur:', authState);
      } catch (error) {
        console.log('AuthService.initializeAuthState: Erreur parsing user, nettoyage des données');
        this.clearAuthData();
      }
    } else {
      console.log('AuthService.initializeAuthState: Pas de token ou user, utilisateur non authentifié');
    }
  }
  
  login(credentials: { email: string; password: string; tenantDomain?: string }): Observable<ApiResponse<AuthState>> {
    console.log('AuthService.login appelé avec:', credentials);
    return this.http.post<ApiResponse<AuthState>>(`${this.API_URL}/login`, credentials).pipe(
      tap(response => {
        console.log('AuthService.login réponse reçue:', response);
        if (response.success && response.data) {
          console.log('AuthService.login mise à jour état authentification');
          this.setAuthState(response.data);
        } else {
          console.log('AuthService.login échec:', response.message);
        }
      }),
      catchError(error => {
        console.log('AuthService.login erreur:', error);
        return this.handleError(error);
      })
    );
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
    const isAuth = !!(token && userStr);
    console.log('AuthService.isAuthenticated appelé - token:', !!token, 'user:', !!userStr, 'résultat:', isAuth);
    return isAuth;
  }
  
  get userRole(): string | null {
    const user = this.authState.value.user;
    if (!user || !user.roles || user.roles.length === 0) {
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
  
  // Check subscription status
  get isSubscriptionActive(): boolean {
    const tenant = this.currentTenant;
    return tenant?.subscription?.status === 'ACTIVE' || this.isSuperAdmin;
  }
  
  // Module access check
  hasModuleAccess(moduleCode: string): boolean {
    if (this.isSuperAdmin) return true;
    
    const tenant = this.currentTenant;
    return tenant?.modules?.some((module: any) => 
      module.module?.code === moduleCode && module.isActive
    ) || false;
  }
  
  // Permission check
  hasPermission(permission: string): boolean {
    if (this.isSuperAdmin) return true;
    
    // Implementation depends on your permission system
    return true; // Placeholder
  }
  
  // Private methods
  private setAuthState(authData: AuthState): void {
    console.log('AuthService.setAuthState appelé avec:', authData);
    this.authState.next(authData);
    localStorage.setItem(this.TOKEN_KEY, authData.token || '');
    localStorage.setItem(this.USER_KEY, JSON.stringify(authData.user));
    
    // Vérification immédiate de l'état
    setTimeout(() => {
      const currentState = this.authState.value;
      console.log('AuthService.setAuthState - vérification état actuel:', currentState);
      console.log('AuthService.setAuthState - isAuthenticated après mise à jour:', this.isAuthenticated);
    }, 0);
    
    console.log('AuthService.setAuthState terminé, isAuthenticated:', authData.isAuthenticated);
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
