import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

import {
  ButtonModule,
  ButtonGroupModule,
  CardModule,
  FormModule,
  TableModule,
  BadgeModule,
  ModalModule,
  AlertModule,
  SpinnerModule,
  DropdownModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

import { ProductService, Product, ProductCategory, Unit, ProductFilters } from '../../../core/services/product.service';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    IconDirective,
    ButtonModule,
    ButtonGroupModule,
    CardModule,
    FormModule,
    TableModule,
    BadgeModule,
    ModalModule,
    AlertModule,
    SpinnerModule,
    DropdownModule
  ],
  templateUrl: './products-list.component.html',
  styleUrls: ['./products-list.component.scss']
})
export class ProductsListComponent implements OnInit {
  products: Product[] = [];
  categories: ProductCategory[] = [];
  units: Unit[] = [];
  
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  
  // Statistics
  stats = {
    total_products: 0,
    active_products: 0,
    low_stock_products: 0,
    out_of_stock_products: 0,
    total_stock_value: 0
  };
  loadingStats = false;
  
  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  itemsPerPage = 15;
  
  // Filters
  filterForm: FormGroup;
  
  // Selection
  selectedProducts: number[] = [];
  selectAll = false;
  
  // Modals
  deleteModalOpen = false;
  productToDelete: Product | null = null;
  bulkDeleteModalOpen = false;
  
  // Detail Modal
  detailModalOpen = false;
  selectedProduct: Product | null = null;
  
  // Sales History Modal
  salesHistoryModalOpen = false;
  salesHistory: any[] = [];
  loadingSalesHistory = false;
  
  // Dropdown state
  openDropdownId: number | null = null;

  // Math object for template
  Math = Math;
  
  constructor(
    private productService: ProductService,
    private authService: AuthService,
    private apiService: ApiService,
    private fb: FormBuilder,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.filterForm = this.fb.group({
      search: [''],
      category_id: [''],
      status: [''],
      low_stock: [false],
      sort_by: ['created_at'],
      sort_order: ['desc']
    });
  }

  ngOnInit(): void {
    // Load data in parallel but don't block UI
    this.loadInitialData();
    
    // Watch for filter changes with debounce
    this.filterForm.valueChanges.pipe(
      debounceTime(500) // Increased debounce to reduce API calls
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadProducts();
    });
  }

  private loadInitialData(): void {
    // Load products first (main content)
    this.loadProducts();
    
    // Load categories and units in background without blocking
    this.loadCategories();
    this.loadUnits();
    this.loadStatistics();
  }

  loadStatistics(): void {
    this.loadingStats = true;
    this.apiService.get<any>('products/statistics').subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.stats = response.data;
        }
        this.loadingStats = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingStats = false;
        this.cdr.detectChanges();
      }
    });
  }

  private async loadCategoriesAsync(): Promise<void> {
    try {
      const response = await firstValueFrom(this.productService.getCategories());
      if (response.success) {
        this.categories = response.data || [];
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  private async loadUnitsAsync(): Promise<void> {
    try {
      const response = await firstValueFrom(this.productService.getUnits());
      if (response.success) {
        this.units = response.data || [];
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Error loading units:', error);
    }
  }

  loadProducts(): void {
    this.loading = true;
    this.error = null;
    this.cdr.detectChanges();

    const filters: ProductFilters = {
      ...this.filterForm.value,
      page: this.currentPage,
      per_page: this.itemsPerPage
    };

    // Remove empty/false values
    Object.keys(filters).forEach(key => {
      const value = (filters as any)[key];
      if (value === '' || value === null || value === undefined || value === false) {
        delete (filters as any)[key];
      }
    });

    this.productService.getProducts(filters).subscribe({
      next: (response) => {
        console.log('Products API response:', response);
        if (response && response.success) {
          // Handle paginated response format
          const responseData = response.data;
          if (responseData && Array.isArray(responseData.data)) {
            // Standard paginated format: { data: [...], total: X, current_page: Y }
            this.products = responseData.data;
            this.totalItems = responseData.total || 0;
            this.totalPages = responseData.last_page || 1;
            this.currentPage = responseData.current_page || 1;
          } else if (Array.isArray(responseData)) {
            // Non-paginated format: [...]
            this.products = responseData;
            this.totalItems = responseData.length;
            this.totalPages = 1;
            this.currentPage = 1;
          } else {
            this.products = [];
            this.totalItems = 0;
            this.totalPages = 1;
          }
          this.error = null;
        } else {
          this.products = [];
          this.error = response?.message || 'Aucun produit trouvé';
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.error = error?.message || 'Erreur lors du chargement des produits';
        this.products = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadCategories(): void {
    this.productService.getCategories().subscribe({
      next: (response: any) => {
        if (response.success) {
          // Handle paginated response - extract data array
          this.categories = Array.isArray(response.data) 
            ? response.data 
            : (response.data?.data || []);
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.categories = [];
        this.cdr.detectChanges();
      }
    });
  }

  loadUnits(): void {
    this.productService.getUnits().subscribe({
      next: (response: any) => {
        if (response.success) {
          // Handle paginated response - extract data array
          this.units = Array.isArray(response.data) 
            ? response.data 
            : (response.data?.data || []);
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.units = [];
        this.cdr.detectChanges();
      }
    });
  }

  // Navigation
  createProduct(): void {
    this.router.navigate(['/products/create']);
  }

  viewProduct(product: Product): void {
    this.router.navigate(['/products/view', product.id]);
  }

  editProduct(product: Product): void {
    this.router.navigate(['/products/edit', product.id]);
  }

  // Delete operations
  deleteProduct(product: Product): void {
    this.productToDelete = product;
    this.deleteModalOpen = true;
  }

  confirmDelete(): void {
    if (!this.productToDelete) return;

    this.loading = true;
    this.apiService.delete<any>(`products/${this.productToDelete.id}`).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = 'Produit supprimé avec succès';
          this.loadProducts();
          this.loadStatistics();
          this.clearMessagesAfterDelay();
        }
        this.cancelDelete();
      },
      error: (error) => {
        console.error('Error deleting product:', error);
        this.error = error?.error?.message || 'Erreur lors de la suppression';
        this.loading = false;
        this.cancelDelete();
      }
    });
  }

  cancelDelete(): void {
    this.deleteModalOpen = false;
    this.productToDelete = null;
  }

  // Bulk operations
  toggleSelectAll(): void {
    if (this.selectAll) {
      this.selectedProducts = this.products.map(p => p.id);
    } else {
      this.selectedProducts = [];
    }
  }

  toggleProductSelection(productId: number): void {
    const index = this.selectedProducts.indexOf(productId);
    if (index > -1) {
      this.selectedProducts.splice(index, 1);
    } else {
      this.selectedProducts.push(productId);
    }
    
    this.selectAll = this.selectedProducts.length === this.products.length;
  }

  isProductSelected(productId: number): boolean {
    return this.selectedProducts.includes(productId);
  }

  bulkDelete(): void {
    if (this.selectedProducts.length === 0) return;
    this.bulkDeleteModalOpen = true;
  }

  confirmBulkDelete(): void {
    if (this.selectedProducts.length === 0) return;

    this.loading = true;
    this.productService.bulkDelete(this.selectedProducts).subscribe({
      next: (response) => {
        if (response.success) {
          this.productService.showSuccessMessage(`${this.selectedProducts.length} produits supprimés avec succès`);
          this.selectedProducts = [];
          this.selectAll = false;
          this.loadProducts();
        }
        this.cancelBulkDelete();
      },
      error: (error) => {
        console.error('Error bulk deleting products:', error);
        this.productService.showErrorMessage(error.message || 'Erreur lors de la suppression');
        this.loading = false;
        this.cancelBulkDelete();
      }
    });
  }

  cancelBulkDelete(): void {
    this.bulkDeleteModalOpen = false;
  }

  bulkUpdateSelectedStatus(status: string): void {
    if (this.selectedProducts.length === 0) return;

    const data = {
      product_ids: this.selectedProducts,
      status: status
    };

    this.loading = true;
    this.apiService.post<any>('products/bulk-update-status', data).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = `${this.selectedProducts.length} produit(s) mis à jour avec succès`;
          this.loadProducts();
          this.loadStatistics();
          this.selectedProducts = [];
          this.selectAll = false;
          this.clearMessagesAfterDelay();
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error updating status:', error);
        this.error = error?.error?.message || 'Erreur lors de la mise à jour';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Pagination
  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadProducts();
  }

  // Filters
  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      category_id: '',
      status: '',
      low_stock: false,
      sort_by: 'created_at',
      sort_order: 'desc'
    });
  }

  // Utility methods
  getStatusLabel(status: Product['status']): string {
    return this.productService.getStatusLabel(status);
  }

  getStatusClass(status: Product['status']): string {
    return this.productService.getStatusClass(status);
  }

  isLowStock(product: Product): boolean {
    return this.productService.isLowStock(product);
  }

  isOutOfStock(product: Product): boolean {
    return this.productService.isOutOfStock(product);
  }

  formatPrice(price: number | undefined): string {
    return this.productService.formatPrice(price);
  }

  getCategoryName(categoryId: number | undefined): string {
    if (!categoryId) return '-';
    const category = this.categories.find(c => c.id === categoryId);
    return category?.name || '-';
  }

  getUnitName(unitId: number | undefined): string {
    if (!unitId) return '-';
    const unit = this.units.find(u => u.id === unitId);
    return unit?.name || '-';
  }

  // Export
  exportProducts(format: 'csv' | 'excel' | 'pdf' = 'csv'): void {
    this.loading = true;
    
    const filters: ProductFilters = {
      ...this.filterForm.value
    };

    this.productService.exportProducts(format, filters).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `products.${format}`;
        link.click();
        window.URL.revokeObjectURL(url);
        
        this.productService.showSuccessMessage('Export réalisé avec succès');
        this.loading = false;
      },
      error: (error) => {
        console.error('Error exporting products:', error);
        this.productService.showErrorMessage(error.message || 'Erreur lors de l\'export');
        this.loading = false;
      }
    });
  }

  // Stock management
  manageStock(product: Product): void {
    this.router.navigate(['/products/stock', product.id]);
  }

  // Quick actions
  toggleProductStatus(product: Product): void {
    const newStatus = product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    
    this.productService.updateProduct(product.id, { status: newStatus }).subscribe({
      next: (response) => {
        if (response.success) {
          this.productService.showSuccessMessage('Statut mis à jour avec succès');
          this.loadProducts();
        }
      },
      error: (error) => {
        console.error('Error updating status:', error);
        this.productService.showErrorMessage(error.message || 'Erreur lors de la mise à jour');
      }
    });
  }

  // TrackBy function for performance
  trackByProductId(_index: number, product: Product): number {
    return product.id;
  }

  getPages(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }

  private clearMessagesAfterDelay(): void {
    setTimeout(() => {
      this.successMessage = null;
      this.error = null;
      this.cdr.detectChanges();
    }, 3000);
  }

  getStockPercentage(product: Product): number {
    if (!product.low_stock_threshold || product.low_stock_threshold === 0) return 100;
    const percentage = ((product.stock_quantity || 0) / (product.low_stock_threshold * 2)) * 100;
    return Math.min(100, Math.max(0, percentage));
  }

  getStockProgressClass(product: Product): string {
    if (this.isOutOfStock(product)) return 'bg-danger';
    if (this.isLowStock(product)) return 'bg-warning';
    return 'bg-success';
  }

  duplicateProduct(product: Product): void {
    const duplicateData = {
      name: `${product.name} (copie)`,
      description: product.description,
      sku: product.sku ? `${product.sku}-COPY` : null,
      product_category_id: product.product_category_id,
      unit_id: product.unit_id,
      purchase_price: product.purchase_price,
      selling_price: product.selling_price,
      stock_quantity: 0,
      low_stock_threshold: product.low_stock_threshold,
      status: 'INACTIVE'
    };

    this.apiService.post<any>('products', duplicateData).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = 'Produit dupliqué avec succès';
          this.loadProducts();
          this.loadStatistics();
          this.clearMessagesAfterDelay();
        }
      },
      error: (error) => {
        this.error = error?.error?.message || 'Erreur lors de la duplication';
      }
    });
  }

  quickUpdateStock(product: Product, operation: 'ADD' | 'SUBTRACT'): void {
    const quantity = prompt(`Quantité à ${operation === 'ADD' ? 'ajouter' : 'retirer'}:`);
    if (!quantity || isNaN(Number(quantity))) return;

    this.apiService.post<any>(`products/${product.id}/update-stock`, {
      stock_quantity: Number(quantity),
      operation: operation
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = 'Stock mis à jour';
          this.loadProducts();
          this.loadStatistics();
          this.clearMessagesAfterDelay();
        }
      },
      error: (error) => {
        this.error = error?.error?.message || 'Erreur lors de la mise à jour du stock';
      }
    });
  }

  // Dropdown toggle
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown')) {
      this.openDropdownId = null;
    }
  }

  toggleDropdown(productId: number): void {
    this.openDropdownId = this.openDropdownId === productId ? null : productId;
  }

  isDropdownOpen(productId: number): boolean {
    return this.openDropdownId === productId;
  }

  closeDropdown(): void {
    this.openDropdownId = null;
  }

  // Detail Modal
  openDetailModal(product: Product): void {
    this.selectedProduct = product;
    this.detailModalOpen = true;
    this.closeDropdown();
  }

  closeDetailModal(): void {
    this.detailModalOpen = false;
    this.selectedProduct = null;
  }

  // Sales History Modal
  openSalesHistoryModal(product: Product): void {
    this.selectedProduct = product;
    this.salesHistoryModalOpen = true;
    this.loadSalesHistory(product.id);
    this.closeDropdown();
  }

  closeSalesHistoryModal(): void {
    this.salesHistoryModalOpen = false;
    this.salesHistory = [];
  }

  loadSalesHistory(productId: number): void {
    this.loadingSalesHistory = true;
    this.apiService.get<any>(`products/${productId}/sales-history`).subscribe({
      next: (response) => {
        if (response.success) {
          this.salesHistory = response.data || [];
        }
        this.loadingSalesHistory = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.salesHistory = [];
        this.loadingSalesHistory = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Calculate profit margin
  getProfitMargin(product: Product): number {
    if (!product.purchase_price || !product.selling_price || product.purchase_price === 0) return 0;
    return ((product.selling_price - product.purchase_price) / product.purchase_price) * 100;
  }

  // Get stock status text
  getStockStatusText(product: Product): string {
    if (this.isOutOfStock(product)) return 'Rupture de stock';
    if (this.isLowStock(product)) return 'Stock faible';
    return 'En stock';
  }

  // Calculate total quantity sold
  getTotalQuantitySold(): number {
    return this.salesHistory.reduce((sum, s) => sum + (s.quantity || 0), 0);
  }

  // Calculate total sales amount
  getTotalSalesAmount(): number {
    return this.salesHistory.reduce((sum, s) => sum + (s.total || 0), 0);
  }
}
