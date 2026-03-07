import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ButtonModule,
  CardModule,
  BadgeModule,
  SpinnerModule,
  AlertModule,
  RowComponent,
  ColComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ProductService, Product } from '../../../core/services/product.service';
import { AlertService } from '../../../core/services/alert.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    CommonModule,
    IconDirective,
    ButtonModule,
    CardModule,
    BadgeModule,
    SpinnerModule,
    AlertModule,
    RowComponent,
    ColComponent
  ],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss']
})
export class ProductDetailComponent implements OnInit {
  product: Product | null = null;
  loading = false;
  productId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.productId = +params['id'];
        this.loadProduct();
      }
    });
  }

  loadProduct(): void {
    if (!this.productId) return;

    this.loading = true;
    this.productService.getProduct(this.productId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.product = response.data;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading product:', error);
        this.alertService.showError('Erreur', 'Impossible de charger les détails du produit');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  editProduct(): void {
    if (this.productId) {
      this.router.navigate(['/products/edit', this.productId]);
    }
  }

  deleteProduct(): void {
    if (!this.productId || !this.product) return;

    this.alertService.showDeleteConfirmation(this.product.name, 'le produit').then((result) => {
      if (result.isConfirmed && this.productId) {
        this.productService.deleteProduct(this.productId).subscribe({
          next: (response) => {
            if (response.success) {
              this.alertService.showSuccess('Succès', 'Produit supprimé avec succès');
              this.router.navigate(['/products']);
            }
          },
          error: (error) => {
            console.error('Error deleting product:', error);
            this.alertService.showError('Erreur', 'Impossible de supprimer le produit');
          }
        });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/products']);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'INACTIVE': return 'secondary';
      case 'DISCONTINUED': return 'danger';
      default: return 'secondary';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'Actif';
      case 'INACTIVE': return 'Inactif';
      case 'DISCONTINUED': return 'Discontinué';
      default: return status;
    }
  }

  getStockStatusColor(): string {
    if (!this.product) return 'secondary';
    
    if (this.product.stock_quantity === 0) {
      return 'danger';
    } else if (this.product.stock_quantity && this.product.low_stock_threshold && 
               this.product.stock_quantity <= this.product.low_stock_threshold) {
      return 'warning';
    }
    return 'success';
  }

  getStockStatusText(): string {
    if (!this.product) return '';
    
    if (this.product.stock_quantity === 0) {
      return 'Rupture de stock';
    } else if (this.product.stock_quantity && this.product.low_stock_threshold && 
               this.product.stock_quantity <= this.product.low_stock_threshold) {
      return 'Stock faible';
    }
    return 'En stock';
  }

  calculateMargin(): number {
    if (!this.product || !this.product.purchase_price || !this.product.selling_price) {
      return 0;
    }
    const margin = ((this.product.selling_price - this.product.purchase_price) / this.product.selling_price) * 100;
    return Math.max(0, margin);
  }
}
