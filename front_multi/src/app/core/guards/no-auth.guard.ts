import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class NoAuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    try {
      // Simple vérification - si authentifié, rediriger vers dashboard
      const isAuth = this.authService.isAuthenticated;
      
      if (isAuth) {
        this.router.navigate(['/dashboard']);
        return of(false);
      }
      
      // Autoriser l'accès aux pages d'authentification
      return of(true);
    } catch (error) {
      console.error('NoAuthGuard error:', error);
      // En cas d'erreur, autoriser l'accès à la page de login
      return of(true);
    }
  }
}
