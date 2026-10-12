import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { findWindow } from './windows';

/** Espace connecté : sans session, retour à la connexion. */
export const authGuard: CanActivateFn = () =>
  inject(AuthService).isAuthenticated() || inject(Router).createUrlTree(['/login']);

/** Page de connexion : inutile quand la session est déjà ouverte. */
export const guestGuard: CanActivateFn = () =>
  !inject(AuthService).isAuthenticated() || inject(Router).createUrlTree(['/dashboard']);

/** Fenêtre de la cartographie : refusée si le rôle ou les modules de l'utilisateur ne l'ouvrent pas. */
export const windowGuard: CanActivateFn = (route) => {
  const window = findWindow(route.data['windowPath'])?.window;
  return (!!window && inject(AuthService).canOpen(window)) || inject(Router).createUrlTree(['/dashboard']);
};
