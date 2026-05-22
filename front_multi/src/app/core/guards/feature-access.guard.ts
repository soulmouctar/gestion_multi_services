import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, CanActivateChild, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class FeatureAccessGuard implements CanActivate, CanActivateChild {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    return this.checkAccess(route, state);
  }

  canActivateChild(childRoute: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    return this.checkAccess(childRoute, state);
  }

  private checkAccess(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    if (!this.authService.isAuthenticated) {
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    const moduleCode = route.data['module'] as string | undefined;
    const permission = route.data['permission'] as string | undefined;

    if (!moduleCode) {
      return true;
    }

    if (this.authService.isSuperAdmin || this.authService.isTenantAdmin) {
      return true;
    }

    if (!this.authService.hasModuleAccess(moduleCode)) {
      this.router.navigate(['/unauthorized']);
      return false;
    }

    if (permission && !this.authService.hasModulePermission(moduleCode, permission)) {
      this.router.navigate(['/unauthorized']);
      return false;
    }

    return true;
  }
}
