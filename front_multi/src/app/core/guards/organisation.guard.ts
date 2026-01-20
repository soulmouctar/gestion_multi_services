import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class OrganisationGuard implements CanActivate {

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

    // Vérifier si l'utilisateur a un rôle autorisé pour accéder aux sections organisation
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN'];
    const hasValidRole = user.roles?.some((role: any) => 
      allowedRoles.includes(role.name || role)
    );

    if (!hasValidRole) {
      // Rediriger vers le dashboard si pas autorisé
      this.router.navigate(['/dashboard']);
      return false;
    }

    // Pour les ADMIN, vérifier qu'ils ont un tenant assigné
    if (user.roles?.some((role: any) => (role.name || role) === 'ADMIN')) {
      if (!user.tenant?.id) {
        console.error('ADMIN user must have a tenant assigned');
        this.router.navigate(['/dashboard']);
        return false;
      }
    }

    return true;
  }
}
