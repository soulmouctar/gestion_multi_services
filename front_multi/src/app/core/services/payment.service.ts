import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timeout, retry, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PaginatedResponse } from '../models';

export interface Payment {
  id: number;
  tenant_id: number;
  type: 'CLIENT' | 'SUPPLIER' | 'DEPOT' | 'RETRAIT';
  method: 'ORANGE_MONEY' | 'VIREMENT' | 'CHEQUE' | 'ESPECES';
  amount: number;
  currency: string;
  proof?: string;
  payment_date: string;
  description?: string;
  reference?: string;
  status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  created_at?: string;
  updated_at?: string;
}

export interface PaymentFilters {
  search?: string;
  type?: Payment['type'];
  method?: Payment['method'];
  currency?: string;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  status?: Payment['status'];
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface PaymentStatistics {
  total_payments: number;
  total_amount: number;
  by_type: {
    CLIENT: number;
    SUPPLIER: number;
    DEPOT: number;
    RETRAIT: number;
  };
  by_method: {
    ORANGE_MONEY: number;
    VIREMENT: number;
    CHEQUE: number;
    ESPECES: number;
  };
  monthly_trend: Array<{
    period: string;
    amount: number;
    count: number;
  }>;
  average_payment: number;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Get paginated list of payments with filters
   */
  getPayments(filters: PaymentFilters = {}): Observable<ApiResponse<PaginatedResponse<Payment>>> {
    let params = new HttpParams();
    
    Object.keys(filters).forEach(key => {
      const value = (filters as any)[key];
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value.toString());
      }
    });

    return this.http.get<ApiResponse<PaginatedResponse<Payment>>>(`${this.API_URL}/payments`, { params })
      .pipe(
        timeout(10000),
        retry(2),
        catchError(this.handleError)
      );
  }

  /**
   * Get single payment by ID
   */
  getPayment(id: number): Observable<ApiResponse<Payment>> {
    return this.http.get<ApiResponse<Payment>>(`${this.API_URL}/payments/${id}`)
      .pipe(
        timeout(10000),
        retry(2),
        catchError(this.handleError)
      );
  }

  /**
   * Create new payment
   */
  createPayment(payment: Partial<Payment>): Observable<ApiResponse<Payment>> {
    return this.http.post<ApiResponse<Payment>>(`${this.API_URL}/payments`, payment)
      .pipe(
        timeout(10000),
        retry(1),
        catchError(this.handleError)
      );
  }

  /**
   * Update existing payment
   */
  updatePayment(id: number, payment: Partial<Payment>): Observable<ApiResponse<Payment>> {
    return this.http.put<ApiResponse<Payment>>(`${this.API_URL}/payments/${id}`, payment)
      .pipe(
        timeout(10000),
        retry(1),
        catchError(this.handleError)
      );
  }

  /**
   * Delete payment
   */
  deletePayment(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API_URL}/payments/${id}`)
      .pipe(
        timeout(10000),
        retry(1),
        catchError(this.handleError)
      );
  }

  /**
   * Get payment statistics
   */
  getStatistics(filters: Partial<PaymentFilters> = {}): Observable<ApiResponse<PaymentStatistics>> {
    let params = new HttpParams();
    
    if (filters.date_from) params = params.set('date_from', filters.date_from);
    if (filters.date_to) params = params.set('date_to', filters.date_to);
    if (filters.type) params = params.set('type', filters.type);
    if (filters.method) params = params.set('method', filters.method);

    return this.http.get<ApiResponse<PaymentStatistics>>(`${this.API_URL}/payments/statistics`, { params })
      .pipe(
        timeout(10000),
        retry(2),
        catchError(this.handleError)
      );
  }

  /**
   * Get payments by date range
   */
  getPaymentsByDateRange(dateFrom: string, dateTo: string): Observable<ApiResponse<Payment[]>> {
    const params = new HttpParams()
      .set('date_from', dateFrom)
      .set('date_to', dateTo);

    return this.http.get<ApiResponse<Payment[]>>(`${this.API_URL}/payments/date-range`, { params })
      .pipe(
        timeout(10000),
        retry(2),
        catchError(this.handleError)
      );
  }

  /**
   * Bulk operations
   */
  bulkDelete(paymentIds: number[]): Observable<ApiResponse<{ deleted_count: number }>> {
    return this.http.post<ApiResponse<{ deleted_count: number }>>(`${this.API_URL}/payments/bulk-delete`, {
      payment_ids: paymentIds
    }).pipe(
      timeout(15000),
      retry(1),
      catchError(this.handleError)
    );
  }

  /**
   * Export payments
   */
  exportPayments(format: 'csv' | 'excel' | 'pdf' = 'csv', filters: PaymentFilters = {}): Observable<Blob> {
    let params = new HttpParams().set('format', format);
    
    Object.keys(filters).forEach(key => {
      const value = (filters as any)[key];
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value.toString());
      }
    });

    return this.http.get(`${this.API_URL}/payments/export`, { 
      params, 
      responseType: 'blob' 
    }).pipe(
      timeout(30000),
      retry(1),
      catchError(this.handleError)
    );
  }

  /**
   * Utility methods
   */
  getTypeLabel(type: Payment['type']): string {
    const labels = {
      'CLIENT': 'Paiement Client',
      'SUPPLIER': 'Paiement Fournisseur',
      'DEPOT': 'Dépôt',
      'RETRAIT': 'Retrait'
    };
    return labels[type] || type;
  }

  getTypeClass(type: Payment['type']): string {
    const classes = {
      'CLIENT': 'badge-success',
      'SUPPLIER': 'badge-warning',
      'DEPOT': 'badge-info',
      'RETRAIT': 'badge-danger'
    };
    return classes[type] || 'badge-secondary';
  }

  getMethodLabel(method: Payment['method']): string {
    const labels = {
      'ORANGE_MONEY': 'Orange Money',
      'VIREMENT': 'Virement Bancaire',
      'CHEQUE': 'Chèque',
      'ESPECES': 'Espèces'
    };
    return labels[method] || method;
  }

  getMethodIcon(method: Payment['method']): string {
    const icons = {
      'ORANGE_MONEY': 'cilMobile',
      'VIREMENT': 'cilBank',
      'CHEQUE': 'cilNotes',
      'ESPECES': 'cilMoney'
    };
    return icons[method] || 'cilMoney';
  }

  getStatusLabel(status: Payment['status']): string {
    const labels = {
      'PENDING': 'En attente',
      'COMPLETED': 'Terminé',
      'FAILED': 'Échoué',
      'CANCELLED': 'Annulé'
    };
    return labels[status || 'PENDING'] || status || 'En attente';
  }

  getStatusClass(status: Payment['status']): string {
    const classes = {
      'PENDING': 'badge-warning',
      'COMPLETED': 'badge-success',
      'FAILED': 'badge-danger',
      'CANCELLED': 'badge-secondary'
    };
    return classes[status || 'PENDING'] || 'badge-secondary';
  }

  formatAmount(amount: number | undefined, currency: string = 'GNF'): string {
    if (!amount) return '-';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(date));
  }

  /**
   * Validation helpers
   */
  validatePaymentData(payment: Partial<Payment>): string[] {
    const errors: string[] = [];
    
    if (!payment.type) errors.push('Le type de paiement est requis');
    if (!payment.method) errors.push('La méthode de paiement est requise');
    if (!payment.amount || payment.amount <= 0) errors.push('Le montant doit être supérieur à 0');
    if (!payment.payment_date) errors.push('La date de paiement est requise');
    
    return errors;
  }

  /**
   * Calculate totals for a list of payments
   */
  calculateTotals(payments: Payment[]): {
    total: number;
    byType: { [key: string]: number };
    byMethod: { [key: string]: number };
    byCurrency: { [key: string]: number };
  } {
    const totals = {
      total: 0,
      byType: {} as { [key: string]: number },
      byMethod: {} as { [key: string]: number },
      byCurrency: {} as { [key: string]: number }
    };

    payments.forEach(payment => {
      totals.total += payment.amount;
      
      // By type
      totals.byType[payment.type] = (totals.byType[payment.type] || 0) + payment.amount;
      
      // By method
      totals.byMethod[payment.method] = (totals.byMethod[payment.method] || 0) + payment.amount;
      
      // By currency
      const currency = payment.currency || 'GNF';
      totals.byCurrency[currency] = (totals.byCurrency[currency] || 0) + payment.amount;
    });

    return totals;
  }

  /**
   * Error handling
   */
  private handleError = (error: any): Observable<never> => {
    console.error('PaymentService Error:', error);
    
    let errorMessage = 'Une erreur est survenue';
    
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    } else if (error.status === 0) {
      errorMessage = 'Impossible de contacter le serveur';
    } else if (error.status >= 500) {
      errorMessage = 'Erreur serveur';
    } else if (error.status === 404) {
      errorMessage = 'Paiement non trouvé';
    } else if (error.status === 422) {
      errorMessage = 'Données invalides';
    }
    
    return throwError(() => new Error(errorMessage));
  };

  /**
   * Show success/error messages
   */
  showSuccessMessage(message: string): void {
    console.log('Success:', message);
  }

  showErrorMessage(message: string): void {
    console.error('Error:', message);
  }
}
