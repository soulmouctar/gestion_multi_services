import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule, CardModule, FormModule, ModalModule, SpinnerModule } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/services/auth.service';
import { InvoiceHeaderService, InvoiceHeader } from '../../../core/services/invoice-header.service';
import { PdfService } from '../../../core/services/pdf.service';

type SaleType = 'UNITE' | 'CARTON' | 'DEMI_CARTON' | 'DOUZAINE';

interface InvoiceLineItem {
  product_id: number | null;
  supplier_id: number | null;
  sale_type: SaleType;
  is_sample: boolean;
  description: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
}

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    IconDirective,
    ButtonModule,
    CardModule,
    FormModule,
    ModalModule,
    SpinnerModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoices.component.html'
})
export class InvoicesComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  invoices: any[] = [];
  clients: any[] = [];
  currencies: any[] = [];
  products: any[] = [];
  suppliers: any[] = [];
  invoiceLineItems: InvoiceLineItem[] = [];
  clientBalance: any = null;
  invoiceHeader: InvoiceHeader | null = null;

  loading = false;
  lineItemsError = '';
  error: string | null = null;
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  itemsPerPage = 15;

  showFormModal = false;
  editMode = false;
  submitted = false;
  loadingClientBalance = false;
  invoiceForm: FormGroup;
  selectedInvoice: any = null;

  Math = Math;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private alertService: AlertService,
    private router: Router,
    private invoiceHeaderService: InvoiceHeaderService,
    private pdfService: PdfService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {
    this.invoiceForm = this.fb.group({
      client_id: [null, Validators.required],
      invoice_number: [''],
      total_amount: [{ value: 0, disabled: true }],
      currency: ['GNF'],
      exchange_rate: [{ value: 1, disabled: true }],
      status: ['IMPAYE'],
      due_date: [''],
      notes: [''],
      include_previous_balance: [true],
      previous_balance_amount: [{ value: 0, disabled: true }],
    });

    this.invoiceForm.get('currency')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((code) => this.onCurrencyChange(code));

    this.invoiceForm.get('client_id')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((clientId) => this.onClientChanged(clientId));

    this.invoiceForm.get('include_previous_balance')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.refreshPreviousBalanceControl();
        this.syncComputedTotals();
      });

    this.invoiceForm.get('previous_balance_amount')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncComputedTotals());
  }

  ngOnInit(): void {
    this.loadInvoices();
    this.loadClients();
    this.loadCurrencies();
    this.loadProducts();
    this.loadSuppliers();
    this.loadDefaultInvoiceHeader();
  }

  private loadDefaultInvoiceHeader(): void {
    this.invoiceHeaderService.getHeaders({ is_default: true, per_page: 1 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const headers = Array.isArray(response.data) ? response.data : (response.data.data || response.data || []);
          this.invoiceHeader = headers?.[0] || null;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.invoiceHeader = null;
        this.cdr.detectChanges();
      }
    });
  }

  loadCurrencies(): void {
    this.apiService.get<any>('currencies?per_page=100').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          const data = Array.isArray(r.data) ? r.data : (r.data.data || []);
          this.currencies = data.filter((c: any) => c.is_active);
        }
        this.cdr.detectChanges();
      }
    });
  }

  loadClients(): void {
    this.apiService.get<any>('clients?per_page=200').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.clients = r.data.data || r.data || [];
        }
        this.cdr.detectChanges();
      }
    });
  }

  loadProducts(): void {
    this.apiService.get<any>('products?per_page=500').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.products = r.data.data || r.data || [];
        }
        this.cdr.detectChanges();
      }
    });
  }

  loadSuppliers(): void {
    this.apiService.get<any>('suppliers?per_page=300').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.suppliers = r.data.data || r.data || [];
        }
        this.cdr.detectChanges();
      }
    });
  }

  loadInvoices(): void {
    this.loading = true;
    this.error = null;
    this.apiService.get<any>(`invoices?page=${this.currentPage}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          const p = r.data;
          this.invoices = p.data || [];
          this.currentPage = p.current_page || 1;
          this.totalPages = p.last_page || 1;
          this.totalItems = p.total || 0;
          this.itemsPerPage = p.per_page || 15;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Erreur lors du chargement';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadInvoices();
  }

  onCurrencyChange(code: string): void {
    const rateCtrl = this.invoiceForm.get('exchange_rate');
    if (!rateCtrl) return;

    if (!code || code === 'GNF') {
      rateCtrl.setValue(1, { emitEvent: false });
      rateCtrl.disable({ emitEvent: false });
      this.cdr.detectChanges();
      return;
    }

    const cur = this.currencies.find(c => c.code === code);
    rateCtrl.setValue(cur ? cur.exchange_rate : 1, { emitEvent: false });
    rateCtrl.enable({ emitEvent: false });
    this.cdr.detectChanges();
  }

  onClientChanged(clientId: number | null): void {
    if (!clientId) {
      this.clientBalance = null;
      this.setPreviousBalanceAmount(0);
      this.syncComputedTotals();
      this.cdr.detectChanges();
      return;
    }

    this.loadClientBalance(clientId);
  }

  private loadClientBalance(clientId: number, preserveCurrentAmount = false): void {
    this.loadingClientBalance = true;
    this.apiService.get<any>(`clients/${clientId}/balance`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.loadingClientBalance = false;
        this.clientBalance = r.success ? r.data : null;
        if (!preserveCurrentAmount) {
          this.setPreviousBalanceAmount(this.clientBalance?.total_remaining || 0);
        }
        this.syncComputedTotals();
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingClientBalance = false;
        this.clientBalance = null;
        this.setPreviousBalanceAmount(0);
        this.syncComputedTotals();
        this.cdr.detectChanges();
      }
    });
  }

  get selectedCurrencySymbol(): string {
    const code = this.invoiceForm.get('currency')?.value;
    const cur = this.currencies.find(c => c.code === code);
    return cur?.symbol || code || 'GNF';
  }

  get itemsSubtotal(): number {
    return this.invoiceLineItems.reduce((sum, item) => sum + this.getLineTotal(item), 0);
  }

  get previousBalanceApplied(): number {
    return this.invoiceForm.get('include_previous_balance')?.value
      ? Number(this.invoiceForm.getRawValue().previous_balance_amount || 0)
      : 0;
  }

  get invoiceTotal(): number {
    return this.itemsSubtotal + this.previousBalanceApplied;
  }

  get amountInGnf(): number {
    const rate = +(this.invoiceForm.getRawValue().exchange_rate || 1);
    const cur = this.invoiceForm.get('currency')?.value;
    return cur === 'GNF' ? this.invoiceTotal : Math.round(this.invoiceTotal * rate);
  }

  openCreateModal(): void {
    this.editMode = false;
    this.submitted = false;
    this.selectedInvoice = null;
    this.clientBalance = null;
    this.lineItemsError = '';
    this.invoiceForm.reset({
      client_id: null,
      invoice_number: '',
      total_amount: 0,
      currency: 'GNF',
      exchange_rate: 1,
      status: 'IMPAYE',
      due_date: '',
      notes: '',
      include_previous_balance: true,
      previous_balance_amount: 0,
    });
    this.invoiceForm.get('exchange_rate')?.disable({ emitEvent: false });
    this.invoiceForm.get('previous_balance_amount')?.disable({ emitEvent: false });
    this.invoiceLineItems = [this.createEmptyLineItem()];
    this.syncComputedTotals();
    this.showFormModal = true;
  }

  openEditModal(invoice: any): void {
    this.editMode = true;
    this.submitted = false;
    this.selectedInvoice = invoice;
    this.lineItemsError = '';

    const currency = invoice.currency || 'GNF';
    const includePreviousBalance = Number(invoice.previous_balance_amount || 0) > 0;
    this.invoiceForm.patchValue({
      client_id: invoice.client_id,
      invoice_number: invoice.invoice_number || '',
      total_amount: invoice.total_amount || 0,
      currency,
      exchange_rate: invoice.exchange_rate || 1,
      status: invoice.status || 'IMPAYE',
      due_date: invoice.due_date ? invoice.due_date.substring(0, 10) : '',
      notes: invoice.notes || '',
      include_previous_balance: includePreviousBalance,
      previous_balance_amount: invoice.previous_balance_amount || 0,
    }, { emitEvent: false });

    this.invoiceLineItems = Array.isArray(invoice.items) && invoice.items.length > 0
      ? invoice.items.map((item: any) => ({
          product_id: item.product_id ?? null,
          supplier_id: item.supplier_id ?? null,
          sale_type:  (item.sale_type as SaleType) || 'UNITE',
          is_sample: !!item.is_sample,
          description: item.description || '',
          quantity: Number(item.quantity || 1),
          unit_price: Number(item.unit_price || 0),
          discount_amount: Number(item.discount_amount || 0),
        }))
      : [this.createFallbackLineItem(invoice)];

    this.onCurrencyChange(currency);
    this.refreshPreviousBalanceControl();
    if (invoice.client_id) {
      this.loadClientBalance(invoice.client_id, true);
    }
    this.syncComputedTotals();
    this.showFormModal = true;
  }

  saveInvoice(): void {
    this.submitted = true;
    this.lineItemsError = '';

    if (this.invoiceForm.invalid) return;

    const lineItems = this.invoiceLineItems
      .filter((item) => !!item.description?.trim())
      .map((item) => ({
        product_id: item.product_id || null,
        supplier_id: item.supplier_id || null,
        sale_type:  item.sale_type || 'UNITE',
        is_sample: !!item.is_sample,
        description: item.description.trim(),
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0),
        discount_amount: Number(item.discount_amount || 0),
      }))
      .filter((item) => item.quantity > 0);

    if (lineItems.length === 0) {
      this.lineItemsError = 'Ajoutez au moins une ligne de facturation valide.';
      this.cdr.detectChanges();
      return;
    }

    const raw = this.invoiceForm.getRawValue();
    const payload = {
      client_id: raw.client_id,
      invoice_number: raw.invoice_number || null,
      total_amount: this.itemsSubtotal,
      currency: raw.currency,
      exchange_rate: raw.exchange_rate,
      status: raw.status,
      due_date: raw.due_date || null,
      notes: raw.notes || null,
      include_previous_balance: !!raw.include_previous_balance,
      previous_balance_amount: raw.include_previous_balance ? this.previousBalanceApplied : 0,
      line_items: lineItems,
    };

    const obs = this.editMode && this.selectedInvoice
      ? this.apiService.put<any>(`invoices/${this.selectedInvoice.id}`, payload)
      : this.apiService.post<any>('invoices', payload);

    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success) {
          this.alertService.showSuccess(this.editMode ? 'Facture mise à jour' : 'Facture créée');
          this.showFormModal = false;
          this.loadInvoices();
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        this.alertService.showError('Erreur', err.message || 'Erreur lors de la sauvegarde');
      }
    });
  }

  deleteInvoice(inv: any): void {
    this.alertService.showDeleteConfirmation(inv.invoice_number, 'facture').then(r => {
      if (!r.isConfirmed) return;
      this.apiService.delete<any>(`invoices/${inv.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.alertService.showSuccess('Facture supprimée');
          this.loadInvoices();
        },
        error: (err) => this.alertService.showError('Erreur', err.message || 'Erreur'),
      });
    });
  }

  printInvoice(invoice: any): void {
    const items = Array.isArray(invoice.items) && invoice.items.length > 0
      ? invoice.items.map((item: any) => ({
          description: item.description || 'Ligne de facture',
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unit_price || 0),
          total: Number(item.total || (Number(item.quantity || 0) * Number(item.unit_price || 0))),
        }))
      : [{
          description: invoice.notes || 'Ligne de facture',
          quantity: 1,
          unitPrice: Number(invoice.items_subtotal_amount || invoice.total_amount || 0),
          total: Number(invoice.items_subtotal_amount || invoice.total_amount || 0),
        }];

    const subtotal = Number(invoice.items_subtotal_amount || invoice.total_amount || 0) - Number(invoice.previous_balance_amount || 0);
    const total = Number(invoice.total_amount || 0);
    const totalGnf = invoice.total_amount_gnf || (invoice.currency !== 'GNF' ? Math.round(total * Number(invoice.exchange_rate || 1)) : total);
    const tenant = this.authService.currentTenant;
    const header = this.invoiceHeader;

    void this.pdfService.generateProfessionalInvoicePdf({
      invoiceNumber: invoice.invoice_number || `INV-${invoice.id}`,
      date: invoice.created_at || new Date(),
      dueDate: invoice.due_date || new Date(),
      clientName: this.getClientName(invoice.client_id),
      clientAddress: invoice.client?.address || invoice.client_address || '',
      clientPhone: invoice.client?.phone1 || invoice.client?.phone || '',
      clientEmail: invoice.client?.email || '',
      organisation: {
        name: header?.company_name || tenant?.name || 'GESTION MULTI-MODULES',
        address: [header?.address, header?.city, header?.country].filter(Boolean).join(' - ') || (tenant?.subscription?.plan?.name ? `Plan: ${tenant.subscription.plan.name}` : ''),
        phone: header?.phone || tenant?.phone || '',
        email: header?.email || tenant?.email || '',
        motto: header?.footer_text || 'Facturation détaillée et transparente',
        logoUrl: header?.logo_url || '',
        signatureUrl: (header as any)?.signature_url || '',
        stampUrl: (header as any)?.stamp_url || '',
        footerText: header?.footer_text || '',
      },
      items,
      subtotal,
      previousBalance: Number(invoice.previous_balance_amount || 0),
      total,
      currency: invoice.currency || 'GNF',
      exchangeRate: Number(invoice.exchange_rate || 1),
      totalGnf,
      status: invoice.status || 'IMPAYE',
      notes: invoice.notes || '',
    });
  }

  downloadInvoice(invoice: any): void {
    const items = Array.isArray(invoice.items) && invoice.items.length > 0
      ? invoice.items.map((item: any) => ({
          description: item.description || 'Ligne de facture',
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unit_price || 0),
          total: Number(item.total || (Number(item.quantity || 0) * Number(item.unit_price || 0))),
        }))
      : [{
          description: invoice.notes || 'Ligne de facture',
          quantity: 1,
          unitPrice: Number(invoice.items_subtotal_amount || invoice.total_amount || 0),
          total: Number(invoice.items_subtotal_amount || invoice.total_amount || 0),
        }];

    const subtotal = Number(invoice.items_subtotal_amount || invoice.total_amount || 0) - Number(invoice.previous_balance_amount || 0);
    const total = Number(invoice.total_amount || 0);
    const totalGnf = invoice.total_amount_gnf || (invoice.currency !== 'GNF' ? Math.round(total * Number(invoice.exchange_rate || 1)) : total);
    const tenant = this.authService.currentTenant;
    const header = this.invoiceHeader;

    void this.pdfService.downloadProfessionalInvoicePdf({
      invoiceNumber: invoice.invoice_number || `INV-${invoice.id}`,
      date: invoice.created_at || new Date(),
      dueDate: invoice.due_date || new Date(),
      clientName: this.getClientName(invoice.client_id),
      clientAddress: invoice.client?.address || invoice.client_address || '',
      clientPhone: invoice.client?.phone1 || invoice.client?.phone || '',
      clientEmail: invoice.client?.email || '',
      organisation: {
        name: header?.company_name || tenant?.name || 'GESTION MULTI-MODULES',
        address: [header?.address, header?.city, header?.country].filter(Boolean).join(' - ') || (tenant?.subscription?.plan?.name ? `Plan: ${tenant.subscription.plan.name}` : ''),
        phone: header?.phone || tenant?.phone || '',
        email: header?.email || tenant?.email || '',
        motto: header?.footer_text || 'Facturation détaillée et transparente',
        logoUrl: header?.logo_url || '',
        signatureUrl: header?.signature_url || '',
        stampUrl: header?.stamp_url || '',
        footerText: header?.footer_text || '',
      },
      items,
      subtotal,
      previousBalance: Number(invoice.previous_balance_amount || 0),
      total,
      currency: invoice.currency || 'GNF',
      exchangeRate: Number(invoice.exchange_rate || 1),
      totalGnf,
      status: invoice.status || 'IMPAYE',
      notes: invoice.notes || '',
    }, `facture-${invoice.invoice_number || invoice.id}.pdf`);
  }

  openInvoiceDetail(invoice: any): void {
    if (!invoice?.id) return;
    this.router.navigate(['/finance/invoices', invoice.id]);
  }

  addLineItem(): void {
    this.invoiceLineItems.push(this.createEmptyLineItem());
    this.syncComputedTotals();
  }

  removeLineItem(index: number): void {
    if (this.invoiceLineItems.length === 1) {
      this.invoiceLineItems[0] = this.createEmptyLineItem();
    } else {
      this.invoiceLineItems.splice(index, 1);
    }
    this.syncComputedTotals();
  }

  readonly saleTypeOptions: { value: SaleType; label: string }[] = [
    { value: 'UNITE',       label: 'À l\'unité' },
    { value: 'CARTON',      label: 'Carton complet' },
    { value: 'DEMI_CARTON', label: 'Demi-carton' },
    { value: 'DOUZAINE',    label: 'À la douzaine' },
  ];

  onProductSelected(item: InvoiceLineItem): void {
    if (!item.product_id) return;
    const product = this.products.find((p) => p.id === item.product_id);
    if (!product) return;
    item.description = product.name || item.description;
    item.unit_price  = this.getPriceForSaleType(product, item.sale_type);
    if (!item.quantity || item.quantity <= 0) item.quantity = 1;
    this.syncComputedTotals();
  }

  onSaleTypeChanged(item: InvoiceLineItem): void {
    if (!item.product_id) return;
    const product = this.products.find((p) => p.id === item.product_id);
    if (!product) return;
    item.unit_price = this.getPriceForSaleType(product, item.sale_type);
    this.syncComputedTotals();
  }

  getPriceForSaleType(product: any, saleType: SaleType): number {
    switch (saleType) {
      case 'CARTON':
        return Number(product.carton_selling_price || 0);
      case 'DEMI_CARTON':
        return Number(product.half_carton_price || (product.carton_selling_price ? product.carton_selling_price / 2 : 0));
      case 'DOUZAINE':
        return Number(product.dozen_price || (product.unit_selling_price ? product.unit_selling_price * 12 : 0));
      case 'UNITE':
      default:
        return Number(product.unit_selling_price || product.selling_price || 0);
    }
  }

  getSaleTypeLabel(saleType: SaleType): string {
    return this.saleTypeOptions.find(o => o.value === saleType)?.label ?? 'À l\'unité';
  }

  getProductPriceSummary(productId: number | null): string {
    if (!productId) return '';
    const p = this.products.find(pr => pr.id === productId);
    if (!p) return '';
    const parts: string[] = [];
    if (p.unit_selling_price)    parts.push(`Unité: ${p.unit_selling_price}`);
    if (p.carton_selling_price)  parts.push(`Carton: ${p.carton_selling_price}`);
    if (p.half_carton_price)     parts.push(`½ Carton: ${p.half_carton_price}`);
    if (p.dozen_price)           parts.push(`Douzaine: ${p.dozen_price}`);
    return parts.join(' | ');
  }

  getLineTotal(item: InvoiceLineItem): number {
    if (item.is_sample) return 0;
    const gross    = Number(item.quantity || 0) * Number(item.unit_price || 0);
    const discount = Number(item.discount_amount || 0);
    return Math.max(0, gross - discount);
  }

  getClientName(id: number): string {
    const c = this.clients.find(cl => cl.id === id);
    return c ? c.name : `#${id}`;
  }

  getStatusClass(status: string): string {
    return ({ IMPAYE: 'danger', PARTIEL: 'warning', PAYE: 'success' } as Record<string, string>)[status] || 'secondary';
  }

  getStatusLabel(status: string): string {
    return ({ IMPAYE: 'Impayée', PARTIEL: 'Partielle', PAYE: 'Payée' } as Record<string, string>)[status] || status;
  }

  getPages(): number[] {
    const s = Math.max(1, this.currentPage - 4);
    const e = Math.min(this.totalPages, s + 9);
    return Array.from({ length: e - s + 1 }, (_, i) => s + i);
  }

  trackById(_: number, item: any): any {
    return item?.id ?? _;
  }

  trackByIndex(index: number): number {
    return index;
  }

  private createEmptyLineItem(): InvoiceLineItem {
    return {
      product_id: null,
      supplier_id: null,
      sale_type: 'UNITE',
      is_sample: false,
      description: '',
      quantity: 1,
      unit_price: 0,
      discount_amount: 0,
    };
  }

  private createFallbackLineItem(invoice: any): InvoiceLineItem {
    return {
      product_id: null,
      supplier_id: null,
      sale_type: 'UNITE',
      is_sample: false,
      description: invoice.notes || 'Ligne de facturation',
      quantity: 1,
      unit_price: Number(invoice.items_subtotal_amount || invoice.total_amount || 0),
      discount_amount: 0,
    };
  }

  syncComputedTotals(): void {
    this.invoiceForm.get('total_amount')?.setValue(this.invoiceTotal, { emitEvent: false });
    this.cdr.detectChanges();
  }

  private refreshPreviousBalanceControl(): void {
    const balanceCtrl = this.invoiceForm.get('previous_balance_amount');
    if (!balanceCtrl) return;

    if (this.invoiceForm.get('include_previous_balance')?.value) {
      balanceCtrl.enable({ emitEvent: false });
    } else {
      balanceCtrl.disable({ emitEvent: false });
      balanceCtrl.setValue(0, { emitEvent: false });
    }
  }

  private setPreviousBalanceAmount(amount: number): void {
    this.invoiceForm.get('previous_balance_amount')?.setValue(Number(amount || 0), { emitEvent: false });
    this.refreshPreviousBalanceControl();
  }
}
