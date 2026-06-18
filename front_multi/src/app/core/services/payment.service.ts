import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timeout, retry, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PaginatedResponse } from '../models';

export type PaymentType   = 'CLIENT' | 'SUPPLIER' | 'DEPOT' | 'RETRAIT';
export type PaymentMethod = 'ORANGE_MONEY' | 'WAVE' | 'MTN_MONEY' | 'VIREMENT' | 'CHEQUE' | 'ESPECES';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface Payment {
  id: number;
  tenant_id: number;
  client_id?: number;
  paid_by_client_id?: number | null;
  invoice_id?: number;
  receipt_number?: string;
  type: PaymentType;
  method: PaymentMethod;
  amount: number;
  currency: string;
  exchange_rate?: number;
  amount_gnf?: number;
  proof?: string;
  reference?: string;
  description?: string;
  status: PaymentStatus;
  payment_date: string;
  client?: { id: number; name: string; phone: string };
  paid_by_client?: { id: number; name: string } | null;
  invoice?: { id: number; invoice_number: string; total_amount: number; paid_amount: number; remaining_balance: number; status: string };
  created_at?: string;
  updated_at?: string;
}

export interface PaymentFilters {
  search?: string;
  type?: PaymentType;
  method?: PaymentMethod;
  status?: PaymentStatus;
  currency?: string;
  client_id?: number;
  invoice_id?: number;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface PaymentReceipt {
  receipt_number: string;
  payment_date: string;
  amount: number;
  currency: string;
  exchange_rate?: number;
  amount_gnf?: number;
  method: PaymentMethod;
  type: PaymentType;
  reference?: string;
  description?: string;
  status: PaymentStatus;
  client?: { id: number; name: string; phone: string } | null;
  invoice?: {
    id: number; invoice_number: string;
    total_amount: number; paid_amount: number;
    remaining_balance: number; status: string;
  } | null;
  organisation: { name: string; address?: string; phone?: string };
  generated_at: string;
}

export interface ClientBalance {
  client: { id: number; name: string; phone: string };
  total_invoiced: number;
  total_paid: number;
  total_remaining: number;
  available_credit_gnf?: number;
  total_return_credits?: number;
  invoices: Array<{
    id: number; invoice_number: string;
    total_amount: number; paid_amount: number;
    remaining_balance: number; status: string; due_date: string;
    total_amount_gnf?: number;
    paid_amount_gnf?: number;
    remaining_balance_gnf?: number;
  }>;
  recent_payments: Array<{
    id: number; receipt_number: string;
    amount: number; currency: string; method: PaymentMethod; payment_date: string;
    amount_gnf?: number;
    exchange_rate?: number;
    invoice_id?: number | null;
  }>;
}

export interface ClientBalanceSummary {
  client_id: number;
  client_name: string;
  client_phone: string;
  total_invoiced: number;
  total_paid: number;
  total_remaining: number;
  available_credit_gnf?: number;
  invoice_count: number;
}

export interface PaymentStatistics {
  total_payments: number;
  total_amount: number;
  average_payment: number;
  by_type: { CLIENT: number; SUPPLIER: number; DEPOT: number; RETRAIT: number };
  by_method: { ORANGE_MONEY: number; WAVE: number; MTN_MONEY: number; VIREMENT: number; CHEQUE: number; ESPECES: number };
  monthly_trend: Array<{ period: string; amount: number; count: number }>;
  invoices_summary: {
    total: number; paye: number; partiel: number; impaye: number; total_remaining: number;
  };
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getPayments(filters: PaymentFilters = {}): Observable<ApiResponse<PaginatedResponse<Payment>>> {
    let params = new HttpParams();
    Object.keys(filters).forEach(key => {
      const val = (filters as any)[key];
      if (val !== undefined && val !== null && val !== '') params = params.set(key, val.toString());
    });
    return this.http.get<ApiResponse<PaginatedResponse<Payment>>>(`${this.API_URL}/payments`, { params })
      .pipe(timeout(10000), retry(2), catchError(this.handleError));
  }

  getPayment(id: number): Observable<ApiResponse<Payment>> {
    return this.http.get<ApiResponse<Payment>>(`${this.API_URL}/payments/${id}`)
      .pipe(timeout(10000), catchError(this.handleError));
  }

  createPayment(data: Partial<Payment>): Observable<ApiResponse<Payment>> {
    return this.http.post<ApiResponse<Payment>>(`${this.API_URL}/payments`, data)
      .pipe(timeout(10000), catchError(this.handleError));
  }

  updatePayment(id: number, data: Partial<Payment>): Observable<ApiResponse<Payment>> {
    return this.http.put<ApiResponse<Payment>>(`${this.API_URL}/payments/${id}`, data)
      .pipe(timeout(10000), catchError(this.handleError));
  }

  deletePayment(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API_URL}/payments/${id}`)
      .pipe(timeout(10000), catchError(this.handleError));
  }

  getReceipt(id: number): Observable<ApiResponse<PaymentReceipt>> {
    return this.http.get<ApiResponse<PaymentReceipt>>(`${this.API_URL}/payments/${id}/receipt`)
      .pipe(timeout(10000), catchError(this.handleError));
  }

  getClientBalance(clientId: number): Observable<ApiResponse<ClientBalance>> {
    return this.http.get<ApiResponse<ClientBalance>>(`${this.API_URL}/clients/${clientId}/balance`)
      .pipe(timeout(10000), catchError(this.handleError));
  }

  getClientsBalances(): Observable<ApiResponse<ClientBalanceSummary[]>> {
    return this.http.get<ApiResponse<ClientBalanceSummary[]>>(`${this.API_URL}/payments/clients-balances`)
      .pipe(timeout(10000), catchError(this.handleError));
  }

  getStatistics(filters: Partial<PaymentFilters> = {}): Observable<ApiResponse<PaymentStatistics>> {
    let params = new HttpParams();
    if (filters.date_from) params = params.set('date_from', filters.date_from);
    if (filters.date_to)   params = params.set('date_to', filters.date_to);
    return this.http.get<ApiResponse<PaymentStatistics>>(`${this.API_URL}/payments/statistics`, { params })
      .pipe(timeout(10000), retry(2), catchError(this.handleError));
  }

  getPaymentsByDateRange(dateFrom: string, dateTo: string): Observable<ApiResponse<Payment[]>> {
    const params = new HttpParams().set('date_from', dateFrom).set('date_to', dateTo);
    return this.http.get<ApiResponse<Payment[]>>(`${this.API_URL}/payments/date-range`, { params })
      .pipe(timeout(10000), catchError(this.handleError));
  }

  bulkDelete(ids: number[]): Observable<ApiResponse<{ deleted_count: number }>> {
    return this.http.post<ApiResponse<{ deleted_count: number }>>(`${this.API_URL}/payments/bulk-delete`, { payment_ids: ids })
      .pipe(timeout(15000), catchError(this.handleError));
  }

  exportPayments(format: 'csv' | 'excel' | 'pdf' = 'csv', filters: PaymentFilters = {}): Observable<Blob> {
    let params = new HttpParams().set('format', format);
    Object.keys(filters).forEach(key => {
      const val = (filters as any)[key];
      if (val !== undefined && val !== null && val !== '') params = params.set(key, val.toString());
    });
    return this.http.get(`${this.API_URL}/payments/export`, { params, responseType: 'blob' })
      .pipe(timeout(30000), catchError(this.handleError));
  }

  // ─── Labels & helpers ────────────────────────────────────────────────────────

  getTypeLabel(type: PaymentType): string {
    return { CLIENT: 'Paiement Client', SUPPLIER: 'Fournisseur', DEPOT: 'Dépôt', RETRAIT: 'Retrait' }[type] ?? type;
  }

  getMethodLabel(method: PaymentMethod): string {
    return {
      ORANGE_MONEY: 'Orange Money', WAVE: 'Wave', MTN_MONEY: 'MTN Money',
      VIREMENT: 'Virement Bancaire', CHEQUE: 'Chèque', ESPECES: 'Espèces',
    }[method] ?? method;
  }

  getMethodIcon(method: PaymentMethod): string {
    return {
      ORANGE_MONEY: 'cilMobile', WAVE: 'cilMobile', MTN_MONEY: 'cilMobile',
      VIREMENT: 'cilBank', CHEQUE: 'cilNotes', ESPECES: 'cilMoney',
    }[method] ?? 'cilMoney';
  }

  getStatusLabel(status: PaymentStatus): string {
    return { PENDING: 'En attente', COMPLETED: 'Complété', FAILED: 'Échoué', CANCELLED: 'Annulé' }[status] ?? status;
  }

  isIncoming(type: PaymentType): boolean {
    return type === 'CLIENT' || type === 'DEPOT';
  }

  formatAmount(amount: number | undefined, currency = 'GNF'): string {
    if (!amount) return '-';
    try {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
    } catch {
      return `${amount.toLocaleString('fr-FR')} ${currency}`;
    }
  }

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
  }

  private handleError = (error: any): Observable<never> => {
    let msg = 'Une erreur est survenue';
    if (error.error?.message) msg = error.error.message;
    else if (error.status === 0) msg = 'Impossible de contacter le serveur';
    else if (error.status >= 500) msg = 'Erreur serveur';
    else if (error.status === 404) msg = 'Ressource non trouvée';
    else if (error.status === 422) msg = 'Données invalides';
    return throwError(() => new Error(msg));
  };
}
