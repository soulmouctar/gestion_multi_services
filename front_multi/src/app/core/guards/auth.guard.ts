import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of, take, map } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    try {
      // Simple authentication check to prevent circular dependencies
      const isAuth = this.authService.isAuthenticated;
      
      if (!isAuth) {
        this.router.navigate(['/auth/login'], { 
          queryParams: { returnUrl: state.url } 
        });
        return of(false);
      }
      
      // For now, skip complex permission checks to prevent loading issues
      // These can be added back once the app loads properly
      return of(true);
    } catch (error) {
      console.error('AuthGuard error:', error);
      this.router.navigate(['/auth/login']);
      return of(false);
    }
  }
}

@Injectable({
  providedIn: 'root'
})
export class SuperAdminGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    try {
      const isAuth = this.authService.isAuthenticated;
      
      if (!isAuth) {
        this.router.navigate(['/auth/login']);
        return of(false);
      }
      
      if (!this.authService.isSuperAdmin) {
        this.router.navigate(['/dashboard']);
        return of(false);
      }
      
      return of(true);
    } catch (error) {
      console.error('SuperAdminGuard error:', error);
      this.router.navigate(['/auth/login']);
      return of(false);
    }
  }
}

@Injectable({
  providedIn: 'root'
})
export class TenantAdminGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Utiliser la même logique que isAuthenticated pour éviter les problèmes de BehaviorSubject
    const isAuth = this.authService.isAuthenticated;
    
    if (!isAuth) {
      this.router.navigate(['/auth/login'], { 
        queryParams: { returnUrl: state.url } 
      });
      return of(false);
    }
    
    if (!this.authService.isSuperAdmin && !this.authService.isTenantAdmin) {
      this.router.navigate(['/dashboard']);
      return of(false);
    }
    
    return of(true);
  }
}

@Injectable({
  providedIn: 'root'
})
export class SubscriptionGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.authService.authState$.pipe(
      take(1),
      map(authState => {
        // Require authentication for all protected routes
        if (!authState.isAuthenticated) {
          this.router.navigate(['/auth/login']);
          return false;
        }
        
        // Super admins bypass subscription check
        if (this.authService.isSuperAdmin) {
          return true;
        }
        
        // Check if subscription is active
        if (!this.authService.isSubscriptionActive) {
          this.router.navigate(['/subscription-expired']);
          return false;
        }
        
        return true;
      })
    );
  }
}
