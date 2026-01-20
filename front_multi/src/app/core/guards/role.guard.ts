import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    
    const user = this.authService.currentUser;
    
    if (!user) {
      this.router.navigate(['/auth/login']);
      return false;
    }

    // Récupérer les rôles requis depuis les données de la route
    const requiredRoles = route.data['roles'] as string[];
    
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // Pas de restriction de rôle
    }

    // Vérifier si l'utilisateur a au moins un des rôles requis
    const userRoles = user.roles?.map((role: any) => role.name || role) || [];
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      console.warn(`Access denied. Required roles: ${requiredRoles.join(', ')}, User roles: ${userRoles.join(', ')}`);
      this.router.navigate(['/dashboard']);
      return false;
    }

    return true;
  }
}
