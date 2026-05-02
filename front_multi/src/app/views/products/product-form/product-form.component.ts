import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import {
  ButtonModule,
  CardModule,
  FormModule,
  SpinnerModule,
  AlertModule,
  ProgressModule,
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
    AlertModule,
    ProgressModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.scss']
})
export class ProductFormComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  productForm: FormGroup;
  categories: ProductCategory[] = [];
  units: Unit[] = [];

  loading  = false;
  saving   = false;
  error: string | null = null;

  isEditMode = false;
  productId: number | null = null;
  product: Product | null = null;

  // ── Image state ──
  selectedFile: File | null = null;
  imagePreview: string | null = null;   // base64 pour la prévisualisation locale
  currentImageUrl: string | null = null; // URL de l'image sauvegardée
  pendingRemoveImage = false;           // l'utilisateur veut supprimer l'image existante
  uploadProgress = 0;
  imageError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    this.productForm = this.fb.group({
      name:                   ['', [Validators.required, Validators.maxLength(150)]],
      description:            ['', [Validators.maxLength(1000)]],
      sku:                    ['', [Validators.maxLength(50)]],
      product_category_id:    [''],
      unit_id:                [''],
      // Prix unité (override)
      purchase_price:         ['', [Validators.min(0)]],
      selling_price:          ['', [Validators.min(0)]],
      // Section carton
      carton_purchase_price:  ['', [Validators.min(0)]],
      carton_selling_price:   ['', [Validators.min(0)]],
      units_per_carton:       [12, [Validators.min(1)]],
      stock_quantity:         [0,  [Validators.min(0)]],
      low_stock_threshold:    [10, [Validators.min(0)]],
      status:                 ['ACTIVE', [Validators.required]],
      barcode:                ['', [Validators.maxLength(100)]]
    });
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadUnits();

    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.productId  = +params['id'];
        this.loadProduct();
      }
    });
  }

  // ─────────────────────────────────────────────
  // Chargement du produit
  // ─────────────────────────────────────────────

  loadProduct(): void {
    if (!this.productId) return;
    this.loading = true;
    this.cdr.markForCheck();

    this.productService.getProduct(this.productId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.product        = response.data;
            this.currentImageUrl = response.data.image_url ?? null;
            this.populateForm();
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error   = err.message || 'Erreur lors du chargement du produit';
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  populateForm(): void {
    if (!this.product) return;
    this.productForm.patchValue({
      name:                  this.product.name,
      description:           this.product.description           || '',
      sku:                   this.product.sku                   || '',
      product_category_id:   this.product.product_category_id   || '',
      unit_id:               this.product.unit_id               || '',
      purchase_price:        this.product.purchase_price        || '',
      selling_price:         this.product.selling_price         || '',
      carton_purchase_price: this.product.carton_purchase_price || '',
      carton_selling_price:  this.product.carton_selling_price  || '',
      units_per_carton:      this.product.units_per_carton      ?? 12,
      stock_quantity:        this.product.stock_quantity        ?? 0,
      low_stock_threshold:   this.product.low_stock_threshold   ?? 10,
      status:                this.product.status                || 'ACTIVE',
      barcode:               this.product.barcode               || '',
    });
  }

  // ── Calculs carton ────────────────────────────────────────────────────────
  get cartonSellingPrice(): number { return +(this.productForm.get('carton_selling_price')?.value) || 0; }
  get unitsPerCarton(): number     { return +(this.productForm.get('units_per_carton')?.value) || 12; }

  get calcUnitPrice(): number {
    const manual = +(this.productForm.get('selling_price')?.value) || 0;
    if (manual > 0) return manual;
    return this.unitsPerCarton > 0 ? Math.round(this.cartonSellingPrice / this.unitsPerCarton) : 0;
  }
  get calcHalfCartonPrice(): number { return Math.round(this.cartonSellingPrice / 2); }
  get calcDozenPrice(): number      { return Math.round(this.calcUnitPrice * 12); }

  loadCategories(): void {
    this.productService.getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => {
          if (response.success) {
            this.categories = Array.isArray(response.data)
              ? response.data
              : (response.data?.data || []);
            this.cdr.markForCheck();
          }
        },
        error: () => { this.categories = []; this.cdr.markForCheck(); }
      });
  }

  loadUnits(): void {
    this.productService.getUnits()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => {
          if (response.success) {
            this.units = Array.isArray(response.data)
              ? response.data
              : (response.data?.data || []);
            this.cdr.markForCheck();
          }
        },
        error: () => { this.units = []; this.cdr.markForCheck(); }
      });
  }

  // ─────────────────────────────────────────────
  // Gestion de l'image
  // ─────────────────────────────────────────────

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.imageError = 'Format non supporté. Utilisez JPG, PNG ou WebP.';
      this.cdr.markForCheck();
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.imageError = 'L\'image ne doit pas dépasser 2 Mo.';
      this.cdr.markForCheck();
      return;
    }

    this.imageError        = null;
    this.selectedFile      = file;
    this.pendingRemoveImage = false;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagePreview = e.target?.result as string;
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  clearSelectedImage(): void {
    this.selectedFile  = null;
    this.imagePreview  = null;
    this.imageError    = null;
    this.cdr.markForCheck();
  }

  markImageForRemoval(): void {
    this.pendingRemoveImage = true;
    this.selectedFile       = null;
    this.imagePreview       = null;
    this.cdr.markForCheck();
  }

  cancelRemoval(): void {
    this.pendingRemoveImage = false;
    this.cdr.markForCheck();
  }

  get displayedImageUrl(): string | null {
    if (this.imagePreview)        return this.imagePreview;
    if (!this.pendingRemoveImage) return this.currentImageUrl;
    return null;
  }

  // ─────────────────────────────────────────────
  // Soumission du formulaire
  // ─────────────────────────────────────────────

  onSubmit(): void {
    if (this.productForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.saving = true;
    this.error  = null;
    this.cdr.markForCheck();

    const formData: any = { ...this.productForm.value };

    ['purchase_price', 'selling_price', 'carton_purchase_price', 'carton_selling_price', 'weight'].forEach(f => {
      if (formData[f] === '' || formData[f] === null) formData[f] = null;
    });
    ['product_category_id', 'unit_id'].forEach(f => {
      if (formData[f] === '') formData[f] = null;
    });

    const operation = this.isEditMode
      ? this.productService.updateProduct(this.productId!, formData)
      : this.productService.createProduct(formData);

    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const savedId = response.data.id;

          // S'il y a une action image en attente, on l'exécute avant de naviguer
          if (this.selectedFile) {
            this.handleImageUpload(savedId);
          } else if (this.pendingRemoveImage && this.currentImageUrl) {
            this.handleImageRemoval(savedId);
          } else {
            this.onSaveComplete();
          }
        }
      },
      error: (err) => {
        this.error  = err.message || 'Erreur lors de la sauvegarde';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  private handleImageUpload(productId: number): void {
    this.productService.uploadImage(productId, this.selectedFile!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ()    => this.onSaveComplete(),
        error: (err) => {
          // Le produit est sauvegardé mais l'image a échoué — on prévient et on redirige quand même
          this.error  = 'Produit sauvegardé mais erreur lors de l\'upload de l\'image.';
          this.saving = false;
          this.cdr.markForCheck();
          setTimeout(() => this.router.navigate(['/products/list']), 2000);
        }
      });
  }

  private handleImageRemoval(productId: number): void {
    this.productService.removeImage(productId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ()    => this.onSaveComplete(),
        error: ()   => this.onSaveComplete() // non bloquant
      });
  }

  private onSaveComplete(): void {
    const msg = this.isEditMode ? 'Produit mis à jour avec succès' : 'Produit créé avec succès';
    this.productService.showSuccessMessage(msg);
    this.router.navigate(['/products/list']);
  }

  cancel(): void {
    this.router.navigate(['/products/list']);
  }

  // ─────────────────────────────────────────────
  // Helpers formulaire
  // ─────────────────────────────────────────────

  get f() { return this.productForm.controls; }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.productForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.productForm.get(fieldName);
    if (!field?.errors) return '';
    const errors = field.errors;
    if (errors['required'])  return `${this.getFieldLabel(fieldName)} est requis`;
    if (errors['maxlength']) return `${this.getFieldLabel(fieldName)} ne peut pas dépasser ${errors['maxlength'].requiredLength} caractères`;
    if (errors['min'])       return `${this.getFieldLabel(fieldName)} doit être ≥ ${errors['min'].min}`;
    return 'Valeur invalide';
  }

  getFieldLabel(fieldName: string): string {
    const labels: Record<string, string> = {
      name: 'Nom', description: 'Description', sku: 'SKU',
      product_category_id: 'Catégorie', unit_id: 'Unité',
      purchase_price: "Prix d'achat", selling_price: 'Prix de vente',
      stock_quantity: 'Quantité en stock', low_stock_threshold: 'Seuil de stock faible',
      status: 'Statut', barcode: 'Code-barres',
    };
    return labels[fieldName] || fieldName;
  }

  private markFormGroupTouched(): void {
    Object.keys(this.productForm.controls).forEach(key =>
      this.productForm.get(key)?.markAsTouched()
    );
  }

  calculateMargin(): number {
    const buy  = this.productForm.get('purchase_price')?.value;
    const sell = this.productForm.get('selling_price')?.value;
    if (!buy || !sell || sell <= 0) return 0;
    return ((sell - buy) / sell) * 100;
  }

  generateSKU(): void {
    const name = this.productForm.get('name')?.value;
    if (!name) return;
    const sku = name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8)
      + '-' + Date.now().toString().slice(-4);
    this.productForm.patchValue({ sku });
  }

  onCategoryChange(): void {}

  formatPrice(value: number): string {
    return this.productService.formatPrice(value);
  }

  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }
}
