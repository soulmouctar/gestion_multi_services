import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiResponse, PaginatedResponse, FilterOptions } from '../models';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly API_URL = environment.apiUrl;
  
  constructor(private http: HttpClient) {}
  
  // Generic HTTP methods
  get<T>(endpoint: string, options?: {
    params?: FilterOptions;
    headers?: HttpHeaders;
  }): Observable<ApiResponse<T>> {
    const httpOptions = this.buildHttpOptions(options);
    return this.http.get<ApiResponse<T>>(`${this.API_URL}/${endpoint}`, httpOptions).pipe(
      catchError(error => this.handleError(error))
    );
  }
  
  getPaginated<T>(endpoint: string, options?: {
    params?: FilterOptions;
    headers?: HttpHeaders;
  }): Observable<PaginatedResponse<T>> {
    const httpOptions = this.buildHttpOptions(options);
    return this.http.get<PaginatedResponse<T>>(`${this.API_URL}/${endpoint}`, httpOptions).pipe(
      catchError(error => this.handleError(error))
    );
  }
  
  post<T>(endpoint: string, data: any, options?: {
    headers?: HttpHeaders;
  }): Observable<ApiResponse<T>> {
    const httpOptions = this.buildHttpOptions(options);
    return this.http.post<ApiResponse<T>>(`${this.API_URL}/${endpoint}`, data, httpOptions).pipe(
      catchError(error => this.handleError(error))
    );
  }
  
  put<T>(endpoint: string, data: any, options?: {
    headers?: HttpHeaders;
  }): Observable<ApiResponse<T>> {
    const httpOptions = this.buildHttpOptions(options);
    return this.http.put<ApiResponse<T>>(`${this.API_URL}/${endpoint}`, data, httpOptions).pipe(
      catchError(error => this.handleError(error))
    );
  }
  
  patch<T>(endpoint: string, data: any, options?: {
    headers?: HttpHeaders;
  }): Observable<ApiResponse<T>> {
    const httpOptions = this.buildHttpOptions(options);
    return this.http.patch<ApiResponse<T>>(`${this.API_URL}/${endpoint}`, data, httpOptions).pipe(
      catchError(error => this.handleError(error))
    );
  }
  
  delete<T>(endpoint: string, options?: {
    headers?: HttpHeaders;
  }): Observable<ApiResponse<T>> {
    const httpOptions = this.buildHttpOptions(options);
    return this.http.delete<ApiResponse<T>>(`${this.API_URL}/${endpoint}`, httpOptions).pipe(
      catchError(error => this.handleError(error))
    );
  }
  
  // File upload
  uploadFile(endpoint: string, file: File, additionalData?: any): Observable<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
      });
    }
    
    return this.http.post<ApiResponse<any>>(`${this.API_URL}/${endpoint}`, formData).pipe(
      catchError(error => this.handleError(error))
    );
  }
  
  // Download file
  downloadFile(endpoint: string, filename?: string): Observable<Blob> {
    return this.http.get(`${this.API_URL}/${endpoint}`, {
      responseType: 'blob'
    }).pipe(
      map(blob => {
        if (filename) {
          this.downloadBlob(blob, filename);
        }
        return blob;
      }),
      catchError(error => this.handleError(error))
    );
  }
  
  // PDF generation
  generatePdf(endpoint: string, data: any): Observable<Blob> {
    return this.http.post(`${this.API_URL}/${endpoint}`, data, {
      responseType: 'blob'
    }).pipe(
      catchError(error => this.handleError(error))
    );
  }
  
  // Specific API methods for different modules
  
  // Tenant Management
  getTenants(options?: FilterOptions): Observable<PaginatedResponse<any>> {
    return this.getPaginated('tenants', { params: options });
  }
  
  createTenant(data: any): Observable<ApiResponse<any>> {
    return this.post('tenants', data);
  }
  
  updateTenant(id: string, data: any): Observable<ApiResponse<any>> {
    return this.put(`tenants/${id}`, data);
  }
  
  deleteTenant(id: string): Observable<ApiResponse<any>> {
    return this.delete(`tenants/${id}`);
  }
  
  // Subscription Management
  getSubscriptionPlans(): Observable<ApiResponse<any[]>> {
    return this.get('subscription-plans');
  }
  
  createSubscription(data: any): Observable<ApiResponse<any>> {
    return this.post('subscriptions', data);
  }
  
  getSubscriptionPayments(subscriptionId: string): Observable<ApiResponse<any[]>> {
    return this.get(`subscriptions/${subscriptionId}/payments`);
  }
  
  // Module Management
  getModules(): Observable<ApiResponse<any[]>> {
    return this.get('modules');
  }
  
  getTenantModules(tenantId: string): Observable<ApiResponse<any[]>> {
    return this.get(`tenants/${tenantId}/modules`);
  }
  
  updateTenantModules(tenantId: string, moduleIds: string[]): Observable<ApiResponse<any>> {
    return this.put(`tenants/${tenantId}/modules`, { moduleIds });
  }
  
  // Financial Accounts
  getAccounts(options?: FilterOptions): Observable<PaginatedResponse<any>> {
    return this.getPaginated('financial-accounts', { params: options });
  }
  
  createAccount(data: any): Observable<ApiResponse<any>> {
    return this.post('financial-accounts', data);
  }
  
  // Transactions
  getTransactions(options?: FilterOptions): Observable<PaginatedResponse<any>> {
    return this.getPaginated('transactions', { params: options });
  }
  
  createTransaction(data: any): Observable<ApiResponse<any>> {
    return this.post('transactions', data);
  }
  
  // Expenses
  getExpenses(options?: FilterOptions): Observable<PaginatedResponse<any>> {
    return this.getPaginated('expenses', { params: options });
  }
  
  createExpense(data: any): Observable<ApiResponse<any>> {
    return this.post('expenses', data);
  }
  
  // Clients & Suppliers
  getClients(options?: FilterOptions): Observable<PaginatedResponse<any>> {
    return this.getPaginated('clients', { params: options });
  }
  
  createClient(data: any): Observable<ApiResponse<any>> {
    return this.post('clients', data);
  }
  
  getSuppliers(options?: FilterOptions): Observable<PaginatedResponse<any>> {
    return this.getPaginated('suppliers', { params: options });
  }
  
  createSupplier(data: any): Observable<ApiResponse<any>> {
    return this.post('suppliers', data);
  }
  
  // Products & Stock
  getProducts(options?: FilterOptions): Observable<PaginatedResponse<any>> {
    return this.getPaginated('products', { params: options });
  }
  
  createProduct(data: any): Observable<ApiResponse<any>> {
    return this.post('products', data);
  }
  
  // Containers
  getContainers(options?: FilterOptions): Observable<PaginatedResponse<any>> {
    return this.getPaginated('containers', { params: options });
  }
  
  createContainer(data: any): Observable<ApiResponse<any>> {
    return this.post('containers', data);
  }
  
  dispatchContainer(data: any): Observable<ApiResponse<any>> {
    return this.post('containers/dispatch', data);
  }
  
  // Rental
  getProperties(options?: FilterOptions): Observable<PaginatedResponse<any>> {
    return this.getPaginated('properties', { params: options });
  }
  
  getRentalTenants(options?: FilterOptions): Observable<PaginatedResponse<any>> {
    return this.getPaginated('rental/tenants', { params: options });
  }
  
  // Taxi
  getTaxis(options?: FilterOptions): Observable<PaginatedResponse<any>> {
    return this.getPaginated('taxis', { params: options });
  }
  
  getDrivers(options?: FilterOptions): Observable<PaginatedResponse<any>> {
    return this.getPaginated('drivers', { params: options });
  }
  
  // Statistics
  getStatistics(type: string, period?: string): Observable<ApiResponse<any>> {
    const params = period ? { period } : {};
    return this.get(`statistics/${type}`, { params });
  }
  
  // Private helper methods
  private buildHttpOptions(options?: {
    params?: FilterOptions;
    headers?: HttpHeaders;
  }): { headers?: HttpHeaders; params?: HttpParams } {
    let httpOptions: any = {};
    
    if (options?.headers) {
      httpOptions.headers = options.headers;
    }
    
    if (options?.params) {
      let httpParams = new HttpParams();
      
      Object.keys(options.params).forEach(key => {
        const value = options.params![key];
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
      
      httpOptions.params = httpParams;
    }
    
    return httpOptions;
  }
  
  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
  
  private handleError(error: any): Observable<never> {
    let errorMessage = 'An error occurred';
    
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    } else if (error.status) {
      errorMessage = `HTTP Error: ${error.status}`;
    }
    
    console.error('API Error:', error);
    return throwError(() => new Error(errorMessage));
  }
}
