import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timeout, retry, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PaginatedResponse } from '../models';

export interface Product {
  id: number;
  tenant_id: number;
  name: string;
  description?: string;
  sku?: string;
  product_category_id?: number;
  unit_id?: number;
  purchase_price?: number;
  selling_price?: number;
  stock_quantity?: number;
  low_stock_threshold?: number;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  barcode?: string;
  weight?: number;
  dimensions?: string;
  supplier_info?: string;
  notes?: string;
  category?: ProductCategory;
  unit?: Unit;
  created_at?: string;
  updated_at?: string;
}

export interface ProductCategory {
  id: number;
  name: string;
  description?: string;
  tenant_id: number;
}

export interface Unit {
  id: number;
  name: string;
  symbol: string;
  tenant_id: number;
}

export interface ProductFilters {
  search?: string;
  category_id?: number;
  status?: string;
  low_stock?: boolean;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface StockUpdateRequest {
  stock_quantity: number;
  operation: 'SET' | 'ADD' | 'SUBTRACT';
  reason?: string;
}

export interface ProductStatistics {
  total_products: number;
  active_products: number;
  inactive_products: number;
  discontinued_products: number;
  low_stock_products: number;
  out_of_stock_products: number;
  total_stock_value: number;
  categories_count: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Get paginated list of products with filters
   */
  getProducts(filters: ProductFilters = {}): Observable<ApiResponse<PaginatedResponse<Product>>> {
    let params = new HttpParams();
    
    Object.keys(filters).forEach(key => {
      const value = (filters as any)[key];
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value.toString());
      }
    });

    return this.http.get<ApiResponse<PaginatedResponse<Product>>>(`${this.API_URL}/products`, { params })
      .pipe(
        timeout(10000),
        retry(2),
        catchError(this.handleError)
      );
  }

  /**
   * Get single product by ID
   */
  getProduct(id: number): Observable<ApiResponse<Product>> {
    return this.http.get<ApiResponse<Product>>(`${this.API_URL}/products/${id}`)
      .pipe(
        timeout(10000),
        retry(2),
        catchError(this.handleError)
      );
  }

  /**
   * Create new product
   */
  createProduct(product: Partial<Product>): Observable<ApiResponse<Product>> {
    return this.http.post<ApiResponse<Product>>(`${this.API_URL}/products`, product)
      .pipe(
        timeout(10000),
        retry(1),
        catchError(this.handleError)
      );
  }

  /**
   * Update existing product
   */
  updateProduct(id: number, product: Partial<Product>): Observable<ApiResponse<Product>> {
    return this.http.put<ApiResponse<Product>>(`${this.API_URL}/products/${id}`, product)
      .pipe(
        timeout(10000),
        retry(1),
        catchError(this.handleError)
      );
  }

  /**
   * Delete product
   */
  deleteProduct(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API_URL}/products/${id}`)
      .pipe(
        timeout(10000),
        retry(1),
        catchError(this.handleError)
      );
  }

  /**
   * Update product stock
   */
  updateStock(id: number, stockUpdate: StockUpdateRequest): Observable<ApiResponse<Product>> {
    return this.http.post<ApiResponse<Product>>(`${this.API_URL}/products/${id}/update-stock`, stockUpdate)
      .pipe(
        timeout(10000),
        retry(1),
        catchError(this.handleError)
      );
  }

  /**
   * Get products with low stock
   */
  getLowStockProducts(): Observable<ApiResponse<Product[]>> {
    return this.http.get<ApiResponse<Product[]>>(`${this.API_URL}/products/low-stock`)
      .pipe(
        timeout(10000),
        retry(2),
        catchError(this.handleError)
      );
  }

  /**
   * Search product by barcode
   */
  searchByBarcode(barcode: string): Observable<ApiResponse<Product>> {
    const params = new HttpParams().set('barcode', barcode);
    
    return this.http.get<ApiResponse<Product>>(`${this.API_URL}/products/search/barcode`, { params })
      .pipe(
        timeout(10000),
        retry(2),
        catchError(this.handleError)
      );
  }

  /**
   * Get product statistics
   */
  getStatistics(): Observable<ApiResponse<ProductStatistics>> {
    return this.http.get<ApiResponse<ProductStatistics>>(`${this.API_URL}/products/statistics`)
      .pipe(
        timeout(10000),
        retry(2),
        catchError(this.handleError)
      );
  }

  /**
   * Get product categories
   */
  getCategories(): Observable<ApiResponse<ProductCategory[]>> {
    return this.http.get<ApiResponse<ProductCategory[]>>(`${this.API_URL}/product-categories`)
      .pipe(
        timeout(10000),
        retry(2),
        catchError(this.handleError)
      );
  }

  /**
   * Get units
   */
  getUnits(): Observable<ApiResponse<Unit[]>> {
    return this.http.get<ApiResponse<Unit[]>>(`${this.API_URL}/units-public`)
      .pipe(
        timeout(10000),
        retry(2),
        catchError(this.handleError)
      );
  }

  /**
   * Bulk operations
   */
  bulkUpdateStatus(productIds: number[], status: Product['status']): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.API_URL}/products/bulk-update-status`, {
      product_ids: productIds,
      status
    }).pipe(
      timeout(15000),
      retry(1),
      catchError(this.handleError)
    );
  }

  bulkDelete(productIds: number[]): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.API_URL}/products/bulk-delete`, {
      product_ids: productIds
    }).pipe(
      timeout(15000),
      retry(1),
      catchError(this.handleError)
    );
  }

  /**
   * Export products
   */
  exportProducts(format: 'csv' | 'excel' | 'pdf' = 'csv', filters: ProductFilters = {}): Observable<Blob> {
    let params = new HttpParams().set('format', format);
    
    Object.keys(filters).forEach(key => {
      const value = (filters as any)[key];
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value.toString());
      }
    });

    return this.http.get(`${this.API_URL}/products/export`, { 
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
  getStatusLabel(status: Product['status']): string {
    const labels = {
      'ACTIVE': 'Actif',
      'INACTIVE': 'Inactif',
      'DISCONTINUED': 'Discontinué'
    };
    return labels[status] || status;
  }

  getStatusClass(status: Product['status']): string {
    const classes = {
      'ACTIVE': 'badge-success',
      'INACTIVE': 'badge-warning',
      'DISCONTINUED': 'badge-danger'
    };
    return classes[status] || 'badge-secondary';
  }

  isLowStock(product: Product): boolean {
    return (product.stock_quantity || 0) <= (product.low_stock_threshold || 0);
  }

  isOutOfStock(product: Product): boolean {
    return (product.stock_quantity || 0) === 0;
  }

  calculateMargin(product: Product): number {
    if (!product.purchase_price || !product.selling_price) {
      return 0;
    }
    return ((product.selling_price - product.purchase_price) / product.selling_price) * 100;
  }

  formatPrice(price: number | undefined, currency: string = 'GNF'): string {
    if (!price) return '-';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency
    }).format(price);
  }

  /**
   * Error handling
   */
  private handleError = (error: any): Observable<never> => {
    console.error('ProductService Error:', error);
    
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
      errorMessage = 'Produit non trouvé';
    } else if (error.status === 422) {
      errorMessage = 'Données invalides';
    }
    
    return throwError(() => new Error(errorMessage));
  };

  /**
   * Show success/error messages using SweetAlert2
   */
  showSuccessMessage(message: string): void {
    // Implementation will depend on your notification system
    console.log('Success:', message);
  }

  showErrorMessage(message: string): void {
    // Implementation will depend on your notification system
    console.error('Error:', message);
  }
}
