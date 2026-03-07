import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, catchError, timeout, retry, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';

export interface InvoiceHeader {
  id?: number;
  tenant_id?: number;
  name: string;
  logo_url?: string;
  company_name: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  phone: string;
  email: string;
  website?: string;
  tax_number?: string;
  registration_number?: string;
  bank_details?: string;
  footer_text?: string;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
  tenant?: any;
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
export class InvoiceHeaderService {
  private readonly API_URL = environment.apiUrl;
  private headersSubject = new BehaviorSubject<InvoiceHeader[]>([]);
  public headers$ = this.headersSubject.asObservable();

  constructor(private http: HttpClient) {}

  getHeaders(params?: { is_default?: boolean; sort_by?: string; sort_order?: string; per_page?: number }): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.API_URL}/invoice-headers`, {
      headers: this.getAuthHeaders(),
      params: params || {}
    }).pipe(
      timeout(10000),
      retry(2),
      tap(response => {
        if (response.success) {
          const headers = response.data?.data || response.data || [];
          this.headersSubject.next(headers);
        }
      }),
      catchError(this.handleError.bind(this))
    );
  }

  getHeader(id: number): Observable<ApiResponse<InvoiceHeader>> {
    return this.http.get<ApiResponse<InvoiceHeader>>(`${this.API_URL}/invoice-headers/${id}`, {
      headers: this.getAuthHeaders()
    });
  }

  createHeader(header: Omit<InvoiceHeader, 'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'tenant'>): Observable<ApiResponse<InvoiceHeader>> {
    return this.http.post<ApiResponse<InvoiceHeader>>(`${this.API_URL}/invoice-headers`, header, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          const currentHeaders = this.headersSubject.value;
          this.headersSubject.next([...currentHeaders, response.data]);
          this.showSuccessMessage('En-tête de facture créé avec succès!');
        }
      })
    );
  }

  updateHeader(id: number, header: Partial<InvoiceHeader>): Observable<ApiResponse<InvoiceHeader>> {
    return this.http.put<ApiResponse<InvoiceHeader>>(`${this.API_URL}/invoice-headers/${id}`, header, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          const currentHeaders = this.headersSubject.value;
          const index = currentHeaders.findIndex(h => h.id === id);
          if (index !== -1) {
            currentHeaders[index] = response.data;
            this.headersSubject.next([...currentHeaders]);
          }
          this.showSuccessMessage('En-tête de facture mis à jour avec succès!');
        }
      })
    );
  }

  deleteHeader(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.API_URL}/invoice-headers/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          const currentHeaders = this.headersSubject.value;
          this.headersSubject.next(currentHeaders.filter(h => h.id !== id));
          this.showSuccessMessage('En-tête de facture supprimé avec succès!');
        }
      })
    );
  }

  setAsDefault(id: number): Observable<ApiResponse<InvoiceHeader>> {
    return this.http.post<ApiResponse<InvoiceHeader>>(`${this.API_URL}/invoice-headers/${id}/set-default`, {}, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          const currentHeaders = this.headersSubject.value;
          const updatedHeaders = currentHeaders.map(h => ({
            ...h,
            is_default: h.id === id
          }));
          this.headersSubject.next(updatedHeaders);
          this.showSuccessMessage('En-tête défini comme par défaut!');
        }
      })
    );
  }

  duplicateHeader(id: number, newName?: string): Observable<ApiResponse<InvoiceHeader>> {
    const payload = newName ? { name: newName } : {};
    return this.http.post<ApiResponse<InvoiceHeader>>(`${this.API_URL}/invoice-headers/${id}/duplicate`, payload, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          const currentHeaders = this.headersSubject.value;
          this.headersSubject.next([...currentHeaders, response.data]);
          this.showSuccessMessage('En-tête de facture dupliqué avec succès!');
        }
      })
    );
  }

  getCurrentHeaders(): InvoiceHeader[] {
    return this.headersSubject.value;
  }

  getDefaultHeader(): InvoiceHeader | null {
    return this.headersSubject.value.find(h => h.is_default) || null;
  }

  // Helper methods for SweetAlert2 notifications
  private showSuccessMessage(message: string): void {
    Swal.fire({
      icon: 'success',
      title: 'Succès!',
      text: message,
      timer: 3000,
      showConfirmButton: false
    });
  }

  showErrorMessage(message: string): void {
    Swal.fire({
      icon: 'error',
      title: 'Erreur!',
      text: message
    });
  }

  showDeleteConfirmation(headerName: string): Promise<any> {
    return Swal.fire({
      title: 'Êtes-vous sûr?',
      text: `Voulez-vous vraiment supprimer l'en-tête "${headerName}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Oui, supprimer!',
      cancelButtonText: 'Annuler'
    });
  }

  showDuplicatePrompt(headerName: string): Promise<any> {
    return Swal.fire({
      title: 'Dupliquer l\'en-tête',
      text: `Nom pour la copie de "${headerName}":`,
      input: 'text',
      inputValue: `${headerName} (Copie)`,
      showCancelButton: true,
      confirmButtonText: 'Dupliquer',
      cancelButtonText: 'Annuler',
      inputValidator: (value) => {
        if (!value) {
          return 'Vous devez saisir un nom!';
        }
        return null;
      }
    });
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Une erreur est survenue';
    
    if (error.error instanceof ErrorEvent) {
      // Erreur côté client
      errorMessage = `Erreur: ${error.error.message}`;
    } else {
      // Erreur côté serveur
      errorMessage = `Erreur ${error.status}: ${error.message}`;
      if (error.error?.message) {
        errorMessage = error.error.message;
      }
    }
    
    console.error('InvoiceHeaderService Error:', error);
    this.showErrorMessage(errorMessage);
    
    return throwError(() => new Error(errorMessage));
  }
}
