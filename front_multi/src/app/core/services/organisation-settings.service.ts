import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface OrganisationSettings {
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
}

@Injectable({
  providedIn: 'root'
})
export class OrganisationSettingsService {
  private readonly API_URL = environment.apiUrl;
  private settingsSubject = new BehaviorSubject<OrganisationSettings | null>(null);
  public settings$ = this.settingsSubject.asObservable();

  constructor(private http: HttpClient) {}

  getSettings(tenantId?: number): Observable<OrganisationSettings> {
    const url = tenantId ? 
      `${this.API_URL}/organisation-settings/${tenantId}` : 
      `${this.API_URL}/organisation-settings`;
    
    return this.http.get<OrganisationSettings>(url, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(settings => {
        this.settingsSubject.next(settings);
      })
    );
  }

  updateSettings(settings: Partial<OrganisationSettings>, tenantId?: number): Observable<OrganisationSettings> {
    const url = tenantId ? 
      `${this.API_URL}/organisation-settings/${tenantId}` : 
      `${this.API_URL}/organisation-settings`;
    
    return this.http.put<OrganisationSettings>(url, settings, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(updatedSettings => {
        this.settingsSubject.next(updatedSettings);
      })
    );
  }

  resetSettings(tenantId?: number): Observable<OrganisationSettings> {
    const url = tenantId ? 
      `${this.API_URL}/organisation-settings/${tenantId}/reset` : 
      `${this.API_URL}/organisation-settings/reset`;
    
    return this.http.post<OrganisationSettings>(url, {}, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(resetSettings => {
        this.settingsSubject.next(resetSettings);
      })
    );
  }

  getCurrentSettings(): OrganisationSettings | null {
    return this.settingsSubject.value;
  }

  // Helper method to get formatted date based on settings
  getFormattedDate(date: Date): string {
    const settings = this.settingsSubject.value;
    if (!settings) return date.toLocaleDateString();

    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();

    switch (settings.date_format) {
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'DD-MM-YYYY':
        return `${day}-${month}-${year}`;
      default:
        return `${day}/${month}/${year}`;
    }
  }

  // Helper method to format numbers based on settings
  formatNumber(num: number): string {
    const settings = this.settingsSubject.value;
    if (!settings) return num.toString();

    switch (settings.number_format) {
      case 'fr':
        return num.toLocaleString('fr-FR');
      case 'en':
        return num.toLocaleString('en-US');
      case 'de':
        return num.toLocaleString('de-DE');
      default:
        return num.toString();
    }
  }

  // Helper method to format currency
  formatCurrency(amount: number, currency: string = 'GNF'): string {
    const settings = this.settingsSubject.value;
    if (!settings) return `${amount} ${currency}`;

    switch (settings.number_format) {
      case 'fr':
        return amount.toLocaleString('fr-FR', { style: 'currency', currency: currency === 'GNF' ? 'GNF' : 'EUR' });
      case 'en':
        return amount.toLocaleString('en-US', { style: 'currency', currency: currency === 'GNF' ? 'GNF' : 'USD' });
      case 'de':
        return amount.toLocaleString('de-DE', { style: 'currency', currency: currency === 'GNF' ? 'GNF' : 'EUR' });
      default:
        return `${amount} ${currency}`;
    }
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }
}
