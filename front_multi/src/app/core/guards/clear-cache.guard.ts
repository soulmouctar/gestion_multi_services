import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class ClearCacheGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Forcer le nettoyage du cache au démarrage
    this.forceClearCache();
    
    // Toujours autoriser l'accès et laisser les autres guards gérer la logique
    return of(true);
  }
  
  private forceClearCache(): void {
    // Nettoyer uniquement si les données semblent corrompues
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('current_user');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        // Si les données utilisateur sont invalides, nettoyer
        if (!user || !user.id || !user.email) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('current_user');
          // Forcer la redirection vers login
          this.router.navigate(['/auth/login']);
        }
      } catch (error) {
        // En cas d'erreur de parsing, nettoyer tout
        localStorage.removeItem('auth_token');
        localStorage.removeItem('current_user');
        this.router.navigate(['/auth/login']);
      }
    }
  }
}
