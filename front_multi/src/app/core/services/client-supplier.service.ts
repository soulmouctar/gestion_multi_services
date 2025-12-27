import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { 
  Client, 
  Supplier, 
  Invoice, 
  Payment, 
  Advance, 
  Reminder,
  ApiResponse, 
  PaginatedResponse, 
  FilterOptions 
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class ClientSupplierService {
  private clients = new BehaviorSubject<Client[]>([]);
  private suppliers = new BehaviorSubject<Supplier[]>([]);
  private invoices = new BehaviorSubject<Invoice[]>([]);
  private payments = new BehaviorSubject<Payment[]>([]);
  private advances = new BehaviorSubject<Advance[]>([]);
  
  clients$ = this.clients.asObservable();
  suppliers$ = this.suppliers.asObservable();
  invoices$ = this.invoices.asObservable();
  payments$ = this.payments.asObservable();
  advances$ = this.advances.asObservable();
  
  constructor(private apiService: ApiService) {}
  
  // Client Management
  getClients(options?: FilterOptions): Observable<PaginatedResponse<Client>> {
    return this.apiService.getPaginated('clients', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.clients.next(response.data);
        }
      })
    );
  }
  
  createClient(clientData: Partial<Client>): Observable<ApiResponse<Client>> {
    return this.apiService.post('clients', clientData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentClients = this.clients.value;
          this.clients.next([...currentClients, response.data]);
        }
      })
    );
  }
  
  updateClient(id: string, clientData: Partial<Client>): Observable<ApiResponse<Client>> {
    return this.apiService.put(`clients/${id}`, clientData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentClients = this.clients.value;
          const updatedClients = currentClients.map(client => 
            client.id === id ? response.data! : client
          );
          this.clients.next(updatedClients);
        }
      })
    );
  }
  
  deleteClient(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`clients/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentClients = this.clients.value;
          const filteredClients = currentClients.filter(client => client.id !== id);
          this.clients.next(filteredClients);
        }
      })
    );
  }
  
  getClientDetails(id: string): Observable<ApiResponse<Client>> {
    return this.apiService.get(`clients/${id}`);
  }
  
  getClientBalance(id: string): Observable<ApiResponse<{ balanceUSD: number; balanceGNF: number }>> {
    return this.apiService.get(`clients/${id}/balance`);
  }
  
  // Supplier Management
  getSuppliers(options?: FilterOptions): Observable<PaginatedResponse<Supplier>> {
    return this.apiService.getPaginated('suppliers', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.suppliers.next(response.data);
        }
      })
    );
  }
  
  createSupplier(supplierData: Partial<Supplier>): Observable<ApiResponse<Supplier>> {
    return this.apiService.post('suppliers', supplierData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentSuppliers = this.suppliers.value;
          this.suppliers.next([...currentSuppliers, response.data]);
        }
      })
    );
  }
  
  updateSupplier(id: string, supplierData: Partial<Supplier>): Observable<ApiResponse<Supplier>> {
    return this.apiService.put(`suppliers/${id}`, supplierData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentSuppliers = this.suppliers.value;
          const updatedSuppliers = currentSuppliers.map(supplier => 
            supplier.id === id ? response.data! : supplier
          );
          this.suppliers.next(updatedSuppliers);
        }
      })
    );
  }
  
  deleteSupplier(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`suppliers/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentSuppliers = this.suppliers.value;
          const filteredSuppliers = currentSuppliers.filter(supplier => supplier.id !== id);
          this.suppliers.next(filteredSuppliers);
        }
      })
    );
  }
  
  getSupplierDetails(id: string): Observable<ApiResponse<Supplier>> {
    return this.apiService.get(`suppliers/${id}`);
  }
  
  getSupplierBalance(id: string): Observable<ApiResponse<{ balanceUSD: number; balanceGNF: number }>> {
    return this.apiService.get(`suppliers/${id}/balance`);
  }
  
  // Invoice Management
  getInvoices(options?: FilterOptions): Observable<PaginatedResponse<Invoice>> {
    return this.apiService.getPaginated('invoices', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.invoices.next(response.data);
        }
      })
    );
  }
  
  createInvoice(invoiceData: Partial<Invoice>): Observable<ApiResponse<Invoice>> {
    return this.apiService.post('invoices', invoiceData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentInvoices = this.invoices.value;
          this.invoices.next([response.data, ...currentInvoices]);
        }
      })
    );
  }
  
  updateInvoice(id: string, invoiceData: Partial<Invoice>): Observable<ApiResponse<Invoice>> {
    return this.apiService.put(`invoices/${id}`, invoiceData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentInvoices = this.invoices.value;
          const updatedInvoices = currentInvoices.map(invoice => 
            invoice.id === id ? response.data! : invoice
          );
          this.invoices.next(updatedInvoices);
        }
      })
    );
  }
  
  deleteInvoice(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`invoices/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentInvoices = this.invoices.value;
          const filteredInvoices = currentInvoices.filter(invoice => invoice.id !== id);
          this.invoices.next(filteredInvoices);
        }
      })
    );
  }
  
  getInvoicePdf(id: string): Observable<Blob> {
    return this.apiService.downloadFile(`invoices/${id}/pdf`);
  }
  
  // Payment Management
  getPayments(options?: FilterOptions): Observable<PaginatedResponse<Payment>> {
    return this.apiService.getPaginated('payments', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.payments.next(response.data);
        }
      })
    );
  }
  
  createPayment(paymentData: Partial<Payment>): Observable<ApiResponse<Payment>> {
    return this.apiService.post('payments', paymentData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentPayments = this.payments.value;
          this.payments.next([response.data, ...currentPayments]);
        }
      })
    );
  }
  
  updatePayment(id: string, paymentData: Partial<Payment>): Observable<ApiResponse<Payment>> {
    return this.apiService.put(`payments/${id}`, paymentData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentPayments = this.payments.value;
          const updatedPayments = currentPayments.map(payment => 
            payment.id === id ? response.data! : payment
          );
          this.payments.next(updatedPayments);
        }
      })
    );
  }
  
  deletePayment(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`payments/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentPayments = this.payments.value;
          const filteredPayments = currentPayments.filter(payment => payment.id !== id);
          this.payments.next(filteredPayments);
        }
      })
    );
  }
  
  getPaymentReceipt(id: string): Observable<Blob> {
    return this.apiService.downloadFile(`payments/${id}/receipt`);
  }
  
  // Advance Management
  getAdvances(options?: FilterOptions): Observable<PaginatedResponse<Advance>> {
    return this.apiService.getPaginated('advances', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.advances.next(response.data);
        }
      })
    );
  }
  
  createAdvance(advanceData: Partial<Advance>): Observable<ApiResponse<Advance>> {
    return this.apiService.post('advances', advanceData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentAdvances = this.advances.value;
          this.advances.next([response.data, ...currentAdvances]);
        }
      })
    );
  }
  
  updateAdvance(id: string, advanceData: Partial<Advance>): Observable<ApiResponse<Advance>> {
    return this.apiService.put(`advances/${id}`, advanceData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentAdvances = this.advances.value;
          const updatedAdvances = currentAdvances.map(advance => 
            advance.id === id ? response.data! : advance
          );
          this.advances.next(updatedAdvances);
        }
      })
    );
  }
  
  deleteAdvance(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`advances/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentAdvances = this.advances.value;
          const filteredAdvances = currentAdvances.filter(advance => advance.id !== id);
          this.advances.next(filteredAdvances);
        }
      })
    );
  }
  
  // Reminder Management
  getReminders(options?: FilterOptions): Observable<PaginatedResponse<Reminder>> {
    return this.apiService.getPaginated('reminders', { params: options });
  }
  
  createReminder(reminderData: Partial<Reminder>): Observable<ApiResponse<Reminder>> {
    return this.apiService.post('reminders', reminderData);
  }
  
  sendReminder(id: string): Observable<ApiResponse<any>> {
    return this.apiService.post(`reminders/${id}/send`, {});
  }
  
  // Reports
  getClientReport(clientId: string, filters: {
    dateFrom?: Date;
    dateTo?: Date;
    includeInvoices?: boolean;
    includePayments?: boolean;
  }): Observable<Blob> {
    return this.apiService.downloadFile(`clients/${clientId}/report`, filters);
  }
  
  getSupplierReport(supplierId: string, filters: {
    dateFrom?: Date;
    dateTo?: Date;
    includeInvoices?: boolean;
    includePayments?: boolean;
  }): Observable<Blob> {
    return this.apiService.downloadFile(`suppliers/${supplierId}/report`, filters);
  }
  
  getOverdueInvoices(): Observable<ApiResponse<Invoice[]>> {
    return this.apiService.get('invoices/overdue');
  }
  
  // Statistics
  getClientSupplierStatistics(): Observable<ApiResponse<{
    totalClients: number;
    activeClients: number;
    totalSuppliers: number;
    activeSuppliers: number;
    totalInvoices: number;
    paidInvoices: number;
    unpaidInvoices: number;
    totalRevenue: number;
    totalExpenses: number;
    clientBalance: { total: number; currency: string };
    supplierBalance: { total: number; currency: string };
  }>> {
    return this.apiService.get('clients-suppliers/statistics');
  }
}
