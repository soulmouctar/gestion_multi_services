import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ButtonModule, FormModule, ModalModule, SpinnerModule } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import { AlertService } from '../../../core/services/alert.service';

@Component({
  selector: 'app-product-returns',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IconDirective,
    ButtonModule,
    FormModule,
    ModalModule,
    SpinnerModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-returns.component.html'
})
export class ProductReturnsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  returns: any[] = [];
  products: any[] = [];
  clients: any[] = [];
  invoices: any[] = [];

  loading = false;
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  showFormModal = false;
  submitted = false;

  returnForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef
  ) {
    this.returnForm = this.fb.group({
      product_id: [null, Validators.required],
      client_id: [null],
      invoice_id: [null],
      quantity: [1, [Validators.required, Validators.min(0.01)]],
      unit_price: [0, [Validators.required, Validators.min(0)]],
      return_date: [new Date().toISOString().split('T')[0], Validators.required],
      reintegrate_to_stock: [true],
      account_impact: ['CREDIT_NOTE', Validators.required],
      notes: [''],
    });
  }

  ngOnInit(): void {
    this.returnForm.get('product_id')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((productId) => this.onProductChange(productId));

    this.loadReturns();
    this.loadProducts();
    this.loadClients();
    this.loadInvoices();
  }

  loadReturns(): void {
    this.loading = true;
    this.apiService.get<any>(`product-returns?page=${this.currentPage}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          const p = r.data;
          this.returns = p.data || [];
          this.currentPage = p.current_page || 1;
          this.totalPages = p.last_page || 1;
          this.totalItems = p.total || 0;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.returns = [];
        this.cdr.detectChanges();
      }
    });
  }

  loadProducts(): void {
    this.apiService.get<any>('products?per_page=500').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.products = r.success ? (r.data.data || r.data || []) : [];
        this.cdr.detectChanges();
      }
    });
  }

  loadClients(): void {
    this.apiService.get<any>('clients?per_page=500').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.clients = r.success ? (r.data.data || r.data || []) : [];
        this.cdr.detectChanges();
      }
    });
  }

  loadInvoices(): void {
    this.apiService.get<any>('invoices?per_page=500').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.invoices = r.success ? (r.data.data || r.data || []) : [];
        this.cdr.detectChanges();
      }
    });
  }

  openCreateModal(): void {
    this.submitted = false;
    this.returnForm.reset({
      product_id: null,
      client_id: null,
      invoice_id: null,
      quantity: 1,
      unit_price: 0,
      return_date: new Date().toISOString().split('T')[0],
      reintegrate_to_stock: true,
      account_impact: 'CREDIT_NOTE',
      notes: '',
    });
    this.showFormModal = true;
  }

  saveReturn(): void {
    this.submitted = true;
    if (this.returnForm.invalid) return;

    this.apiService.post<any>('product-returns', this.returnForm.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success) {
          this.alertService.showSuccess('Retour produit enregistré');
          this.showFormModal = false;
          this.loadReturns();
        }
      },
      error: (err) => {
        this.alertService.showError('Erreur', err?.error?.message || 'Erreur lors de l’enregistrement du retour');
      }
    });
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadReturns();
  }

  onProductChange(productId: number | null): void {
    if (!productId) return;
    const product = this.products.find((p) => p.id === productId);
    if (!product) return;
    this.returnForm.patchValue({
      unit_price: Number(product.sale_price || product.selling_price || 0),
    });
  }

  getProductName(id: number): string {
    return this.products.find((p) => p.id === id)?.name || `#${id}`;
  }

  getClientName(id: number): string {
    return this.clients.find((c) => c.id === id)?.name || '-';
  }

  getInvoiceNumber(id: number): string {
    return this.invoices.find((inv) => inv.id === id)?.invoice_number || '-';
  }

  getPages(): number[] {
    const start = Math.max(1, this.currentPage - 4);
    const end = Math.min(this.totalPages, start + 9);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  trackById(_: number, item: any): any {
    return item?.id ?? _;
  }
}
