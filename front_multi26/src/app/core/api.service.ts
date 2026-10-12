import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';
import { ApiResponse } from './auth.service';

type Query = Record<string, string | number | boolean | null | undefined>;

/** Accès à l'API : renvoie directement la donnée utile de la réponse. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly #http = inject(HttpClient);

  get<T>(path: string, query: Query = {}): Observable<T> {
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== '') {
        params[key] = String(value);
      }
    }
    return this.#http.get<ApiResponse<T>>(this.#url(path), { params }).pipe(map((r) => r.data));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.#http.post<ApiResponse<T>>(this.#url(path), body).pipe(map((r) => r.data));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.#http.put<ApiResponse<T>>(this.#url(path), body).pipe(map((r) => r.data));
  }

  delete<T>(path: string): Observable<T> {
    return this.#http.delete<ApiResponse<T>>(this.#url(path)).pipe(map((r) => r.data));
  }

  #url(path: string): string {
    return `${environment.apiUrl}/${path.replace(/^\//, '')}`;
  }
}
