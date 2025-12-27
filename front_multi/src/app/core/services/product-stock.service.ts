import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { 
  ProductCategory, 
  Unit, 
  Product, 
  StockItem, 
  StockMovement,
  UnitConversion,
  ProductConversionRule,
  ApiResponse, 
  PaginatedResponse, 
  FilterOptions 
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class ProductStockService {
  private categories = new BehaviorSubject<ProductCategory[]>([]);
  private units = new BehaviorSubject<Unit[]>([]);
  private products = new BehaviorSubject<Product[]>([]);
  private stockItems = new BehaviorSubject<StockItem[]>([]);
  private stockMovements = new BehaviorSubject<StockMovement[]>([]);
  private conversionRules = new BehaviorSubject<ProductConversionRule[]>([]);
  
  categories$ = this.categories.asObservable();
  units$ = this.units.asObservable();
  products$ = this.products.asObservable();
  stockItems$ = this.stockItems.asObservable();
  stockMovements$ = this.stockMovements.asObservable();
  conversionRules$ = this.conversionRules.asObservable();
  
  constructor(private apiService: ApiService) {}
  
  // Product Categories Management
  getCategories(options?: FilterOptions): Observable<PaginatedResponse<ProductCategory>> {
    return this.apiService.getPaginated('product-categories', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.categories.next(response.data);
        }
      })
    );
  }
  
  createCategory(categoryData: Partial<ProductCategory>): Observable<ApiResponse<ProductCategory>> {
    return this.apiService.post('product-categories', categoryData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentCategories = this.categories.value;
          this.categories.next([...currentCategories, response.data]);
        }
      })
    );
  }
  
  updateCategory(id: string, categoryData: Partial<ProductCategory>): Observable<ApiResponse<ProductCategory>> {
    return this.apiService.put(`product-categories/${id}`, categoryData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentCategories = this.categories.value;
          const updatedCategories = currentCategories.map(category => 
            category.id === id ? response.data! : category
          );
          this.categories.next(updatedCategories);
        }
      })
    );
  }
  
  deleteCategory(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`product-categories/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentCategories = this.categories.value;
          const filteredCategories = currentCategories.filter(category => category.id !== id);
          this.categories.next(filteredCategories);
        }
      })
    );
  }
  
  // Units Management
  getUnits(options?: FilterOptions): Observable<PaginatedResponse<Unit>> {
    return this.apiService.getPaginated('units', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.units.next(response.data);
        }
      })
    );
  }
  
  createUnit(unitData: Partial<Unit>): Observable<ApiResponse<Unit>> {
    return this.apiService.post('units', unitData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentUnits = this.units.value;
          this.units.next([...currentUnits, response.data]);
        }
      })
    );
  }
  
  updateUnit(id: string, unitData: Partial<Unit>): Observable<ApiResponse<Unit>> {
    return this.apiService.put(`units/${id}`, unitData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentUnits = this.units.value;
          const updatedUnits = currentUnits.map(unit => 
            unit.id === id ? response.data! : unit
          );
          this.units.next(updatedUnits);
        }
      })
    );
  }
  
  deleteUnit(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`units/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentUnits = this.units.value;
          const filteredUnits = currentUnits.filter(unit => unit.id !== id);
          this.units.next(filteredUnits);
        }
      })
    );
  }
  
  // Products Management
  getProducts(options?: FilterOptions): Observable<PaginatedResponse<Product>> {
    return this.apiService.getPaginated('products', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.products.next(response.data);
        }
      })
    );
  }
  
  createProduct(productData: Partial<Product>): Observable<ApiResponse<Product>> {
    return this.apiService.post('products', productData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentProducts = this.products.value;
          this.products.next([...currentProducts, response.data]);
        }
      })
    );
  }
  
  updateProduct(id: string, productData: Partial<Product>): Observable<ApiResponse<Product>> {
    return this.apiService.put(`products/${id}`, productData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentProducts = this.products.value;
          const updatedProducts = currentProducts.map(product => 
            product.id === id ? response.data! : product
          );
          this.products.next(updatedProducts);
        }
      })
    );
  }
  
  deleteProduct(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`products/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentProducts = this.products.value;
          const filteredProducts = currentProducts.filter(product => product.id !== id);
          this.products.next(filteredProducts);
        }
      })
    );
  }
  
  getProductDetails(id: string): Observable<ApiResponse<Product>> {
    return this.apiService.get(`products/${id}`);
  }
  
  uploadProductPhoto(productId: string, file: File): Observable<ApiResponse<string>> {
    const formData = new FormData();
    formData.append('photo', file);
    return this.apiService.post(`products/${productId}/photos`, formData);
  }
  
  deleteProductPhoto(productId: string, photoId: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`products/${productId}/photos/${photoId}`);
  }
  
  // Stock Management
  getStockItems(options?: FilterOptions): Observable<PaginatedResponse<StockItem>> {
    return this.apiService.getPaginated('stock-items', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.stockItems.next(response.data);
        }
      })
    );
  }
  
  updateStockItem(id: string, stockData: Partial<StockItem>): Observable<ApiResponse<StockItem>> {
    return this.apiService.put(`stock-items/${id}`, stockData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentStockItems = this.stockItems.value;
          const updatedStockItems = currentStockItems.map(item => 
            item.id === id ? response.data! : item
          );
          this.stockItems.next(updatedStockItems);
        }
      })
    );
  }
  
  // Stock Movements
  getStockMovements(options?: FilterOptions): Observable<PaginatedResponse<StockMovement>> {
    return this.apiService.getPaginated('stock-movements', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.stockMovements.next(response.data);
        }
      })
    );
  }
  
  createStockMovement(movementData: Partial<StockMovement>): Observable<ApiResponse<StockMovement>> {
    return this.apiService.post('stock-movements', movementData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentMovements = this.stockMovements.value;
          this.stockMovements.next([response.data, ...currentMovements]);
        }
      })
    );
  }
  
  // Stock Operations
  stockIn(productId: string, quantity: number, unitId: string, details: {
    reference?: string;
    notes?: string;
    cost?: number;
  }): Observable<ApiResponse<any>> {
    return this.apiService.post(`stock/stock-in`, {
      productId,
      quantity,
      unitId,
      ...details
    });
  }
  
  stockOut(productId: string, quantity: number, unitId: string, details: {
    reference?: string;
    notes?: string;
    reason?: string;
  }): Observable<ApiResponse<any>> {
    return this.apiService.post(`stock/stock-out`, {
      productId,
      quantity,
      unitId,
      ...details
    });
  }
  
  stockTransfer(productId: string, quantity: number, fromUnitId: string, toUnitId: string, details: {
    reference?: string;
    notes?: string;
  }): Observable<ApiResponse<any>> {
    return this.apiService.post(`stock/transfer`, {
      productId,
      quantity,
      fromUnitId,
      toUnitId,
      ...details
    });
  }
  
  // Unit Conversions
  getUnitConversions(options?: FilterOptions): Observable<PaginatedResponse<UnitConversion>> {
    return this.apiService.getPaginated('unit-conversions', { params: options });
  }
  
  createUnitConversion(conversionData: Partial<UnitConversion>): Observable<ApiResponse<UnitConversion>> {
    return this.apiService.post('unit-conversions', conversionData);
  }
  
  // Product Conversion Rules
  getConversionRules(options?: FilterOptions): Observable<PaginatedResponse<ProductConversionRule>> {
    return this.apiService.getPaginated('product-conversion-rules', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.conversionRules.next(response.data);
        }
      })
    );
  }
  
  createConversionRule(ruleData: Partial<ProductConversionRule>): Observable<ApiResponse<ProductConversionRule>> {
    return this.apiService.post('product-conversion-rules', ruleData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentRules = this.conversionRules.value;
          this.conversionRules.next([...currentRules, response.data]);
        }
      })
    );
  }
  
  updateConversionRule(id: string, ruleData: Partial<ProductConversionRule>): Observable<ApiResponse<ProductConversionRule>> {
    return this.apiService.put(`product-conversion-rules/${id}`, ruleData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentRules = this.conversionRules.value;
          const updatedRules = currentRules.map(rule => 
            rule.id === id ? response.data! : rule
          );
          this.conversionRules.next(updatedRules);
        }
      })
    );
  }
  
  deleteConversionRule(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`product-conversion-rules/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentRules = this.conversionRules.value;
          const filteredRules = currentRules.filter(rule => rule.id !== id);
          this.conversionRules.next(filteredRules);
        }
      })
    );
  }
  
  // Stock Reports
  getStockReport(filters: {
    productId?: string;
    categoryId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    includeZeroStock?: boolean;
  }): Observable<Blob> {
    return this.apiService.downloadFile('stock/report', filters);
  }
  
  getStockMovementsReport(filters: {
    productId?: string;
    movementType?: 'IN' | 'OUT' | 'TRANSFER';
    dateFrom?: Date;
    dateTo?: Date;
  }): Observable<Blob> {
    return this.apiService.downloadFile('stock/movements/report', filters);
  }
  
  // Stock Alerts
  getLowStockProducts(threshold?: number): Observable<ApiResponse<Array<{
    product: Product;
    currentStock: number;
    minStock: number;
    unit: Unit;
  }>>> {
    return this.apiService.get('stock/low-stock', { params: { threshold } });
  }
  
  getExpiringProducts(days?: number): Observable<ApiResponse<Array<{
    product: Product;
    stockItem: StockItem;
    daysUntilExpiry: number;
  }>>> {
    return this.apiService.get('stock/expiring', { params: { days } });
  }
  
  // Statistics
  getProductStockStatistics(): Observable<ApiResponse<{
    totalProducts: number;
    activeProducts: number;
    totalCategories: number;
    totalStockValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    expiringSoonCount: number;
    monthlyMovements: Array<{ month: string; inCount: number; outCount: number }>;
    topProducts: Array<{ product: Product; movementCount: number; totalValue: number }>;
  }>> {
    return this.apiService.get('products-stock/statistics');
  }
  
  // Search and Filter
  searchProducts(query: string, filters?: {
    categoryId?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
  }): Observable<ApiResponse<Product[]>> {
    return this.apiService.get('products/search', { 
      params: { query, ...filters } 
    });
  }
  
  getProductStock(productId: string): Observable<ApiResponse<Array<{
    unit: Unit;
    quantity: number;
    value: number;
    location?: string;
  }>>> {
    return this.apiService.get(`products/${productId}/stock`);
  }
}
