import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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

    // Remove empty values
    Object.keys(filters).forEach(key => {
      const value = (filters as any)[key];
      if (value === '' || value === null || value === undefined) {
        delete (filters as any)[key];
      }
    });

    // Use public API route for testing
    const queryParams = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      const value = (filters as any)[key];
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });
    
    const url = `products-public?${queryParams.toString()}`;
    console.log('Loading products from URL:', url);
    console.log('Filters applied:', filters);
    
    this.apiService.get<any>(url).subscribe({
      next: (response) => {
        console.log('Products API response:', response);
        if (response && response.success) {
          this.products = response.data?.data || [];
          this.totalItems = response.data?.total || 0;
          this.totalPages = response.data?.last_page || 1;
          this.currentPage = response.data?.current_page || 1;
          this.error = null;
        } else {
          this.products = [];
          this.error = 'Aucun produit trouvé';
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading products:', error);
        console.error('Error details:', {
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          message: error.message
        });
        
        this.error = `Erreur ${error.status || 'inconnue'}: ${error.message || 'Erreur lors du chargement des produits'}`;
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
      error: (error) => {
        console.error('Error loading categories:', error);
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
      error: (error) => {
        console.error('Error loading units:', error);
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
    this.productService.deleteProduct(this.productToDelete.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.productService.showSuccessMessage('Produit supprimé avec succès');
          this.loadProducts();
        }
        this.cancelDelete();
      },
      error: (error) => {
        console.error('Error deleting product:', error);
        this.productService.showErrorMessage(error.message || 'Erreur lors de la suppression');
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
      status: status,
      tenant_id: 1
    };

    this.apiService.post<any>('products-public/bulk-update-status', data).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadProducts();
          this.selectedProducts = [];
          this.selectAll = false;
        }
      },
      error: (error) => {
        console.error('Error updating status:', error);
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
  trackByProductId(index: number, product: Product): number {
    return product.id;
  }

  getPages(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }
}
