import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  constructor(private router: Router) {}

  /**
   * Nettoie complètement le cache et les données d'authentification
   */
  clearAllCache(): void {
    // Nettoyer localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    
    // Nettoyer sessionStorage
    sessionStorage.clear();
    
    // Forcer le rechargement de la page
    this.router.navigate(['/auth/login']).then(() => {
      window.location.reload();
    });
  }

  /**
   * Vérifie si les données d'authentification sont valides
   */
  isAuthDataValid(): boolean {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('current_user');
    
    if (!token || !userStr) {
      return false;
    }
    
    try {
      const user = JSON.parse(userStr);
      return user && user.id && user.email;
    } catch (error) {
      return false;
    }
  }

  /**
   * Nettoie uniquement les données invalides
   */
  clearInvalidAuthData(): void {
    if (!this.isAuthDataValid()) {
      this.clearAllCache();
    }
  }
}
