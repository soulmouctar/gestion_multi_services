import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ButtonModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule, ProgressModule, NavModule, TabsModule,
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import Swal from 'sweetalert2';
import { environment } from '../../../../environments/environment';
import { startWith } from 'rxjs/operators';

@Component({
  selector: 'app-container-ventes',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, ProgressModule, NavModule, TabsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './container-ventes.component.html'
})
export class ContainerVentesComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);


  // ===== DATA =====
  arrivals: any[] = [];
  sales: any[] = [];
  payments: any[] = [];
  advances: any[] = [];
  clientBalances: any[] = [];
  containers: any[] = [];
  suppliers: any[] = [];
  clients: any[] = [];
  productCategories: any[] = [];
  currencyRates: Record<string, number> = {
    GNF: 1,
    USD: 8600,
    EUR: 9300
  };

  // ===== UI =====
  loading = false;
  activeTab = 'stocks';
  submitted = false;
  editMode = false;

  stats: any = {
    total_arrivals: 0, total_purchase_value: 0,
    total_sales_value: 0, total_collected: 0,
    total_pending: 0, estimated_profit: 0
  };

  // ===== PAGINATION =====
  arrivalsPage = 1; arrivalsTotalPages = 1; arrivalsTotal = 0;
  salesPage = 1; salesTotalPages = 1; salesTotal = 0;
  paymentsPage = 1; paymentsTotalPages = 1; paymentsTotal = 0;
  advancesPage = 1; advancesTotalPages = 1; advancesTotal = 0;

  // ===== FILTERS =====
  arrivalStatusFilter = '';
  saleStatusFilter = '';
  saleArrivalFilter: number | null = null;

  // ===== MODALS =====
  showArrivalModal = false;
  showArrivalDetailsModal = false;
  showSaleModal = false;
  showPaymentModal = false;
  showGlobalPaymentModal = false;
  showAdvanceModal = false;

  // ===== SELECTED =====
  selectedArrival: any = null;
  selectedArrivalDetails: any = null;
  selectedSale: any = null;
  selectedClientBalance: any = null;
  selectedSaleType: 'TOTAL' | 'PARTIEL' | 'DETAIL' = 'TOTAL';
  selectedArrivalPhotos: File[] = [];
  existingArrivalPhotos: any[] = [];
  uploadingArrivalPhotos = false;

  // ===== FORMS =====
  arrivalForm: FormGroup;
  saleForm: FormGroup;
  paymentForm: FormGroup;
  globalPaymentForm: FormGroup;
  advanceForm: FormGroup;

  // ===== CONSTANTS =====
  paymentMethods = [
    { value: 'ESPECES',      label: 'Espèces' },
    { value: 'VIREMENT',     label: 'Virement bancaire' },
    { value: 'CHEQUE',       label: 'Chèque' },
    { value: 'ORANGE_MONEY', label: 'Orange Money' },
    { value: 'MOBILE_MONEY', label: 'Mobile Money' }
  ];

  currencies = [
    { value: 'GNF', label: 'GNF - Franc Guinéen' },
    { value: 'USD', label: 'USD - Dollar Américain' },
    { value: 'EUR', label: 'EUR - Euro' }
  ];

  arrivalStatuses = [
    { value: '',             label: 'Tous' },
    { value: 'EN_COURS',     label: 'En cours' },
    { value: 'VENDU_PARTIEL',label: 'Partiel vendu' },
    { value: 'VENDU_TOTAL',  label: 'Vendu total' },
    { value: 'CLOTURE',      label: 'Clôturé' }
  ];

  saleStatuses = [
    { value: '',           label: 'Tous' },
    { value: 'EN_COURS',   label: 'En cours' },
    { value: 'PAYE_PARTIEL', label: 'Paiement partiel' },
    { value: 'PAYE_TOTAL', label: 'Payé total' },
    { value: 'ANNULE',     label: 'Annulé' }
  ];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {
    this.arrivalForm = this.fb.group({
      container_id:   [null, Validators.required],
      supplier_id:    [null],
      arrival_date:   [this.today(), Validators.required],
      purchase_price: [null, [Validators.required, Validators.min(0)]],
      currency:       ['GNF', Validators.required],
      exchange_rate:  [1, [Validators.min(0.0001)]],
      product_category_id: [null, Validators.required],
      product_type:   ['DIVERS'],
      total_quantity: [null, [Validators.required, Validators.min(1)]],
      bale_quantity:  [null, [Validators.required, Validators.min(1)]],
      description:    ['']
    });

    this.saleForm = this.fb.group({
      container_arrival_id: [null, Validators.required],
      client_id:            [null, Validators.required],
      sale_type:            ['TOTAL', Validators.required],
      quantity_sold:        [null, [Validators.required, Validators.min(1)]],
      sale_price:           [null, [Validators.required, Validators.min(0)]],
      currency:             ['GNF', Validators.required],
      exchange_rate:        [1, [Validators.min(0.0001)]],
      is_installment:       [false],
      installment_count:    [null],
      sale_date:            [this.today(), Validators.required],
      due_date:             [null],
      notes:                ['']
    });

    this.paymentForm = this.fb.group({
      container_sale_id: [null, Validators.required],
      amount:            [null, [Validators.required, Validators.min(1)]],
      currency:          ['GNF', Validators.required],
      payment_method:    ['ESPECES', Validators.required],
      payment_date:      [this.today(), Validators.required],
      reference:         [''],
      notes:             ['']
    });

    this.globalPaymentForm = this.fb.group({
      client_id:       [null, Validators.required],
      amount:          [null, [Validators.required, Validators.min(1)]],
      currency:        ['GNF', Validators.required],
      exchange_rate:   [1, [Validators.min(0.0001)]],
      payment_method:  ['ESPECES', Validators.required],
      payment_date:    [this.today(), Validators.required],
      reference:       [''],
      notes:           ['']
    });

    this.advanceForm = this.fb.group({
      client_id:      [null, Validators.required],
      amount:         [null, [Validators.required, Validators.min(1)]],
      currency:       ['GNF', Validators.required],
      payment_method: ['ESPECES', Validators.required],
      payment_date:   [this.today(), Validators.required],
      reference:      [''],
      description:    ['']
    });
  }

  ngOnInit(): void {
    this.loadContainers();
    this.loadSuppliers();
    this.loadProductCategories();
    this.loadClients();
    this.loadCurrencyRates();
    this.setupArrivalRateWatcher();
    this.setupSaleRateWatcher();
    this.setupGlobalPaymentRateWatcher();
    this.loadArrivals();
    this.loadSales();
    this.loadPayments();
    this.loadAdvances();
    this.loadClientBalances();
    this.loadStats();
  }

  // ===== LOAD DATA =====

  loadContainers(): void {
    this.apiService.get<any>('containers?per_page=200').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { this.containers = this.extractList(r); },
      error: () => { this.containers = []; }
    });
  }

  loadSuppliers(): void {
    this.apiService.get<any>('suppliers?per_page=200').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { this.suppliers = this.extractList(r); },
      error: () => { this.suppliers = []; }
    });
  }

  loadClients(): void {
    this.apiService.get<any>('clients?per_page=200').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { this.clients = this.extractList(r); },
      error: () => { this.clients = []; }
    });
  }

  loadProductCategories(): void {
    this.apiService.get<any>('product-categories?per_page=200').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { this.productCategories = this.extractList(r); },
      error: () => { this.productCategories = []; }
    });
  }

  loadCurrencyRates(): void {
    this.apiService.get<any>('currencies?is_active=1').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        const rows = this.extractList(r);
        const nextRates: Record<string, number> = { ...this.currencyRates, GNF: 1 };
        rows.forEach((currency: any) => {
          if (currency?.code && Number(currency?.exchange_rate) > 0) {
            nextRates[String(currency.code).toUpperCase()] = Number(currency.exchange_rate);
          }
        });
        this.currencyRates = nextRates;
        this.patchSaleExchangeRate();
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  loadArrivals(): void {
    this.loading = true;
    let url = `container-arrivals?page=${this.arrivalsPage}&per_page=15`;
    if (this.arrivalStatusFilter) url += `&status=${this.arrivalStatusFilter}`;

    this.apiService.get<any>(url).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.arrivals         = r.data.data || [];
          this.arrivalsPage     = r.data.current_page || 1;
          this.arrivalsTotalPages = r.data.last_page || 1;
          this.arrivalsTotal    = r.data.total || 0;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.arrivals = []; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  loadSales(): void {
    let url = `container-sales?page=${this.salesPage}&per_page=15`;
    if (this.saleStatusFilter) url += `&status=${this.saleStatusFilter}`;
    if (this.saleArrivalFilter) url += `&container_arrival_id=${this.saleArrivalFilter}`;

    this.apiService.get<any>(url).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.sales          = r.data.data || [];
          this.salesPage      = r.data.current_page || 1;
          this.salesTotalPages = r.data.last_page || 1;
          this.salesTotal     = r.data.total || 0;
        }
        this.cdr.detectChanges();
      },
      error: () => { this.sales = []; this.cdr.detectChanges(); }
    });
  }

  loadPayments(): void {
    this.apiService.get<any>(`container-sale-payments?page=${this.paymentsPage}&per_page=15`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.payments         = r.data.data || [];
          this.paymentsPage     = r.data.current_page || 1;
          this.paymentsTotalPages = r.data.last_page || 1;
          this.paymentsTotal    = r.data.total || 0;
        }
        this.cdr.detectChanges();
      },
      error: () => { this.payments = []; }
    });
  }

  loadAdvances(): void {
    this.apiService.get<any>(`client-advances?page=${this.advancesPage}&per_page=15`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.advances         = r.data.data || [];
          this.advancesPage     = r.data.current_page || 1;
          this.advancesTotalPages = r.data.last_page || 1;
          this.advancesTotal    = r.data.total || 0;
        }
        this.cdr.detectChanges();
      },
      error: () => { this.advances = []; }
    });
  }

  loadStats(): void {
    this.apiService.get<any>('container-sales/global-stats').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { if (r.success && r.data) { this.stats = r.data; this.cdr.detectChanges(); } },
      error: () => {}
    });
  }

  loadClientBalances(): void {
    this.apiService.get<any>('container-sales/client-balances').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.clientBalances = r?.success ? (r.data?.clients || []) : [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.clientBalances = [];
        this.cdr.detectChanges();
      }
    });
  }

  // ===== ARRIVALS =====

  openNewArrivalModal(): void {
    this.editMode  = false;
    this.submitted = false;
    this.selectedArrival = null;
    this.arrivalForm.reset({
      container_id: null, supplier_id: null, arrival_date: this.today(),
      purchase_price: null, currency: 'GNF', exchange_rate: 1, product_category_id: null, product_type: 'DIVERS',
      total_quantity: null, bale_quantity: null, description: ''
    });
    this.selectedArrivalPhotos = [];
    this.existingArrivalPhotos = [];
    this.showArrivalModal = true;
  }

  openEditArrivalModal(arrival: any): void {
    this.editMode  = true;
    this.submitted = false;
    this.selectedArrival = arrival;
    this.arrivalForm.patchValue({
      container_id:   arrival.container_id,
      supplier_id:    arrival.supplier_id,
      arrival_date:   arrival.arrival_date?.split('T')[0],
      purchase_price: arrival.purchase_price,
      currency:       arrival.currency,
      exchange_rate:  arrival.exchange_rate ?? this.getExchangeRateForCurrency(arrival.currency),
      product_category_id: arrival.product_category_id ?? null,
      product_type:   arrival.product_type,
      total_quantity: arrival.total_quantity,
      bale_quantity:  arrival.bale_quantity ?? arrival.total_quantity,
      description:    arrival.description || ''
    });
    this.selectedArrivalPhotos = [];
    this.loadArrivalPhotos(arrival.id);
    this.showArrivalModal = true;
  }

  openArrivalDetailsModal(arrival: any): void {
    this.selectedArrivalDetails = arrival;
    this.selectedArrivalPhotos = [];
    this.existingArrivalPhotos = [];
    this.loadArrivalPhotos(arrival.id);
    this.showArrivalDetailsModal = true;
  }

  closeArrivalDetailsModal(): void {
    this.showArrivalDetailsModal = false;
    this.selectedArrivalDetails = null;
    this.selectedArrivalPhotos = [];
    this.existingArrivalPhotos = [];
  }

  onArrivalDetailsVisibleChange(visible: boolean): void {
    if (visible) {
      this.showArrivalDetailsModal = true;
      return;
    }

    this.closeArrivalDetailsModal();
  }

  saveArrival(): void {
    this.submitted = true;
    if (this.arrivalForm.invalid) return;

    const obs = this.editMode && this.selectedArrival
      ? this.apiService.put<any>(`container-arrivals/${this.selectedArrival.id}`, this.arrivalForm.value)
      : this.apiService.post<any>('container-arrivals', this.arrivalForm.value);

    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success) {
          const arrivalId = r.data?.id ?? this.selectedArrival?.id;
          const containerId = r.data?.container_id ?? this.arrivalForm.get('container_id')?.value;
          this.uploadArrivalPhotos(arrivalId, containerId);
        }
      },
      error: (err) => Swal.fire({ icon: 'error', title: 'Erreur', text: err.message || 'Erreur lors de la sauvegarde' })
    });
  }

  deleteArrival(arrival: any): void {
    Swal.fire({
      title: 'Supprimer cet arrivage ?', text: 'Les ventes associées seront également supprimées.',
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#d33', cancelButtonColor: '#6c757d',
      confirmButtonText: 'Supprimer', cancelButtonText: 'Annuler'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.apiService.delete<any>(`container-arrivals/${arrival.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', timer: 1500, showConfirmButton: false, title: 'Supprimé' });
          this.loadArrivals(); this.loadStats();
        },
        error: () => Swal.fire({ icon: 'error', title: 'Impossible de supprimer' })
      });
    });
  }

  // ===== SALES =====

  openSaleModal(arrival: any, type: 'TOTAL' | 'PARTIEL' | 'DETAIL'): void {
    this.submitted = false;
    this.selectedArrival  = arrival;
    this.selectedSaleType = type;

    const qtyCtrl = this.saleForm.get('quantity_sold')!;

    // Enable before reset so Angular properly applies the value
    qtyCtrl.enable();

    this.saleForm.reset({
      container_arrival_id: arrival.id,
      client_id: null, sale_type: type,
      quantity_sold: null, sale_price: null,
      currency: arrival.currency || 'GNF',
      exchange_rate: this.getExchangeRateForCurrency(arrival.currency || 'GNF'),
      is_installment: false, installment_count: null,
      sale_date: this.today(), due_date: null, notes: ''
    });

    // Set value explicitly AFTER reset, then disable for TOTAL
    if (type === 'TOTAL') {
      qtyCtrl.setValue(arrival.remaining_quantity);
      qtyCtrl.disable();
    }

    this.showSaleModal = true;
  }

  saveSale(): void {
    this.submitted = true;
    if (this.saleForm.invalid) return;

    const data = this.saleForm.getRawValue();

    // Safeguard: toujours utiliser le stock réel pour une vente totale
    if (data.sale_type === 'TOTAL' && this.selectedArrival) {
      data.quantity_sold = this.selectedArrival.remaining_quantity;
    }

    this.apiService.post<any>('container-sales', data).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ icon: 'success', title: 'Vente enregistrée', timer: 2000, showConfirmButton: false });
          this.showSaleModal = false;
          this.loadSales(); this.loadArrivals(); this.loadStats();
        }
      },
      error: (err) => Swal.fire({ icon: 'error', title: 'Erreur', text: err.message || 'Erreur lors de la vente' })
    });
  }

  filterSalesByArrival(arrivalId: number): void {
    this.saleArrivalFilter = this.saleArrivalFilter === arrivalId ? null : arrivalId;
    this.salesPage = 1;
    this.activeTab = 'sales';
    this.loadSales();
  }

  // ===== PAYMENTS =====

  openPaymentModal(sale: any): void {
    this.submitted   = false;
    this.selectedSale = sale;
    this.paymentForm.reset({
      container_sale_id: sale.id,
      amount:         sale.remaining_amount || null,
      currency:       sale.currency || 'GNF',
      payment_method: 'ESPECES',
      payment_date:   this.today(),
      reference: '', notes: ''
    });
    this.showPaymentModal = true;
  }

  savePayment(): void {
    this.submitted = true;
    if (this.paymentForm.invalid) return;

    this.apiService.post<any>('container-sale-payments', this.paymentForm.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ icon: 'success', title: 'Versement enregistré', timer: 2000, showConfirmButton: false });
          this.showPaymentModal = false;
          this.loadPayments(); this.loadSales(); this.loadStats(); this.loadClientBalances();
        }
      },
      error: (err) => Swal.fire({ icon: 'error', title: 'Erreur', text: err.message || 'Erreur lors du versement' })
    });
  }

  deletePayment(payment: any): void {
    Swal.fire({
      title: 'Supprimer ce versement ?', icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#d33', cancelButtonColor: '#6c757d',
      confirmButtonText: 'Supprimer', cancelButtonText: 'Annuler'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.apiService.delete<any>(`container-sale-payments/${payment.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', timer: 1500, showConfirmButton: false, title: 'Supprimé' });
          this.loadPayments(); this.loadSales(); this.loadStats(); this.loadClientBalances();
        },
        error: () => Swal.fire({ icon: 'error', title: 'Impossible de supprimer' })
      });
    });
  }

  // ===== ADVANCES =====

  openAdvanceModal(): void {
    this.submitted = false;
    this.advanceForm.reset({
      client_id: null, amount: null, currency: 'GNF',
      payment_method: 'ESPECES', payment_date: this.today(),
      reference: '', description: ''
    });
    this.showAdvanceModal = true;
  }

  saveAdvance(): void {
    this.submitted = true;
    if (this.advanceForm.invalid) return;

    this.apiService.post<any>('client-advances', this.advanceForm.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ icon: 'success', title: 'Avance enregistrée', timer: 2000, showConfirmButton: false });
          this.showAdvanceModal = false;
          this.loadAdvances(); this.loadStats(); this.loadClientBalances();
        }
      },
      error: (err) => Swal.fire({ icon: 'error', title: 'Erreur', text: err.message || 'Erreur' })
    });
  }

  openGlobalPaymentModal(clientBalance?: any): void {
    this.submitted = false;
    this.selectedClientBalance = clientBalance || null;
    this.globalPaymentForm.reset({
      client_id: clientBalance?.client_id || null,
      amount: clientBalance?.total_remaining_gnf || null,
      currency: 'GNF',
      exchange_rate: 1,
      payment_method: 'ESPECES',
      payment_date: this.today(),
      reference: '',
      notes: ''
    });
    this.showGlobalPaymentModal = true;
  }

  saveGlobalPayment(): void {
    this.submitted = true;
    if (this.globalPaymentForm.invalid) return;

    this.apiService.post<any>('container-sales/global-payment', this.globalPaymentForm.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ icon: 'success', title: 'Versement global enregistré', timer: 2200, showConfirmButton: false });
          this.showGlobalPaymentModal = false;
          this.loadPayments();
          this.loadSales();
          this.loadAdvances();
          this.loadStats();
          this.loadClientBalances();
        }
      },
      error: (err) => Swal.fire({ icon: 'error', title: 'Erreur', text: err.message || 'Erreur lors du versement global' })
    });
  }

  // ===== NAVIGATION =====

  viewClientAccount(clientId: number): void {
    this.showSaleModal = false;
    this.selectedArrival = null;
    this.selectedSale = null;
    this.submitted = false;
    this.cdr.detectChanges();
    this.router.navigate(['/containers/client-account', clientId]);
  }

  onArrivalPhotosSelected(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files || []);
    this.selectedArrivalPhotos = files;
  }

  loadArrivalPhotos(arrivalId: number): void {
    this.apiService.get<any>(`container-photos?arrival_id=${arrivalId}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        const payload = r.success ? r.data : [];
        this.existingArrivalPhotos = Array.isArray(payload) ? payload : (payload?.data || []);
        this.cdr.detectChanges();
      },
      error: () => {
        this.existingArrivalPhotos = [];
        this.cdr.detectChanges();
      }
    });
  }

  removeArrivalPhoto(photo: any): void {
    this.apiService.delete<any>(`container-photos/${photo.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.existingArrivalPhotos = this.existingArrivalPhotos.filter(item => item.id !== photo.id);
        this.loadArrivals();
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  uploadArrivalPhotos(arrivalId: number | null, containerId: number | null): void {
    if (!arrivalId || !containerId || this.selectedArrivalPhotos.length === 0) {
      this.finishArrivalSave();
      return;
    }

    let done = 0;
    const total = this.selectedArrivalPhotos.length;

    this.selectedArrivalPhotos.forEach((file) => {
      const formData = new FormData();
      formData.append('container_id', String(containerId));
      formData.append('container_arrival_id', String(arrivalId));
      formData.append('image', file);

      this.apiService.post<any>('container-photos', formData).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          done++;
          if (done === total) this.finishArrivalSave();
        },
        error: () => {
          done++;
          if (done === total) this.finishArrivalSave();
        }
      });
    });
  }

  uploadPhotosForSelectedArrival(): void {
    const arrival = this.selectedArrivalDetails;
    if (!arrival?.id || !arrival?.container_id || this.selectedArrivalPhotos.length === 0) {
      Swal.fire({ icon: 'info', title: 'Ajoutez au moins une photo' });
      return;
    }

    this.uploadingArrivalPhotos = true;
    let done = 0;
    const total = this.selectedArrivalPhotos.length;

    this.selectedArrivalPhotos.forEach((file) => {
      const formData = new FormData();
      formData.append('container_id', String(arrival.container_id));
      formData.append('container_arrival_id', String(arrival.id));
      formData.append('image', file);

      this.apiService.post<any>('container-photos', formData).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          done++;
          if (done === total) {
            this.afterArrivalDetailsUpload();
          }
        },
        error: () => {
          done++;
          if (done === total) {
            this.afterArrivalDetailsUpload();
          }
        }
      });
    });
  }

  private afterArrivalDetailsUpload(): void {
    this.uploadingArrivalPhotos = false;
    this.selectedArrivalPhotos = [];
    if (this.selectedArrivalDetails?.id) {
      this.loadArrivalPhotos(this.selectedArrivalDetails.id);
    }
    this.loadArrivals();
    Swal.fire({ icon: 'success', title: 'Photos ajoutées', timer: 1800, showConfirmButton: false });
    this.cdr.detectChanges();
  }

  finishArrivalSave(): void {
    this.selectedArrivalPhotos = [];
    this.existingArrivalPhotos = [];
    Swal.fire({ icon: 'success', title: this.editMode ? 'Arrivage modifié' : 'Arrivage enregistré', timer: 2000, showConfirmButton: false });
    this.showArrivalModal = false;
    this.loadArrivals();
    this.loadStats();
    this.cdr.detectChanges();
  }

  // ===== HELPERS =====

  getContainerNumber(id: number): string {
    return this.containers.find(c => c.id === id)?.container_number || `#${id}`;
  }

  getClientName(id: number): string {
    return this.clients.find(c => c.id === id)?.name || '—';
  }

  getSupplierName(id: number): string {
    return this.suppliers.find(s => s.id === id)?.name || '—';
  }

  getProductTypeLabel(type: string): string {
    return this.productCategories.find(category => category.id === type || category.name === type)?.name || type;
  }

  getPaymentMethodLabel(m: string): string {
    return this.paymentMethods.find(x => x.value === m)?.label || m;
  }

  getClientBalanceStatusLabel(status: string): string {
    return {
      DEBITEUR: 'Débiteur',
      AVANCE: 'En avance',
      SOLDE: 'Soldé'
    }[status] || status;
  }

  getPaymentProgress(sale: any): number {
    if (!sale?.sale_price || sale.sale_price === 0) return 0;
    return Math.min(100, Math.round((sale.amount_paid / sale.sale_price) * 100));
  }

  getProgressColor(pct: number): string {
    if (pct >= 100) return 'success';
    if (pct >= 50) return 'info';
    if (pct > 0) return 'warning';
    return 'danger';
  }

  getStatusColor(status: string): string {
    const m: Record<string, string> = {
      EN_COURS: 'warning', VENDU_PARTIEL: 'info', VENDU_TOTAL: 'success', CLOTURE: 'secondary',
      PAYE_PARTIEL: 'info', PAYE_TOTAL: 'success', ANNULE: 'danger',
      DISPONIBLE: 'success', UTILISE_PARTIEL: 'info', UTILISE_TOTAL: 'secondary'
    };
    return m[status] || 'secondary';
  }

  getStatusLabel(status: string): string {
    const m: Record<string, string> = {
      EN_COURS: 'En cours', VENDU_PARTIEL: 'Partiel vendu', VENDU_TOTAL: 'Vendu total',
      CLOTURE: 'Clôturé', PAYE_PARTIEL: 'Paiement partiel', PAYE_TOTAL: 'Payé total',
      ANNULE: 'Annulé', DISPONIBLE: 'Disponible', UTILISE_PARTIEL: 'Partiel utilisé',
      UTILISE_TOTAL: 'Totalement utilisé'
    };
    return m[status] || status;
  }

  getSaleTypeLabel(type: string): string {
    const m: Record<string, string> = { TOTAL: 'Totale', PARTIEL: 'Partielle', DETAIL: 'Au détail' };
    return m[type] || type;
  }

  getSaleTypeColor(type: string): string {
    const m: Record<string, string> = { TOTAL: 'success', PARTIEL: 'primary', DETAIL: 'info' };
    return m[type] || 'secondary';
  }

  formatAmount(amount: number, currency = 'GNF'): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0 }).format(amount || 0) + ' ' + currency;
  }

  getExchangeRateForCurrency(currency: string | null | undefined): number {
    const code = String(currency || 'GNF').toUpperCase();
    return code === 'GNF' ? 1 : (this.currencyRates[code] || 1);
  }

  get saleEquivalentGnf(): number {
    const amount = Number(this.saleForm.get('sale_price')?.value || 0);
    const currency = String(this.saleForm.get('currency')?.value || 'GNF').toUpperCase();
    const rate = Number(this.saleForm.get('exchange_rate')?.value || 1);
    return currency === 'GNF' ? amount : Math.round(amount * rate);
  }

  get saleRemainingPreview(): number {
    return Number(this.saleForm.get('sale_price')?.value || 0);
  }

  get showSaleExchangeRate(): boolean {
    return String(this.saleForm.get('currency')?.value || 'GNF').toUpperCase() !== 'GNF';
  }

  get arrivalEquivalentGnf(): number {
    const amount = Number(this.arrivalForm.get('purchase_price')?.value || 0);
    const currency = String(this.arrivalForm.get('currency')?.value || 'GNF').toUpperCase();
    const rate = Number(this.arrivalForm.get('exchange_rate')?.value || 1);
    return currency === 'GNF' ? amount : Math.round(amount * rate);
  }

  get showArrivalExchangeRate(): boolean {
    return String(this.arrivalForm.get('currency')?.value || 'GNF').toUpperCase() !== 'GNF';
  }

  get showGlobalPaymentExchangeRate(): boolean {
    return String(this.globalPaymentForm.get('currency')?.value || 'GNF').toUpperCase() !== 'GNF';
  }

  get globalPaymentEquivalentGnf(): number {
    const amount = Number(this.globalPaymentForm.get('amount')?.value || 0);
    const currency = String(this.globalPaymentForm.get('currency')?.value || 'GNF').toUpperCase();
    const rate = Number(this.globalPaymentForm.get('exchange_rate')?.value || 1);
    return currency === 'GNF' ? amount : Math.round(amount * rate);
  }

  getArrivalProductLabel(arrival: any): string {
    return arrival?.product_category?.name || this.getProductTypeLabel(arrival?.product_type);
  }

  getClientTypeLabel(type: string | null | undefined): string {
    const map: Record<string, string> = {
      GENERAL: 'Général',
      PNEUS: 'Pneus',
      TEXTILE: 'Textile',
      COSMETIQUES: 'Cosmétiques',
      CONTAINER_PAGNE: 'Conteneur / Pagne',
    };
    return map[type || ''] || (type || 'Client');
  }

  get selectedClient(): any | null {
    const clientId = this.saleForm.get('client_id')?.value;
    return this.clients.find(client => String(client.id) === String(clientId)) || null;
  }

  getArrivalPhotoUrl(photo: any): string {
    if (!photo) return '';
    if (photo.image_url) return photo.image_url;
    if (!photo.image_path) return '';
    const raw = String(photo.image_path);
    if (raw.startsWith('http')) return raw;
    const clean = raw.replace(/^\/+/, '');
    const path  = clean.startsWith('uploads/') ? clean : `uploads/${clean}`;
    return `${environment.apiUrl.replace(/\/api$/, '')}/${path}`;
  }

  canAddSale(arrival: any): boolean {
    return arrival.remaining_quantity > 0 && !['VENDU_TOTAL', 'CLOTURE'].includes(arrival.status);
  }

  // Pagination
  onArrivalsPageChange(p: number): void { if (p >= 1 && p <= this.arrivalsTotalPages) { this.arrivalsPage = p; this.loadArrivals(); } }
  onSalesPageChange(p: number): void    { if (p >= 1 && p <= this.salesTotalPages)    { this.salesPage = p; this.loadSales(); } }
  onPaymentsPageChange(p: number): void { if (p >= 1 && p <= this.paymentsTotalPages) { this.paymentsPage = p; this.loadPayments(); } }
  onAdvancesPageChange(p: number): void { if (p >= 1 && p <= this.advancesTotalPages) { this.advancesPage = p; this.loadAdvances(); } }
  getPages(total: number): number[] { return Array.from({ length: total }, (_, i) => i + 1); }

  private today(): string { return new Date().toISOString().split('T')[0]; }

  private setupSaleRateWatcher(): void {
    this.saleForm.get('currency')?.valueChanges
      .pipe(startWith(this.saleForm.get('currency')?.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.patchSaleExchangeRate();
      });
  }

  private patchSaleExchangeRate(): void {
    const currency = String(this.saleForm.get('currency')?.value || 'GNF').toUpperCase();
    const rate = this.getExchangeRateForCurrency(currency);
    this.saleForm.get('exchange_rate')?.setValue(rate, { emitEvent: false });
  }

  private setupArrivalRateWatcher(): void {
    this.arrivalForm.get('currency')?.valueChanges
      .pipe(startWith(this.arrivalForm.get('currency')?.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const currency = String(this.arrivalForm.get('currency')?.value || 'GNF').toUpperCase();
        const rate = this.getExchangeRateForCurrency(currency);
        this.arrivalForm.get('exchange_rate')?.setValue(rate, { emitEvent: false });
      });
  }

  private setupGlobalPaymentRateWatcher(): void {
    this.globalPaymentForm.get('currency')?.valueChanges
      .pipe(startWith(this.globalPaymentForm.get('currency')?.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const currency = String(this.globalPaymentForm.get('currency')?.value || 'GNF').toUpperCase();
        const rate = this.getExchangeRateForCurrency(currency);
        this.globalPaymentForm.get('exchange_rate')?.setValue(rate, { emitEvent: false });
      });
  }

  private extractList(r: any): any[] {
    if (!r.success) return [];
    return Array.isArray(r.data) ? r.data : (r.data?.data || []);
  }
  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }

}
