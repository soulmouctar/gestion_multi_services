import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, catchError, timeout, retry } from 'rxjs';
import { throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';

export interface Contact {
  id?: number;
  tenant_id?: number;
  type: 'phone' | 'email' | 'address' | 'website' | 'fax' | 'whatsapp' | 'telegram';
  name: string;
  value: string;
  description?: string;
  is_default: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  tenant?: any;
}

export interface ContactType {
  [key: string]: string;
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
export class ContactService {
  private readonly API_URL = environment.apiUrl;
  private contactsSubject = new BehaviorSubject<Contact[]>([]);
  public contacts$ = this.contactsSubject.asObservable();

  constructor(private http: HttpClient) {}

  getContacts(params?: { type?: string; active?: boolean; sort_by?: string; sort_order?: string; per_page?: number }): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.API_URL}/contacts`, {
      headers: this.getAuthHeaders(),
      params: params || {}
    }).pipe(
      timeout(10000), // 10 seconds timeout
      retry(2), // Retry up to 2 times
      tap(response => {
        if (response.success) {
          const contacts = response.data?.data || response.data || [];
          this.contactsSubject.next(contacts);
        }
      }),
      catchError(this.handleError.bind(this))
    );
  }

  getContact(id: number): Observable<ApiResponse<Contact>> {
    return this.http.get<ApiResponse<Contact>>(`${this.API_URL}/contacts/${id}`, {
      headers: this.getAuthHeaders()
    });
  }

  createContact(contact: Omit<Contact, 'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'tenant'>): Observable<ApiResponse<Contact>> {
    return this.http.post<ApiResponse<Contact>>(`${this.API_URL}/contacts`, contact, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          const currentContacts = this.contactsSubject.value;
          this.contactsSubject.next([...currentContacts, response.data]);
          this.showSuccessMessage('Contact créé avec succès!');
        }
      })
    );
  }

  updateContact(id: number, contact: Partial<Contact>): Observable<ApiResponse<Contact>> {
    return this.http.put<ApiResponse<Contact>>(`${this.API_URL}/contacts/${id}`, contact, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          const currentContacts = this.contactsSubject.value;
          const index = currentContacts.findIndex(c => c.id === id);
          if (index !== -1) {
            currentContacts[index] = response.data;
            this.contactsSubject.next([...currentContacts]);
          }
          this.showSuccessMessage('Contact mis à jour avec succès!');
        }
      })
    );
  }

  deleteContact(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.API_URL}/contacts/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          const currentContacts = this.contactsSubject.value;
          this.contactsSubject.next(currentContacts.filter(c => c.id !== id));
          this.showSuccessMessage('Contact supprimé avec succès!');
        }
      })
    );
  }

  setAsDefault(id: number): Observable<ApiResponse<Contact>> {
    return this.http.post<ApiResponse<Contact>>(`${this.API_URL}/contacts/${id}/set-default`, {}, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          const currentContacts = this.contactsSubject.value;
          const updatedContacts = currentContacts.map(c => ({
            ...c,
            is_default: c.id === id ? true : (c.type === response.data.type ? false : c.is_default)
          }));
          this.contactsSubject.next(updatedContacts);
          this.showSuccessMessage('Contact défini comme par défaut!');
        }
      })
    );
  }

  getContactTypes(): Observable<ApiResponse<ContactType>> {
    return this.http.get<ApiResponse<ContactType>>(`${this.API_URL}/contact-types`, {
      headers: this.getAuthHeaders()
    });
  }

  getCurrentContacts(): Contact[] {
    return this.contactsSubject.value;
  }

  getContactsByType(type: string): Contact[] {
    return this.contactsSubject.value.filter(c => c.type === type);
  }

  getDefaultContact(type?: string): Contact | null {
    const contacts = this.contactsSubject.value;
    if (type) {
      return contacts.find(c => c.type === type && c.is_default) || null;
    }
    return contacts.find(c => c.is_default) || null;
  }

  getActiveContacts(): Contact[] {
    return this.contactsSubject.value.filter(c => c.is_active);
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

  showDeleteConfirmation(contactName: string): Promise<any> {
    return Swal.fire({
      title: 'Êtes-vous sûr?',
      text: `Voulez-vous vraiment supprimer le contact "${contactName}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Oui, supprimer!',
      cancelButtonText: 'Annuler'
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
    
    console.error('ContactService Error:', error);
    this.showErrorMessage(errorMessage);
    
    return throwError(() => new Error(errorMessage));
  }
}
