import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, catchError, timeout, retry, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';

export interface OrganisationSetting {
  id?: number;
  tenant_id?: number;
  timezone: string;
  language: string;
  date_format: string;
  number_format: string;
  invoice_prefix: string;
  invoice_counter: number;
  quote_prefix: string;
  quote_counter: number;
  email_notifications: boolean;
  sms_notifications: boolean;
  browser_notifications: boolean;
  session_timeout: number;
  password_expiry: number;
  two_factor_auth: boolean;
  auto_archive_invoices: boolean;
  archive_after_days: number;
  backup_frequency: 'daily' | 'weekly' | 'monthly';
  created_at?: string;
  updated_at?: string;
  tenant?: any;
}

export interface SettingOptions {
  timezones: { [key: string]: string };
  languages: { [key: string]: string };
  date_formats: { [key: string]: string };
  number_formats: { [key: string]: string };
  backup_frequencies: { [key: string]: string };
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
export class OrganisationSettingService {
  private readonly API_URL = environment.apiUrl;
  private settingsSubject = new BehaviorSubject<OrganisationSetting | null>(null);
  public settings$ = this.settingsSubject.asObservable();

  constructor(private http: HttpClient) {}

  getSettings(): Observable<ApiResponse<OrganisationSetting>> {
    return this.http.get<ApiResponse<OrganisationSetting>>(`${this.API_URL}/organisation-settings-public`).pipe(
      timeout(10000),
      retry(2),
      tap(response => {
        if (response.success && response.data) {
          this.settingsSubject.next(response.data);
        }
      }),
      catchError(this.handleError.bind(this))
    );
  }

  updateSettings(settings: Partial<OrganisationSetting>): Observable<ApiResponse<OrganisationSetting>> {
    return this.http.put<ApiResponse<OrganisationSetting>>(`${this.API_URL}/organisation-settings-public`, settings).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.settingsSubject.next(response.data);
          this.showSuccessMessage('Paramètres mis à jour avec succès!');
        }
      }),
      catchError(this.handleError.bind(this))
    );
  }

  resetSettings(): Observable<ApiResponse<OrganisationSetting>> {
    return this.http.post<ApiResponse<OrganisationSetting>>(`${this.API_URL}/organisation-settings-public/reset`, {}).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.settingsSubject.next(response.data);
          this.showSuccessMessage('Paramètres réinitialisés aux valeurs par défaut!');
        }
      }),
      catchError(this.handleError.bind(this))
    );
  }

  getOptions(): Observable<ApiResponse<SettingOptions>> {
    return this.http.get<ApiResponse<SettingOptions>>(`${this.API_URL}/organisation-settings/options`, {
      headers: this.getAuthHeaders()
    });
  }

  getNextInvoiceNumber(): Observable<ApiResponse<{ next_invoice_number: string }>> {
    return this.http.get<ApiResponse<{ next_invoice_number: string }>>(`${this.API_URL}/organisation-settings/next-invoice-number`, {
      headers: this.getAuthHeaders()
    });
  }

  getNextQuoteNumber(): Observable<ApiResponse<{ next_quote_number: string }>> {
    return this.http.get<ApiResponse<{ next_quote_number: string }>>(`${this.API_URL}/organisation-settings/next-quote-number`, {
      headers: this.getAuthHeaders()
    });
  }

  testNotifications(type: 'email' | 'sms' | 'browser'): Observable<ApiResponse<{ success: boolean; message: string }>> {
    return this.http.post<ApiResponse<{ success: boolean; message: string }>>(`${this.API_URL}/organisation-settings/test-notifications`, { type }, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        if (response.success && response.data.success) {
          this.showSuccessMessage(response.data.message);
        } else if (response.success && !response.data.success) {
          this.showWarningMessage(response.data.message);
        }
      })
    );
  }

  getCurrentSettings(): OrganisationSetting | null {
    return this.settingsSubject.value;
  }

  // Helper methods for validation
  validateInvoicePrefix(prefix: string): boolean {
    return /^[A-Z0-9-_]{1,10}$/.test(prefix);
  }

  validateQuotePrefix(prefix: string): boolean {
    return /^[A-Z0-9-_]{1,10}$/.test(prefix);
  }

  validateSessionTimeout(timeout: number): boolean {
    return timeout >= 5 && timeout <= 480;
  }

  validatePasswordExpiry(days: number): boolean {
    return days >= 30 && days <= 365;
  }

  validateArchiveDays(days: number): boolean {
    return days >= 30;
  }

  // Helper methods for formatting
  formatNextNumber(prefix: string, counter: number): string {
    return prefix + counter.toString().padStart(4, '0');
  }

  getTimezoneDisplay(timezone: string): string {
    const timezones: { [key: string]: string } = {
      'Europe/Paris': 'Paris (GMT+1)',
      'Africa/Conakry': 'Conakry (GMT+0)',
      'America/New_York': 'New York (GMT-5)',
      'Asia/Tokyo': 'Tokyo (GMT+9)',
      'UTC': 'UTC (GMT+0)'
    };
    return timezones[timezone] || timezone;
  }

  getLanguageDisplay(language: string): string {
    const languages: { [key: string]: string } = {
      'fr': 'Français',
      'en': 'English',
      'es': 'Español'
    };
    return languages[language] || language;
  }

  getBackupFrequencyDisplay(frequency: string): string {
    const frequencies: { [key: string]: string } = {
      'daily': 'Quotidienne',
      'weekly': 'Hebdomadaire',
      'monthly': 'Mensuelle'
    };
    return frequencies[frequency] || frequency;
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

  private showWarningMessage(message: string): void {
    Swal.fire({
      icon: 'warning',
      title: 'Attention!',
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

  showResetConfirmation(): Promise<any> {
    return Swal.fire({
      title: 'Êtes-vous sûr?',
      text: 'Voulez-vous vraiment réinitialiser tous les paramètres aux valeurs par défaut?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Oui, réinitialiser!',
      cancelButtonText: 'Annuler'
    });
  }

  showTestNotificationPrompt(): Promise<any> {
    return Swal.fire({
      title: 'Tester les notifications',
      text: 'Quel type de notification voulez-vous tester?',
      icon: 'question',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Email',
      denyButtonText: 'SMS',
      cancelButtonText: 'Navigateur'
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
    
    console.error('OrganisationSettingService Error:', error);
    this.showErrorMessage(errorMessage);
    
    return throwError(() => new Error(errorMessage));
  }
}
