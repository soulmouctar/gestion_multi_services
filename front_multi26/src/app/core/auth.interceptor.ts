import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/** Appels qui portent sur la plateforme entière, jamais sur une seule organisation. */
const PLATFORM_PATHS = /^(login|logout|me|refresh|tenants|modules|subscription|roles|permissions)(\/|\?|$)/;

/** Joint le jeton aux appels vers l'API et ferme la session si le serveur la refuse. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const toApi = req.url.startsWith(environment.apiUrl);
  const token = auth.token;

  let request = toApi && token && !req.headers.has('Authorization')
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    : req;

  // Un super administrateur agit pour l'organisation qu'il a choisie : elle accompagne chaque requête,
  // en lecture comme en écriture. Les fenêtres de la plateforme, elles, portent sur toutes les organisations.
  const managed = auth.managedTenant();
  const path = req.url.slice(environment.apiUrl.length + 1);
  if (toApi && auth.isSuperAdmin() && managed && !PLATFORM_PATHS.test(path) && !request.params.has('tenant_id')) {
    request = request.clone({ setParams: { tenant_id: String(managed.id) } });
  }

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (toApi && error.status === 401 && auth.isAuthenticated()) {
        auth.logout({ reason: 'session' });
      }
      return throwError(() => error);
    }),
  );
};
