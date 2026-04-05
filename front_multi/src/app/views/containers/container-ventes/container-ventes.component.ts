import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ButtonModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule, ProgressModule, NavModule, TabsModule,
  RowComponent, ColComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-container-ventes',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, ProgressModule, NavModule, TabsModule,
    RowComponent, ColComponent
  ],
  templateUrl: './container-ventes.component.html'
})
export class ContainerVentesComponent implements OnInit {

  // ===== DATA =====
  arrivals: any[] = [];
  sales: any[] = [];
  payments: any[] = [];
  advances: any[] = [];
  containers: any[] = [];
  suppliers: any[] = [];
  clients: any[] = [];

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
  showSaleModal = false;
  showPaymentModal = false;
  showAdvanceModal = false;

  // ===== SELECTED =====
  selectedArrival: any = null;
  selectedSale: any = null;
  selectedSaleType: 'TOTAL' | 'PARTIEL' | 'DETAIL' = 'TOTAL';

  // ===== FORMS =====
  arrivalForm: FormGroup;
  saleForm: FormGroup;
  paymentForm: FormGroup;
  advanceForm: FormGroup;

  // ===== CONSTANTS =====
  productTypes = [
    { value: 'HABITS',      label: 'Habits / Vêtements' },
    { value: 'PNEUS',       label: 'Pneus' },
    { value: 'ELECTRONIQUE',label: 'Électronique' },
    { value: 'DIVERS',      label: 'Divers' },
    { value: 'MIXTE',       label: 'Mixte' }
  ];

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
      product_type:   ['DIVERS', Validators.required],
      total_quantity: [null, [Validators.required, Validators.min(1)]],
      description:    ['']
    });

    this.saleForm = this.fb.group({
      container_arrival_id: [null, Validators.required],
      client_id:            [null, Validators.required],
      sale_type:            ['TOTAL', Validators.required],
      quantity_sold:        [null, [Validators.required, Validators.min(1)]],
      sale_price:           [null, [Validators.required, Validators.min(0)]],
      currency:             ['GNF', Validators.required],
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
    this.loadClients();
    this.loadArrivals();
    this.loadSales();
    this.loadPayments();
    this.loadAdvances();
    this.loadStats();
  }

  // ===== LOAD DATA =====

  loadContainers(): void {
    this.apiService.get<any>('containers?per_page=200').subscribe({
      next: (r) => { this.containers = this.extractList(r); },
      error: () => { this.containers = []; }
    });
  }

  loadSuppliers(): void {
    this.apiService.get<any>('suppliers?per_page=200').subscribe({
      next: (r) => { this.suppliers = this.extractList(r); },
      error: () => { this.suppliers = []; }
    });
  }

  loadClients(): void {
    this.apiService.get<any>('clients?per_page=200').subscribe({
      next: (r) => { this.clients = this.extractList(r); },
      error: () => { this.clients = []; }
    });
  }

  loadArrivals(): void {
    this.loading = true;
    let url = `container-arrivals?page=${this.arrivalsPage}&per_page=15`;
    if (this.arrivalStatusFilter) url += `&status=${this.arrivalStatusFilter}`;

    this.apiService.get<any>(url).subscribe({
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

    this.apiService.get<any>(url).subscribe({
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
    this.apiService.get<any>(`container-sale-payments?page=${this.paymentsPage}&per_page=15`).subscribe({
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
    this.apiService.get<any>(`client-advances?page=${this.advancesPage}&per_page=15`).subscribe({
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
    this.apiService.get<any>('container-sales/global-stats').subscribe({
      next: (r) => { if (r.success && r.data) { this.stats = r.data; this.cdr.detectChanges(); } },
      error: () => {}
    });
  }

  // ===== ARRIVALS =====

  openNewArrivalModal(): void {
    this.editMode  = false;
    this.submitted = false;
    this.selectedArrival = null;
    this.arrivalForm.reset({
      container_id: null, supplier_id: null, arrival_date: this.today(),
      purchase_price: null, currency: 'GNF', product_type: 'DIVERS',
      total_quantity: null, description: ''
    });
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
      product_type:   arrival.product_type,
      total_quantity: arrival.total_quantity,
      description:    arrival.description || ''
    });
    this.showArrivalModal = true;
  }

  saveArrival(): void {
    this.submitted = true;
    if (this.arrivalForm.invalid) return;

    const obs = this.editMode && this.selectedArrival
      ? this.apiService.put<any>(`container-arrivals/${this.selectedArrival.id}`, this.arrivalForm.value)
      : this.apiService.post<any>('container-arrivals', this.arrivalForm.value);

    obs.subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ icon: 'success', title: this.editMode ? 'Arrivage modifié' : 'Arrivage enregistré', timer: 2000, showConfirmButton: false });
          this.showArrivalModal = false;
          this.loadArrivals();
          this.loadStats();
        }
      },
      error: (err) => Swal.fire({ icon: 'error', title: 'Erreur', text: err?.error?.message || 'Erreur lors de la sauvegarde' })
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
      this.apiService.delete<any>(`container-arrivals/${arrival.id}`).subscribe({
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

    this.apiService.post<any>('container-sales', data).subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ icon: 'success', title: 'Vente enregistrée', timer: 2000, showConfirmButton: false });
          this.showSaleModal = false;
          this.loadSales(); this.loadArrivals(); this.loadStats();
        }
      },
      error: (err) => Swal.fire({ icon: 'error', title: 'Erreur', text: err?.error?.message || 'Erreur lors de la vente' })
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

    this.apiService.post<any>('container-sale-payments', this.paymentForm.value).subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ icon: 'success', title: 'Versement enregistré', timer: 2000, showConfirmButton: false });
          this.showPaymentModal = false;
          this.loadPayments(); this.loadSales(); this.loadStats();
        }
      },
      error: (err) => Swal.fire({ icon: 'error', title: 'Erreur', text: err?.error?.message || 'Erreur lors du versement' })
    });
  }

  deletePayment(payment: any): void {
    Swal.fire({
      title: 'Supprimer ce versement ?', icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#d33', cancelButtonColor: '#6c757d',
      confirmButtonText: 'Supprimer', cancelButtonText: 'Annuler'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.apiService.delete<any>(`container-sale-payments/${payment.id}`).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', timer: 1500, showConfirmButton: false, title: 'Supprimé' });
          this.loadPayments(); this.loadSales(); this.loadStats();
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

    this.apiService.post<any>('client-advances', this.advanceForm.value).subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ icon: 'success', title: 'Avance enregistrée', timer: 2000, showConfirmButton: false });
          this.showAdvanceModal = false;
          this.loadAdvances(); this.loadStats();
        }
      },
      error: (err) => Swal.fire({ icon: 'error', title: 'Erreur', text: err?.error?.message || 'Erreur' })
    });
  }

  // ===== NAVIGATION =====

  viewClientAccount(clientId: number): void {
    this.router.navigate(['/containers/client-account', clientId]);
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
    return this.productTypes.find(t => t.value === type)?.label || type;
  }

  getPaymentMethodLabel(m: string): string {
    return this.paymentMethods.find(x => x.value === m)?.label || m;
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

  private extractList(r: any): any[] {
    if (!r.success) return [];
    return Array.isArray(r.data) ? r.data : (r.data?.data || []);
  }
}
