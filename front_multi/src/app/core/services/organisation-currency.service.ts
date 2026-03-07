import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface OrganisationCurrency {
  id?: number;
  tenant_id?: number;
  code: string;
  name: string;
  symbol: string;
  exchange_rate: number;
  is_default: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  errors?: any;
}

@Injectable({
  providedIn: 'root'
})
export class OrganisationCurrencyService {
  private readonly API_URL = environment.apiUrl;
  private currenciesSubject = new BehaviorSubject<OrganisationCurrency[]>([]);
  public currencies$ = this.currenciesSubject.asObservable();

  constructor(private http: HttpClient) {}

  getCurrencies(isActive?: boolean, isDefault?: boolean): Observable<ApiResponse<OrganisationCurrency[]>> {
    let params: any = {};
    if (isActive !== undefined) params.is_active = isActive;
    if (isDefault !== undefined) params.is_default = isDefault;

    return this.http.get<ApiResponse<OrganisationCurrency[]>>(`${this.API_URL}/currencies`, {
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      tap(response => {
        if (response.success) {
          this.currenciesSubject.next(response.data);
        }
      })
    );
  }

  getCurrency(id: number): Observable<ApiResponse<OrganisationCurrency>> {
    return this.http.get<ApiResponse<OrganisationCurrency>>(`${this.API_URL}/currencies/${id}`, {
      headers: this.getAuthHeaders()
    });
  }

  createCurrency(currency: Omit<OrganisationCurrency, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Observable<ApiResponse<OrganisationCurrency>> {
    return this.http.post<ApiResponse<OrganisationCurrency>>(`${this.API_URL}/currencies`, currency, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          const currentCurrencies = this.currenciesSubject.value;
          this.currenciesSubject.next([...currentCurrencies, response.data]);
        }
      })
    );
  }

  updateCurrency(id: number, currency: Partial<OrganisationCurrency>): Observable<ApiResponse<OrganisationCurrency>> {
    return this.http.put<ApiResponse<OrganisationCurrency>>(`${this.API_URL}/currencies/${id}`, currency, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          const currentCurrencies = this.currenciesSubject.value;
          const index = currentCurrencies.findIndex(c => c.id === id);
          if (index !== -1) {
            currentCurrencies[index] = response.data;
            this.currenciesSubject.next([...currentCurrencies]);
          }
        }
      })
    );
  }

  deleteCurrency(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.API_URL}/currencies/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          const currentCurrencies = this.currenciesSubject.value;
          this.currenciesSubject.next(currentCurrencies.filter(c => c.id !== id));
        }
      })
    );
  }

  setAsDefault(id: number): Observable<ApiResponse<OrganisationCurrency>> {
    return this.http.post<ApiResponse<OrganisationCurrency>>(`${this.API_URL}/currencies/${id}/set-default`, {}, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          const currentCurrencies = this.currenciesSubject.value;
          const updatedCurrencies = currentCurrencies.map(c => ({
            ...c,
            is_default: c.id === id
          }));
          this.currenciesSubject.next(updatedCurrencies);
        }
      })
    );
  }

  toggleStatus(id: number): Observable<ApiResponse<OrganisationCurrency>> {
    return this.http.post<ApiResponse<OrganisationCurrency>>(`${this.API_URL}/currencies/${id}/toggle-status`, {}, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          const currentCurrencies = this.currenciesSubject.value;
          const index = currentCurrencies.findIndex(c => c.id === id);
          if (index !== -1) {
            currentCurrencies[index] = response.data;
            this.currenciesSubject.next([...currentCurrencies]);
          }
        }
      })
    );
  }

  getCurrentCurrencies(): OrganisationCurrency[] {
    return this.currenciesSubject.value;
  }

  getActiveCurrencies(): OrganisationCurrency[] {
    return this.currenciesSubject.value.filter(c => c.is_active);
  }

  getDefaultCurrency(): OrganisationCurrency | null {
    return this.currenciesSubject.value.find(c => c.is_default) || null;
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }
}
