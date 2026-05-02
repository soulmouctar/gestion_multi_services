import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  ButtonModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule,
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

import { PaymentService, Payment, PaymentFilters, PaymentReceipt, ClientBalance } from '../../../core/services/payment.service';
import { AlertService } from '../../../core/services/alert.service';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-payments-list',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule,
  ],
  templateUrl: './payments-list.component.html',
  styleUrls: ['./payments-list.component.scss'],
})
export class PaymentsListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  payments: Payment[] = [];
  clients: any[] = [];
  invoices: any[] = [];
  currencies: any[] = [];
  loading = false;
  error: string | null = null;

  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  itemsPerPage = 15;

  filterForm: FormGroup;
  filters: PaymentFilters = {};

  selectedPayments: Set<number> = new Set();
  selectAll = false;

  showPaymentModal = false;
  editingPayment: Payment | null = null;
  paymentForm: FormGroup;
  savingPayment = false;
  selectedClientBalance: ClientBalance | null = null;
  loadingSelectedClientBalance = false;

  showReceiptModal = false;
  receiptLoading = false;
  currentReceipt: PaymentReceipt | null = null;

  showBalanceModal = false;
  balanceLoading = false;
  clientBalance: ClientBalance | null = null;

  Math = Math;

  constructor(
    private paymentService: PaymentService,
    private alertService: AlertService,
    private apiService: ApiService,
    private fb: FormBuilder,
  ) {
    this.filterForm = this.fb.group({
      search: [''],
      type: [''],
      method: [''],
      status: [''],
      date_from: [''],
      date_to: [''],
    });

    this.paymentForm = this.fb.group({
      type: ['CLIENT', Validators.required],
      client_id: [null],
      invoice_id: [null],
      method: ['ESPECES', Validators.required],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      currency: ['GNF', Validators.required],
      exchange_rate: [{ value: 1, disabled: true }],
      amount_gnf: [{ value: null, disabled: true }],
      payment_date: ['', Validators.required],
      reference: [''],
      description: [''],
      status: ['COMPLETED'],
    });

    this.paymentForm.get('currency')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((currency) => this.onCurrencyChanged(currency));

    this.paymentForm.get('amount')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncAmountGnf());

    this.paymentForm.get('exchange_rate')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncAmountGnf());

    this.paymentForm.get('client_id')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((clientId) => this.onClientChanged(clientId));
  }

  ngOnInit(): void {
    this.loadPayments();
    this.loadClients();
    this.loadCurrencies();
  }

  loadPayments(): void {
    this.loading = true;
    this.error = null;

    this.paymentService.getPayments({
      page: this.currentPage,
      per_page: this.itemsPerPage,
      ...this.filters,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.data) {
          this.payments = (res.data as any).data ?? [];
          this.totalItems = (res.data as any).total ?? 0;
          this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        }
        this.loading = false;
      },
      error: () => {
        this.error = 'Erreur lors du chargement des paiements';
        this.loading = false;
      },
    });
  }

  loadClients(): void {
    this.apiService.get<any>('clients?per_page=500').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.clients = res.success ? (res.data?.data || res.data || []) : [];
      },
      error: () => {
        this.clients = [];
      }
    });
  }

  loadCurrencies(): void {
    this.apiService.get<any>('currencies?per_page=100').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        const list = res.success ? (res.data?.data || res.data || []) : [];
        this.currencies = list.filter((item: any) => item.is_active);
      },
      error: () => {
        this.currencies = [];
      }
    });
  }

  loadInvoices(clientId: number | null): void {
    if (!clientId) {
      this.invoices = [];
      this.paymentForm.get('invoice_id')?.setValue(null, { emitEvent: false });
      return;
    }

    this.apiService.get<any>(`invoices?per_page=200&client_id=${clientId}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        const list = res.success ? (res.data?.data || []) : [];
        this.invoices = list.filter((invoice: any) => invoice.status !== 'PAYE');
      },
      error: () => {
        this.invoices = [];
      }
    });
  }

  applyFilters(): void {
    const raw = this.filterForm.value;
    this.filters = Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v !== '' && v !== null)
    ) as PaymentFilters;
    this.currentPage = 1;
    this.loadPayments();
  }

  resetFilters(): void {
    this.filterForm.reset({ search: '', type: '', method: '', status: '', date_from: '', date_to: '' });
    this.filters = {};
    this.currentPage = 1;
    this.loadPayments();
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadPayments();
  }

  toggleSelectAll(): void {
    if (this.selectAll) {
      this.selectedPayments.clear();
    } else {
      this.payments.forEach((payment) => this.selectedPayments.add(payment.id));
    }
    this.selectAll = !this.selectAll;
  }

  toggleSelection(id: number): void {
    this.selectedPayments.has(id) ? this.selectedPayments.delete(id) : this.selectedPayments.add(id);
    this.selectAll = this.selectedPayments.size === this.payments.length;
  }

  isSelected(id: number): boolean {
    return this.selectedPayments.has(id);
  }

  deleteSelected(): void {
    if (!this.selectedPayments.size) return;
    this.alertService.showConfirmation(
      'Supprimer les paiements',
      `Confirmer la suppression de ${this.selectedPayments.size} paiement(s) ?`,
      'Oui, supprimer'
    ).then(result => {
      if (!result.isConfirmed) return;
      this.paymentService.bulkDelete(Array.from(this.selectedPayments))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.alertService.showSuccess('Suppression effectuée');
            this.selectedPayments.clear();
            this.selectAll = false;
            this.loadPayments();
          },
          error: () => this.alertService.showError('Erreur', 'Erreur lors de la suppression'),
        });
    });
  }

  openCreateModal(): void {
    this.editingPayment = null;
    this.selectedClientBalance = null;
    this.invoices = [];
    this.paymentForm.reset({
      type: 'CLIENT',
      client_id: null,
      invoice_id: null,
      method: 'ESPECES',
      amount: null,
      currency: 'GNF',
      exchange_rate: 1,
      amount_gnf: null,
      status: 'COMPLETED',
      payment_date: new Date().toISOString().split('T')[0],
      reference: '',
      description: '',
    });
    this.onCurrencyChanged('GNF');
    this.showPaymentModal = true;
  }

  openEditModal(payment: Payment): void {
    this.editingPayment = payment;
    this.paymentForm.patchValue({
      type: payment.type,
      client_id: payment.client_id ?? null,
      invoice_id: payment.invoice_id ?? null,
      method: payment.method,
      amount: payment.amount,
      currency: payment.currency,
      exchange_rate: payment.exchange_rate ?? 1,
      amount_gnf: payment.amount_gnf ?? payment.amount,
      payment_date: payment.payment_date,
      reference: payment.reference ?? '',
      description: payment.description ?? '',
      status: payment.status,
    }, { emitEvent: false });
    this.onCurrencyChanged(payment.currency);
    this.loadInvoices(payment.client_id ?? null);
    if (payment.client_id) {
      this.fetchSelectedClientBalance(payment.client_id);
    } else {
      this.selectedClientBalance = null;
    }
    this.syncAmountGnf();
    this.showPaymentModal = true;
  }

  savePayment(): void {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const raw = this.paymentForm.getRawValue();
    if (raw.type === 'CLIENT' && !raw.client_id) {
      this.alertService.showError('Client requis', 'Sélectionnez le client concerné par ce versement.');
      return;
    }

    this.savingPayment = true;
    const payload = {
      ...raw,
      exchange_rate: raw.currency === 'GNF' ? 1 : raw.exchange_rate,
      amount_gnf: raw.currency === 'GNF' ? raw.amount : raw.amount_gnf,
      invoice_id: raw.invoice_id || null,
      client_id: raw.client_id || null,
    };

    const obs = this.editingPayment
      ? this.paymentService.updatePayment(this.editingPayment.id, payload)
      : this.paymentService.createPayment(payload);

    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.alertService.showSuccess(this.editingPayment ? 'Paiement modifié' : 'Paiement enregistré');
        this.showPaymentModal = false;
        this.savingPayment = false;
        this.loadPayments();
      },
      error: (err: Error) => {
        this.alertService.showError('Erreur', err.message ?? 'Erreur lors de l\'enregistrement');
        this.savingPayment = false;
      },
    });
  }

  deletePayment(payment: Payment): void {
    this.alertService.showDeleteConfirmation(
      payment.receipt_number ?? `#${payment.id}`,
      'paiement'
    ).then(result => {
      if (!result.isConfirmed) return;
      this.paymentService.deletePayment(payment.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => { this.alertService.showSuccess('Paiement supprimé'); this.loadPayments(); },
        error: () => this.alertService.showError('Erreur', 'Erreur lors de la suppression'),
      });
    });
  }

  viewReceipt(payment: Payment): void {
    this.receiptLoading = true;
    this.currentReceipt = null;
    this.showReceiptModal = true;

    this.paymentService.getReceipt(payment.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => { this.currentReceipt = res.data as any; this.receiptLoading = false; },
      error: () => {
        this.receiptLoading = false;
        this.showReceiptModal = false;
        this.alertService.showError('Erreur', 'Impossible de charger le reçu');
      },
    });
  }

  printReceipt(): void {
    window.print();
  }

  viewClientBalance(payment: Payment): void {
    if (!payment.client_id) return;
    this.balanceLoading = true;
    this.clientBalance = null;
    this.showBalanceModal = true;

    this.paymentService.getClientBalance(payment.client_id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => { this.clientBalance = res.data as any; this.balanceLoading = false; },
      error: () => {
        this.balanceLoading = false;
        this.showBalanceModal = false;
        this.alertService.showError('Erreur', 'Impossible de charger le solde client');
      },
    });
  }

  getTypeLabel(type: string): string { return this.paymentService.getTypeLabel(type as any); }
  getMethodLabel(method: string): string { return this.paymentService.getMethodLabel(method as any); }
  getStatusLabel(status: string): string { return this.paymentService.getStatusLabel(status as any); }
  isIncoming(type: string): boolean { return this.paymentService.isIncoming(type as any); }

  getStatusBadgeColor(status: string): string {
    return ({ COMPLETED: '#10B981', PENDING: '#F59E0B', FAILED: '#EF4444', CANCELLED: '#6B7280' } as any)[status] ?? '#6B7280';
  }

  getInvoiceStatusLabel(status: string): string {
    return ({ PAYE: 'Payée', PARTIEL: 'Partielle', IMPAYE: 'Impayée' } as any)[status] ?? status;
  }

  getInvoiceStatusColor(status: string): string {
    return ({ PAYE: '#10B981', PARTIEL: '#F59E0B', IMPAYE: '#EF4444' } as any)[status] ?? '#6B7280';
  }

  exportPayments(): void {
    this.paymentService.exportPayments('csv', this.filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `paiements_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.alertService.showError('Erreur', 'Erreur lors de l\'export'),
    });
  }

  getPages(): number[] {
    const start = Math.max(1, this.currentPage - 4);
    const end = Math.min(this.totalPages, start + 9);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  getClientName(clientId: number | null): string {
    if (!clientId) return '—';
    return this.clients.find((client) => client.id === clientId)?.name || `#${clientId}`;
  }

  getInvoiceLabel(invoiceId: number | null): string {
    if (!invoiceId) return 'Versement au compte client';
    return this.invoices.find((invoice) => invoice.id === invoiceId)?.invoice_number || `#${invoiceId}`;
  }

  get selectedCurrencyCode(): string {
    return this.paymentForm.get('currency')?.value || 'GNF';
  }

  get amountGnfPreview(): number {
    return Number(this.paymentForm.getRawValue().amount_gnf || 0);
  }

  trackById(_: number, item: any): any { return item?.id ?? _; }

  private onClientChanged(clientId: number | null): void {
    this.loadInvoices(clientId);
    if (!clientId) {
      this.selectedClientBalance = null;
      return;
    }
    this.fetchSelectedClientBalance(clientId);
  }

  private onCurrencyChanged(currency: string): void {
    const exchangeCtrl = this.paymentForm.get('exchange_rate');
    const amountGnfCtrl = this.paymentForm.get('amount_gnf');
    if (!exchangeCtrl || !amountGnfCtrl) return;

    if (!currency || currency === 'GNF') {
      exchangeCtrl.setValue(1, { emitEvent: false });
      exchangeCtrl.disable({ emitEvent: false });
      amountGnfCtrl.disable({ emitEvent: false });
    } else {
      const found = this.currencies.find((item: any) => item.code === currency);
      exchangeCtrl.setValue(found?.exchange_rate || exchangeCtrl.value || 1, { emitEvent: false });
      exchangeCtrl.enable({ emitEvent: false });
      amountGnfCtrl.enable({ emitEvent: false });
    }

    this.syncAmountGnf();
  }

  private syncAmountGnf(): void {
    const currency = this.paymentForm.get('currency')?.value || 'GNF';
    const amount = Number(this.paymentForm.get('amount')?.value || 0);
    const exchangeRate = Number(this.paymentForm.getRawValue().exchange_rate || 1);
    const amountGnfCtrl = this.paymentForm.get('amount_gnf');
    if (!amountGnfCtrl) return;

    const computed = currency === 'GNF' ? amount : amount * exchangeRate;
    amountGnfCtrl.setValue(computed ? Math.round(computed * 100) / 100 : null, { emitEvent: false });
  }

  private fetchSelectedClientBalance(clientId: number): void {
    this.loadingSelectedClientBalance = true;
    this.paymentService.getClientBalance(clientId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.selectedClientBalance = res.data as any;
        this.loadingSelectedClientBalance = false;
      },
      error: () => {
        this.selectedClientBalance = null;
        this.loadingSelectedClientBalance = false;
      }
    });
  }
}
