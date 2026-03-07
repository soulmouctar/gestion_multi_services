import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import {
  ButtonModule,
  CardModule,
  FormModule,
  SpinnerModule,
  AlertModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

import { ProductService, Product, ProductCategory, Unit } from '../../../core/services/product.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IconDirective,
    ButtonModule,
    CardModule,
    FormModule,
    SpinnerModule,
    AlertModule
  ],
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.scss']
})
export class ProductFormComponent implements OnInit {
  productForm: FormGroup;
  categories: ProductCategory[] = [];
  units: Unit[] = [];
  
  loading = false;
  saving = false;
  error: string | null = null;
  
  isEditMode = false;
  productId: number | null = null;
  product: Product | null = null;

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(150)]],
      description: ['', [Validators.maxLength(1000)]],
      sku: ['', [Validators.maxLength(50)]],
      product_category_id: [''],
      unit_id: [''],
      purchase_price: ['', [Validators.min(0)]],
      selling_price: ['', [Validators.min(0)]],
      stock_quantity: [0, [Validators.min(0)]],
      low_stock_threshold: [10, [Validators.min(0)]],
      status: ['ACTIVE', [Validators.required]],
      barcode: ['', [Validators.maxLength(100)]]
    });
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadUnits();
    
    // Check if we're in edit mode
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.productId = +params['id'];
        this.loadProduct();
      }
    });
  }

  loadProduct(): void {
    if (!this.productId) return;
    
    this.loading = true;
    this.error = null;
    this.cdr.detectChanges();

    this.productService.getProduct(this.productId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.product = response.data;
          this.populateForm();
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading product:', error);
        this.error = error.message || 'Erreur lors du chargement du produit';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  populateForm(): void {
    if (!this.product) return;
    
    this.productForm.patchValue({
      name: this.product.name,
      description: this.product.description || '',
      sku: this.product.sku || '',
      product_category_id: this.product.product_category_id || '',
      unit_id: this.product.unit_id || '',
      purchase_price: this.product.purchase_price || '',
      selling_price: this.product.selling_price || '',
      stock_quantity: this.product.stock_quantity || 0,
      low_stock_threshold: this.product.low_stock_threshold || 10,
      status: this.product.status || 'ACTIVE',
      barcode: this.product.barcode || ''
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

  onSubmit(): void {
    if (this.productForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.saving = true;
    this.error = null;
    this.cdr.detectChanges();

    const formData = {
      ...this.productForm.value,
      tenant_id: 1 // Fixed for testing (replace with dynamic value later)
    };
    
    // Convert empty strings to null for numeric fields
    ['purchase_price', 'selling_price', 'weight'].forEach(field => {
      if (formData[field] === '') {
        formData[field] = null;
      }
    });

    // Convert empty strings to null for foreign keys
    ['product_category_id', 'unit_id'].forEach(field => {
      if (formData[field] === '') {
        formData[field] = null;
      }
    });

    const operation = this.isEditMode 
      ? this.productService.updateProduct(this.productId!, formData)
      : this.productService.createProduct(formData);

    operation.subscribe({
      next: (response) => {
        if (response.success) {
          const message = this.isEditMode 
            ? 'Produit mis à jour avec succès'
            : 'Produit créé avec succès';
          
          this.productService.showSuccessMessage(message);
          this.router.navigate(['/products/list']);
        }
      },
      error: (error) => {
        console.error('Error saving product:', error);
        this.error = error.message || 'Erreur lors de la sauvegarde';
        this.saving = false;
        this.cdr.detectChanges();
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/products/list']);
  }

  // Form validation helpers
  get f() {
    return this.productForm.controls;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.productForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.productForm.get(fieldName);
    if (!field || !field.errors) return '';

    const errors = field.errors;
    
    if (errors['required']) return `${this.getFieldLabel(fieldName)} est requis`;
    if (errors['maxlength']) return `${this.getFieldLabel(fieldName)} ne peut pas dépasser ${errors['maxlength'].requiredLength} caractères`;
    if (errors['min']) return `${this.getFieldLabel(fieldName)} doit être supérieur ou égal à ${errors['min'].min}`;
    if (errors['email']) return 'Format d\'email invalide';
    
    return 'Valeur invalide';
  }

  getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      'name': 'Nom',
      'description': 'Description',
      'sku': 'SKU',
      'product_category_id': 'Catégorie',
      'unit_id': 'Unité',
      'purchase_price': 'Prix d\'achat',
      'selling_price': 'Prix de vente',
      'stock_quantity': 'Quantité en stock',
      'low_stock_threshold': 'Seuil de stock faible',
      'status': 'Statut',
      'barcode': 'Code-barres',
      'weight': 'Poids',
      'dimensions': 'Dimensions',
      'supplier_info': 'Informations fournisseur',
      'notes': 'Notes'
    };
    
    return labels[fieldName] || fieldName;
  }

  private markFormGroupTouched(): void {
    Object.keys(this.productForm.controls).forEach(key => {
      const control = this.productForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
  }

  // Utility methods
  calculateMargin(): number {
    const purchasePrice = this.productForm.get('purchase_price')?.value;
    const sellingPrice = this.productForm.get('selling_price')?.value;
    
    if (!purchasePrice || !sellingPrice || sellingPrice <= 0) {
      return 0;
    }
    
    return ((sellingPrice - purchasePrice) / sellingPrice) * 100;
  }

  generateSKU(): void {
    const name = this.productForm.get('name')?.value;
    if (!name) return;
    
    // Simple SKU generation based on product name
    const sku = name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 8) + 
      '-' + 
      Date.now().toString().slice(-4);
    
    this.productForm.patchValue({ sku });
  }

  onCategoryChange(): void {
    // You can add logic here to auto-fill certain fields based on category
    const categoryId = this.productForm.get('product_category_id')?.value;
    if (categoryId) {
      const category = this.categories.find(c => c.id === +categoryId);
      if (category) {
        // Example: Set default unit based on category
        // this.productForm.patchValue({ unit_id: category.default_unit_id });
      }
    }
  }

  // Price formatting
  formatPrice(value: number): string {
    return this.productService.formatPrice(value);
  }
}
