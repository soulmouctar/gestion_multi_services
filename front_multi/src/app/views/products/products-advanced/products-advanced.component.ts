import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup } from '@angular/forms';
import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-products-advanced',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './products-advanced.component.html'
})
export class ProductsAdvancedComponent implements OnInit {
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  
  // Low Stock Products
  lowStockProducts: any[] = [];
  loadingLowStock = false;
  
  // Barcode Search
  barcodeSearchForm: FormGroup;
  searchResult: any = null;
  searchLoading = false;
  
  // Statistics
  productStats: any = null;
  statsLoading = false;
  
  // Stock Update
  showStockModal = false;
  stockForm: FormGroup;
  selectedProduct: any = null;
  stockSubmitted = false;

  constructor(private fb: FormBuilder, private apiService: ApiService, private cdr: ChangeDetectorRef) {
    this.barcodeSearchForm = this.fb.group({
      barcode: ['']
    });
    
    this.stockForm = this.fb.group({
      stock_quantity: [0],
      operation: ['set'], // 'set', 'add', 'subtract'
      reason: ['']
    });
  }

  ngOnInit(): void {
    this.loadLowStockProducts();
    this.loadProductStatistics();
  }

  // Low Stock Products
  loadLowStockProducts(): void {
    this.loadingLowStock = true;
    this.apiService.get<any>('products/low-stock').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.lowStockProducts = r.data;
        }
        this.loadingLowStock = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingLowStock = false;
        this.error = 'Erreur lors du chargement des produits en rupture';
        this.cdr.detectChanges();
      }
    });
  }

  // Barcode Search
  searchByBarcode(): void {
    const barcode = this.barcodeSearchForm.get('barcode')?.value?.trim();
    if (!barcode) return;

    this.searchLoading = true;
    this.searchResult = null;
    this.apiService.get<any>(`products/search/barcode?barcode=${encodeURIComponent(barcode)}`).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.searchResult = r.data;
        } else {
          this.error = 'Aucun produit trouvé avec ce code-barres';
        }
        this.searchLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.searchLoading = false;
        this.error = 'Erreur lors de la recherche';
        this.cdr.detectChanges();
      }
    });
  }

  clearSearch(): void {
    this.barcodeSearchForm.reset();
    this.searchResult = null;
  }

  // Product Statistics
  loadProductStatistics(): void {
    this.statsLoading = true;
    this.apiService.get<any>('products/statistics').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.productStats = r.data;
        }
        this.statsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.statsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Stock Management
  openStockModal(product: any): void {
    this.selectedProduct = product;
    this.stockForm.patchValue({
      stock_quantity: product.stock_quantity || 0,
      operation: 'set',
      reason: ''
    });
    this.stockSubmitted = false;
    this.showStockModal = true;
  }

  updateStock(): void {
    this.stockSubmitted = true;
    if (this.stockForm.invalid || !this.selectedProduct) return;

    const data = {
      ...this.stockForm.value,
      product_id: this.selectedProduct.id
    };

    this.apiService.post<any>(`products/${this.selectedProduct.id}/update-stock`, data).subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = 'Stock mis à jour avec succès';
          this.showStockModal = false;
          this.loadLowStockProducts();
          this.loadProductStatistics();
          this.clearMessages();
        }
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur lors de la mise à jour du stock';
      }
    });
  }

  getStockStatus(product: any): string {
    if (!product.stock_quantity || product.stock_quantity === 0) return 'Rupture';
    if (product.stock_quantity <= product.low_stock_threshold) return 'Stock faible';
    return 'En stock';
  }

  getStockStatusColor(product: any): string {
    if (!product.stock_quantity || product.stock_quantity === 0) return 'danger';
    if (product.stock_quantity <= product.low_stock_threshold) return 'warning';
    return 'success';
  }

  refreshData(): void {
    this.loadLowStockProducts();
    this.loadProductStatistics();
  }

  private clearMessages(): void {
    setTimeout(() => {
      this.successMessage = null;
      this.error = null;
      this.cdr.detectChanges();
    }, 3000);
  }
}
