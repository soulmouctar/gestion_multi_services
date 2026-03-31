import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent,
  NavModule, TabsModule, ProgressModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-container-payments',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent,
    NavModule, TabsModule, ProgressModule
  ],
  templateUrl: './container-payments.component.html'
})
export class ContainerPaymentsComponent implements OnInit {
  // Data
  arrivals: any[] = [];
  sales: any[] = [];
  clientPayments: any[] = [];
  advances: any[] = [];
  containers: any[] = [];
  suppliers: any[] = [];
  clients: any[] = [];
  
  // UI State
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  activeTab = 'arrivals';
  
  // Statistics
  stats = {
    totalArrivals: 0,
    totalPurchaseValue: 0,
    totalSalesValue: 0,
    totalCollected: 0,
    totalPending: 0,
    totalClientAdvances: 0,
    estimatedProfit: 0
  };
  
  // Pagination
  arrivalsPage = 1; arrivalsTotalPages = 1; arrivalsTotal = 0;
  salesPage = 1; salesTotalPages = 1; salesTotal = 0;
  paymentsPage = 1; paymentsTotalPages = 1; paymentsTotal = 0;
  advancesPage = 1; advancesTotalPages = 1; advancesTotal = 0;
  
  // Modals
  showArrivalModal = false;
  showSaleModal = false;
  showPaymentModal = false;
  showAdvanceModal = false;
  showClientStatsModal = false;
  
  editMode = false;
  submitted = false;
  
  // Forms
  arrivalForm: FormGroup;
  saleForm: FormGroup;
  paymentForm: FormGroup;
  advanceForm: FormGroup;
  
  selectedArrival: any = null;
  selectedSale: any = null;
  selectedClient: any = null;
  clientStats: any = null;

  productTypes = [
    { value: 'HABITS', label: 'Habits / Vêtements' },
    { value: 'PNEUS', label: 'Pneus' },
    { value: 'ELECTRONIQUE', label: 'Électronique' },
    { value: 'DIVERS', label: 'Divers' },
    { value: 'MIXTE', label: 'Mixte' }
  ];

  saleTypes = [
    { value: 'TOTAL', label: 'Vente Totale' },
    { value: 'PARTIEL', label: 'Vente Partielle' },
    { value: 'DETAIL', label: 'Vente au Détail' }
  ];

  paymentMethods = [
    { value: 'ESPECES', label: 'Espèces' },
    { value: 'VIREMENT', label: 'Virement bancaire' },
    { value: 'CHEQUE', label: 'Chèque' },
    { value: 'ORANGE_MONEY', label: 'Orange Money' },
    { value: 'MOBILE_MONEY', label: 'Mobile Money' }
  ];

  currencies = [
    { value: 'GNF', label: 'GNF (Franc Guinéen)' },
    { value: 'USD', label: 'USD (Dollar Américain)' },
    { value: 'EUR', label: 'EUR (Euro)' }
  ];

  // Exchange rates (USD to GNF)
  exchangeRates: { [key: string]: number } = {
    'GNF': 1,
    'USD': 8600,  // 1 USD = 8600 GNF (à ajuster selon le taux réel)
    'EUR': 9300   // 1 EUR = 9300 GNF (à ajuster selon le taux réel)
  };

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {
    this.arrivalForm = this.fb.group({
      container_id: [null, Validators.required],
      supplier_id: [null],
      arrival_date: [new Date().toISOString().split('T')[0], Validators.required],
      purchase_price: [null, [Validators.required, Validators.min(0)]],
      currency: ['GNF', Validators.required],
      product_type: ['DIVERS', Validators.required],
      total_quantity: [null, [Validators.required, Validators.min(1)]],
      description: ['']
    });

    this.saleForm = this.fb.group({
      container_arrival_id: [null, Validators.required],
      client_id: [null, Validators.required],
      sale_type: ['TOTAL', Validators.required],
      quantity_sold: [null, [Validators.required, Validators.min(1)]],
      sale_price: [null, [Validators.required, Validators.min(0)]],
      currency: ['GNF', Validators.required],
      is_installment: [false],
      installment_count: [null],
      sale_date: [new Date().toISOString().split('T')[0], Validators.required],
      due_date: [null],
      notes: ['']
    });

    this.paymentForm = this.fb.group({
      container_sale_id: [null, Validators.required],
      amount: [null, [Validators.required, Validators.min(0)]],
      currency: ['GNF', Validators.required],
      payment_method: ['ESPECES', Validators.required],
      payment_date: [new Date().toISOString().split('T')[0], Validators.required],
      reference: [''],
      notes: ['']
    });

    this.advanceForm = this.fb.group({
      client_id: [null, Validators.required],
      amount: [null, [Validators.required, Validators.min(0)]],
      currency: ['GNF', Validators.required],
      payment_method: ['ESPECES', Validators.required],
      payment_date: [new Date().toISOString().split('T')[0], Validators.required],
      reference: [''],
      description: ['']
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

  // ==================== LOAD DATA ====================

  loadContainers(): void {
    this.apiService.get<any>('containers-public?per_page=200').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.containers = Array.isArray(r.data) ? r.data : (r.data.data || []);
        }
      },
      error: (err) => console.error('Error loading containers:', err)
    });
  }

  loadSuppliers(): void {
    this.apiService.get<any>('suppliers-public?per_page=200').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.suppliers = Array.isArray(r.data) ? r.data : (r.data.data || []);
        }
      },
      error: (err) => console.error('Error loading suppliers:', err)
    });
  }

  loadClients(): void {
    this.apiService.get<any>('clients-public?per_page=200').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.clients = Array.isArray(r.data) ? r.data : (r.data.data || []);
        }
      },
      error: (err) => console.error('Error loading clients:', err)
    });
  }

  loadArrivals(): void {
    this.loading = true;
    this.apiService.get<any>(`container-arrivals-public?page=${this.arrivalsPage}`).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          const p = r.data;
          this.arrivals = p.data || [];
          this.arrivalsPage = p.current_page || 1;
          this.arrivalsTotalPages = p.last_page || 1;
          this.arrivalsTotal = p.total || 0;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading arrivals:', err);
        this.arrivals = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadSales(): void {
    this.apiService.get<any>(`container-sales-public?page=${this.salesPage}`).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          const p = r.data;
          this.sales = p.data || [];
          this.salesPage = p.current_page || 1;
          this.salesTotalPages = p.last_page || 1;
          this.salesTotal = p.total || 0;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading sales:', err);
        this.sales = [];
      }
    });
  }

  loadPayments(): void {
    this.apiService.get<any>(`container-sale-payments-public?page=${this.paymentsPage}`).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          const p = r.data;
          this.clientPayments = p.data || [];
          this.paymentsPage = p.current_page || 1;
          this.paymentsTotalPages = p.last_page || 1;
          this.paymentsTotal = p.total || 0;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading payments:', err);
        this.clientPayments = [];
      }
    });
  }

  loadAdvances(): void {
    this.apiService.get<any>(`client-advances-public?page=${this.advancesPage}`).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          const p = r.data;
          this.advances = p.data || [];
          this.advancesPage = p.current_page || 1;
          this.advancesTotalPages = p.last_page || 1;
          this.advancesTotal = p.total || 0;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading advances:', err);
        this.advances = [];
      }
    });
  }

  loadStats(): void {
    this.apiService.get<any>('container-sales-public/global-stats').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.stats = r.data;
        }
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error loading stats:', err)
    });
  }

  // ==================== TAB CHANGE ====================

  onTabChange(tab: string): void {
    this.activeTab = tab;
  }

  // ==================== ARRIVALS ====================

  openArrivalModal(arrival?: any): void {
    this.editMode = !!arrival;
    this.submitted = false;
    this.selectedArrival = arrival || null;
    
    if (arrival) {
      this.arrivalForm.patchValue({
        container_id: arrival.container_id,
        supplier_id: arrival.supplier_id,
        arrival_date: arrival.arrival_date?.split('T')[0],
        purchase_price: arrival.purchase_price,
        currency: arrival.currency,
        product_type: arrival.product_type,
        total_quantity: arrival.total_quantity,
        description: arrival.description || ''
      });
    } else {
      this.arrivalForm.reset({
        container_id: null,
        supplier_id: null,
        arrival_date: new Date().toISOString().split('T')[0],
        purchase_price: null,
        currency: 'GNF',
        product_type: 'DIVERS',
        total_quantity: null,
        description: ''
      });
    }
    this.showArrivalModal = true;
  }

  saveArrival(): void {
    this.submitted = true;
    if (this.arrivalForm.invalid) return;

    const data = { ...this.arrivalForm.value, tenant_id: 1 };
    
    const obs = this.editMode && this.selectedArrival
      ? this.apiService.put<any>(`container-arrivals-public/${this.selectedArrival.id}`, data)
      : this.apiService.post<any>('container-arrivals-public', data);

    obs.subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ title: 'Succès', text: this.editMode ? 'Arrivage modifié' : 'Arrivage enregistré', icon: 'success', timer: 2000, showConfirmButton: false });
          this.showArrivalModal = false;
          this.loadArrivals();
          this.loadStats();
        }
      },
      error: (err) => {
        Swal.fire({ title: 'Erreur', text: err?.error?.message || 'Erreur lors de la sauvegarde', icon: 'error' });
      }
    });
  }

  deleteArrival(arrival: any): void {
    Swal.fire({
      title: 'Confirmer la suppression',
      text: 'Supprimer cet arrivage ?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler'
    }).then((result) => {
      if (result.isConfirmed) {
        this.apiService.delete<any>(`container-arrivals-public/${arrival.id}`).subscribe({
          next: () => {
            Swal.fire({ title: 'Supprimé', icon: 'success', timer: 1500, showConfirmButton: false });
            this.loadArrivals();
            this.loadStats();
          },
          error: () => Swal.fire({ title: 'Erreur', text: 'Impossible de supprimer', icon: 'error' })
        });
      }
    });
  }

  // ==================== SALES ====================

  openSaleModal(arrival: any): void {
    this.submitted = false;
    this.selectedArrival = arrival;
    this.saleForm.reset({
      container_arrival_id: arrival.id,
      client_id: null,
      sale_type: 'TOTAL',
      quantity_sold: arrival.remaining_quantity,
      sale_price: null,
      currency: 'GNF',
      is_installment: false,
      installment_count: null,
      sale_date: new Date().toISOString().split('T')[0],
      due_date: null,
      notes: ''
    });
    this.showSaleModal = true;
  }

  saveSale(): void {
    this.submitted = true;
    if (this.saleForm.invalid) return;

    const data = { ...this.saleForm.value, tenant_id: 1 };

    this.apiService.post<any>('container-sales-public', data).subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ title: 'Succès', text: 'Vente enregistrée', icon: 'success', timer: 2000, showConfirmButton: false });
          this.showSaleModal = false;
          this.loadSales();
          this.loadArrivals();
          this.loadStats();
        }
      },
      error: (err) => {
        Swal.fire({ title: 'Erreur', text: err?.error?.message || 'Erreur lors de la vente', icon: 'error' });
      }
    });
  }

  // ==================== PAYMENTS ====================

  openPaymentModal(sale: any): void {
    this.submitted = false;
    this.selectedSale = sale;
    this.paymentForm.reset({
      container_sale_id: sale.id,
      amount: sale.remaining_amount,
      currency: sale.currency || 'GNF',
      payment_method: 'ESPECES',
      payment_date: new Date().toISOString().split('T')[0],
      reference: '',
      notes: ''
    });
    this.showPaymentModal = true;
  }

  savePayment(): void {
    this.submitted = true;
    if (this.paymentForm.invalid) return;

    const data = { ...this.paymentForm.value, tenant_id: 1 };

    this.apiService.post<any>('container-sale-payments-public', data).subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ title: 'Succès', text: 'Versement enregistré', icon: 'success', timer: 2000, showConfirmButton: false });
          this.showPaymentModal = false;
          this.loadPayments();
          this.loadSales();
          this.loadStats();
        }
      },
      error: (err) => {
        Swal.fire({ title: 'Erreur', text: err?.error?.message || 'Erreur lors du versement', icon: 'error' });
      }
    });
  }

  // ==================== ADVANCES ====================

  openAdvanceModal(): void {
    this.submitted = false;
    this.advanceForm.reset({
      client_id: null,
      amount: null,
      currency: 'GNF',
      payment_method: 'ESPECES',
      payment_date: new Date().toISOString().split('T')[0],
      reference: '',
      description: ''
    });
    this.showAdvanceModal = true;
  }

  saveAdvance(): void {
    this.submitted = true;
    if (this.advanceForm.invalid) return;

    const data = { ...this.advanceForm.value, tenant_id: 1 };

    this.apiService.post<any>('client-advances-public', data).subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ title: 'Succès', text: 'Avance enregistrée', icon: 'success', timer: 2000, showConfirmButton: false });
          this.showAdvanceModal = false;
          this.loadAdvances();
          this.loadStats();
        }
      },
      error: (err) => {
        Swal.fire({ title: 'Erreur', text: err?.error?.message || 'Erreur lors de l\'enregistrement', icon: 'error' });
      }
    });
  }

  // ==================== CLIENT STATS ====================

  viewClientStats(client: any): void {
    this.selectedClient = client;
    this.apiService.get<any>(`container-sales-public/client-stats/${client.id}`).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.clientStats = r.data;
          this.showClientStatsModal = true;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        Swal.fire({ title: 'Erreur', text: 'Impossible de charger les statistiques', icon: 'error' });
      }
    });
  }

  viewClientAccountPage(): void {
    if (this.selectedClient) {
      this.router.navigate(['/containers/client-account', this.selectedClient.id]);
    }
  }

  // ==================== HELPERS ====================

  getContainerNumber(id: number): string {
    const c = this.containers.find(x => x.id === id);
    return c ? c.container_number : `#${id}`;
  }

  getSupplierName(id: number): string {
    const s = this.suppliers.find(x => x.id === id);
    return s ? s.name : '-';
  }

  getClientName(id: number): string {
    const c = this.clients.find(x => x.id === id);
    return c ? c.name : '-';
  }

  getProductTypeLabel(type: string): string {
    const t = this.productTypes.find(x => x.value === type);
    return t ? t.label : type;
  }

  getSaleTypeLabel(type: string): string {
    const t = this.saleTypes.find(x => x.value === type);
    return t ? t.label : type;
  }

  getPaymentMethodLabel(method: string): string {
    const m = this.paymentMethods.find(x => x.value === method);
    return m ? m.label : method;
  }

  formatAmount(amount: number, currency: string = 'GNF'): string {
    return new Intl.NumberFormat('fr-GN', { style: 'decimal', minimumFractionDigits: 0 }).format(amount || 0) + ' ' + currency;
  }

  // Convert any currency to GNF
  convertToGNF(amount: number, fromCurrency: string): number {
    if (fromCurrency === 'GNF') return amount;
    const rate = this.exchangeRates[fromCurrency] || 1;
    return amount * rate;
  }

  // Convert GNF to any currency
  convertFromGNF(amount: number, toCurrency: string): number {
    if (toCurrency === 'GNF') return amount;
    const rate = this.exchangeRates[toCurrency] || 1;
    return amount / rate;
  }

  // Format amount with conversion info
  formatAmountWithConversion(amount: number, currency: string): string {
    if (currency === 'GNF') {
      return this.formatAmount(amount, currency);
    }
    const gnfAmount = this.convertToGNF(amount, currency);
    return `${this.formatAmount(amount, currency)} (≈ ${this.formatAmount(gnfAmount, 'GNF')})`;
  }

  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'EN_COURS': 'warning',
      'VENDU_PARTIEL': 'info',
      'VENDU_TOTAL': 'success',
      'CLOTURE': 'secondary',
      'PAYE_PARTIEL': 'info',
      'PAYE_TOTAL': 'success',
      'ANNULE': 'danger',
      'DISPONIBLE': 'success',
      'UTILISE_PARTIEL': 'info',
      'UTILISE_TOTAL': 'secondary'
    };
    return colors[status] || 'secondary';
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'EN_COURS': 'En cours',
      'VENDU_PARTIEL': 'Vendu partiel',
      'VENDU_TOTAL': 'Vendu total',
      'CLOTURE': 'Clôturé',
      'PAYE_PARTIEL': 'Payé partiel',
      'PAYE_TOTAL': 'Payé total',
      'ANNULE': 'Annulé',
      'DISPONIBLE': 'Disponible',
      'UTILISE_PARTIEL': 'Utilisé partiel',
      'UTILISE_TOTAL': 'Utilisé total'
    };
    return labels[status] || status;
  }

  getPaymentProgress(sale: any): number {
    if (!sale.sale_price || sale.sale_price === 0) return 0;
    return Math.round((sale.amount_paid / sale.sale_price) * 100);
  }

  // Pagination
  onArrivalsPageChange(page: number): void {
    if (page < 1 || page > this.arrivalsTotalPages) return;
    this.arrivalsPage = page;
    this.loadArrivals();
  }

  onSalesPageChange(page: number): void {
    if (page < 1 || page > this.salesTotalPages) return;
    this.salesPage = page;
    this.loadSales();
  }

  onPaymentsPageChange(page: number): void {
    if (page < 1 || page > this.paymentsTotalPages) return;
    this.paymentsPage = page;
    this.loadPayments();
  }

  onAdvancesPageChange(page: number): void {
    if (page < 1 || page > this.advancesTotalPages) return;
    this.advancesPage = page;
    this.loadAdvances();
  }

  getPages(totalPages: number): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }
}
