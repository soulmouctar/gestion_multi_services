import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  ButtonModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule, ProgressModule, NavModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-leases',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, ProgressModule, NavModule
  ],
  templateUrl: './leases.component.html'
})
export class LeasesComponent implements OnInit {

  // ===== DATA =====
  leases: any[] = [];
  payments: any[] = [];
  housingUnits: any[] = [];
  selectedLeasePayments: any[] = [];

  stats: any = {
    total_leases: 0, active_leases: 0,
    monthly_rent_total: 0, collected_this_month: 0,
    expected_this_month: 0, pending_leases: 0, total_deposits: 0
  };

  // ===== UI =====
  loading = false;
  activeTab = 'leases';
  submitted = false;
  editMode = false;

  // ===== PAGINATION =====
  leasesPage = 1;  leasesTotalPages = 1;  leasesTotal = 0;
  paymentsPage = 1; paymentsTotalPages = 1; paymentsTotal = 0;

  // ===== FILTERS =====
  leaseStatusFilter = '';
  paymentMonthFilter = '';

  // ===== MODALS =====
  showLeaseModal = false;
  showPaymentModal = false;
  showLeasePaymentsModal = false;

  // ===== SELECTED =====
  selectedLease: any = null;

  // ===== FORMS =====
  leaseForm: FormGroup;
  paymentForm: FormGroup;

  // ===== CONSTANTS =====
  leaseStatuses = [
    { value: '',           label: 'Tous' },
    { value: 'ACTIVE',     label: 'Actif' },
    { value: 'PENDING',    label: 'En attente' },
    { value: 'EXPIRED',    label: 'Expiré' },
    { value: 'TERMINATED', label: 'Résilié' }
  ];

  paymentMethods = [
    { value: 'ESPECES',      label: 'Espèces' },
    { value: 'VIREMENT',     label: 'Virement bancaire' },
    { value: 'CHEQUE',       label: 'Chèque' },
    { value: 'ORANGE_MONEY', label: 'Orange Money' },
    { value: 'MOBILE_MONEY', label: 'Mobile Money' }
  ];

  currencies = [
    { value: 'GNF', label: 'GNF' },
    { value: 'USD', label: 'USD' },
    { value: 'EUR', label: 'EUR' }
  ];

  paymentStatuses = [
    { value: 'PAID',    label: 'Payé' },
    { value: 'LATE',    label: 'En retard' },
    { value: 'PENDING', label: 'En attente' }
  ];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {
    this.leaseForm = this.fb.group({
      housing_unit_id: [null, Validators.required],
      renter_name:     ['', [Validators.required, Validators.maxLength(150)]],
      renter_phone:    [''],
      renter_email:    ['', Validators.email],
      start_date:      [this.today(), Validators.required],
      end_date:        [null],
      monthly_rent:    [null, [Validators.required, Validators.min(0)]],
      deposit_amount:  [0],
      currency:        ['GNF', Validators.required],
      payment_day:     [1, [Validators.min(1), Validators.max(28)]],
      status:          ['ACTIVE', Validators.required],
      notes:           ['']
    });

    this.paymentForm = this.fb.group({
      period_month:   [this.currentMonth(), Validators.required],
      amount:         [null, [Validators.required, Validators.min(0)]],
      currency:       ['GNF', Validators.required],
      payment_date:   [this.today(), Validators.required],
      payment_method: ['ESPECES', Validators.required],
      reference:      [''],
      status:         ['PAID', Validators.required],
      notes:          ['']
    });
  }

  ngOnInit(): void {
    this.loadHousingUnits();
    this.loadLeases();
    this.loadAllPayments();
    this.loadStats();
  }

  // ===== LOAD DATA =====

  loadHousingUnits(): void {
    this.apiService.get<any>('housing-units?per_page=200').subscribe({
      next: (r) => {
        this.housingUnits = r.success
          ? (Array.isArray(r.data) ? r.data : (r.data?.data || []))
          : [];
      },
      error: () => { this.housingUnits = []; }
    });
  }

  loadLeases(): void {
    this.loading = true;
    let url = `leases?page=${this.leasesPage}&per_page=15`;
    if (this.leaseStatusFilter) url += `&status=${this.leaseStatusFilter}`;

    this.apiService.get<any>(url).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.leases          = r.data.data || [];
          this.leasesPage      = r.data.current_page || 1;
          this.leasesTotalPages = r.data.last_page || 1;
          this.leasesTotal     = r.data.total || 0;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.leases = []; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  loadAllPayments(): void {
    let url = `leases/payments?page=${this.paymentsPage}&per_page=15`;
    if (this.paymentMonthFilter) url += `&period_month=${this.paymentMonthFilter}`;

    this.apiService.get<any>(url).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.payments          = r.data.data || [];
          this.paymentsPage      = r.data.current_page || 1;
          this.paymentsTotalPages = r.data.last_page || 1;
          this.paymentsTotal     = r.data.total || 0;
        }
        this.cdr.detectChanges();
      },
      error: () => { this.payments = []; }
    });
  }

  loadStats(): void {
    this.apiService.get<any>('leases/statistics').subscribe({
      next: (r) => { if (r.success && r.data) { this.stats = r.data; this.cdr.detectChanges(); } },
      error: () => {}
    });
  }

  loadLeasePayments(leaseId: number): void {
    this.apiService.get<any>(`leases/${leaseId}/payments?per_page=50`).subscribe({
      next: (r) => {
        this.selectedLeasePayments = r.success ? (r.data?.data || []) : [];
        this.cdr.detectChanges();
      },
      error: () => { this.selectedLeasePayments = []; }
    });
  }

  // ===== LEASES CRUD =====

  openNewLeaseModal(): void {
    this.editMode  = false;
    this.submitted = false;
    this.selectedLease = null;
    this.leaseForm.reset({
      housing_unit_id: null, renter_name: '', renter_phone: '',
      renter_email: '', start_date: this.today(), end_date: null,
      monthly_rent: null, deposit_amount: 0, currency: 'GNF',
      payment_day: 1, status: 'ACTIVE', notes: ''
    });
    this.showLeaseModal = true;
  }

  openEditLeaseModal(lease: any): void {
    this.editMode  = true;
    this.submitted = false;
    this.selectedLease = lease;
    this.leaseForm.patchValue({
      housing_unit_id: lease.housing_unit_id,
      renter_name:     lease.renter_name,
      renter_phone:    lease.renter_phone || '',
      renter_email:    lease.renter_email || '',
      start_date:      lease.start_date?.split('T')[0] || lease.start_date,
      end_date:        lease.end_date?.split('T')[0] || null,
      monthly_rent:    lease.monthly_rent,
      deposit_amount:  lease.deposit_amount || 0,
      currency:        lease.currency,
      payment_day:     lease.payment_day || 1,
      status:          lease.status,
      notes:           lease.notes || ''
    });
    this.showLeaseModal = true;
  }

  saveLease(): void {
    this.submitted = true;
    if (this.leaseForm.invalid) return;

    const obs = this.editMode && this.selectedLease
      ? this.apiService.put<any>(`leases/${this.selectedLease.id}`, this.leaseForm.value)
      : this.apiService.post<any>('leases', this.leaseForm.value);

    obs.subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ icon: 'success', title: this.editMode ? 'Contrat modifié' : 'Contrat créé', timer: 2000, showConfirmButton: false });
          this.showLeaseModal = false;
          this.loadLeases(); this.loadStats();
        }
      },
      error: (err) => Swal.fire({ icon: 'error', title: 'Erreur', text: err?.error?.message || 'Erreur' })
    });
  }

  deleteLease(lease: any): void {
    Swal.fire({
      title: `Supprimer le contrat de ${lease.renter_name} ?`,
      text: 'L\'unité sera remise à disponible.',
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#d33', cancelButtonColor: '#6c757d',
      confirmButtonText: 'Supprimer', cancelButtonText: 'Annuler'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.apiService.delete<any>(`leases/${lease.id}`).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', timer: 1500, showConfirmButton: false, title: 'Supprimé' });
          this.loadLeases(); this.loadStats();
        },
        error: () => Swal.fire({ icon: 'error', title: 'Impossible de supprimer' })
      });
    });
  }

  // ===== PAYMENTS =====

  openPaymentModal(lease: any): void {
    this.submitted = false;
    this.selectedLease = lease;
    this.paymentForm.reset({
      period_month:   this.currentMonth(),
      amount:         lease.monthly_rent,
      currency:       lease.currency || 'GNF',
      payment_date:   this.today(),
      payment_method: 'ESPECES',
      reference: '', status: 'PAID', notes: ''
    });
    this.showPaymentModal = true;
  }

  savePayment(): void {
    this.submitted = true;
    if (this.paymentForm.invalid) return;

    this.apiService.post<any>(`leases/${this.selectedLease.id}/payments`, this.paymentForm.value).subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ icon: 'success', title: 'Paiement enregistré', timer: 2000, showConfirmButton: false });
          this.showPaymentModal = false;
          this.loadAllPayments(); this.loadStats();
        }
      },
      error: (err) => Swal.fire({ icon: 'error', title: 'Erreur', text: err?.error?.message || 'Erreur' })
    });
  }

  deletePayment(payment: any): void {
    Swal.fire({
      title: 'Supprimer ce paiement ?', icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#d33', cancelButtonColor: '#6c757d',
      confirmButtonText: 'Supprimer', cancelButtonText: 'Annuler'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.apiService.delete<any>(`lease-payments/${payment.id}`).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', timer: 1500, showConfirmButton: false, title: 'Supprimé' });
          this.loadAllPayments(); this.loadStats();
          if (this.showLeasePaymentsModal && this.selectedLease) {
            this.loadLeasePayments(this.selectedLease.id);
          }
        },
        error: () => Swal.fire({ icon: 'error', title: 'Impossible de supprimer' })
      });
    });
  }

  openLeasePaymentsModal(lease: any): void {
    this.selectedLease = lease;
    this.selectedLeasePayments = [];
    this.showLeasePaymentsModal = true;
    this.loadLeasePayments(lease.id);
  }

  // ===== HELPERS =====

  getUnitLabel(unit: any): string {
    if (!unit) return '—';
    const floor = unit.floor;
    const building = floor?.building;
    return `${building?.name || ''} - Étage ${floor?.floor_number ?? ''} - Unité #${unit.id}`;
  }

  getStatusColor(status: string): string {
    const m: Record<string, string> = {
      ACTIVE: 'success', PENDING: 'warning', EXPIRED: 'secondary', TERMINATED: 'danger',
      PAID: 'success', LATE: 'danger'
    };
    return m[status] || 'secondary';
  }

  getStatusLabel(status: string): string {
    const m: Record<string, string> = {
      ACTIVE: 'Actif', PENDING: 'En attente', EXPIRED: 'Expiré', TERMINATED: 'Résilié',
      PAID: 'Payé', LATE: 'En retard', PENDING_PAY: 'Impayé'
    };
    return m[status] || status;
  }

  getPaymentMethodLabel(m: string): string {
    return this.paymentMethods.find(x => x.value === m)?.label || m;
  }

  formatAmount(amount: number, currency = 'GNF'): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0 }).format(amount || 0) + ' ' + currency;
  }

  getLeaseDuration(lease: any): string {
    if (!lease.start_date) return '—';
    const start = new Date(lease.start_date);
    if (!lease.end_date) return `Depuis ${start.toLocaleDateString('fr-FR')}`;
    const end = new Date(lease.end_date);
    const months = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
    return `${months} mois`;
  }

  getPaidMonths(lease: any): number {
    return lease.payments?.filter((p: any) => p.status === 'PAID')?.length || 0;
  }

  getCollectionRate(): number {
    if (!this.stats.expected_this_month || this.stats.expected_this_month === 0) return 0;
    return Math.min(100, Math.round((this.stats.collected_this_month / this.stats.expected_this_month) * 100));
  }

  // Pagination
  onLeasesPageChange(p: number): void  { if (p >= 1 && p <= this.leasesTotalPages)   { this.leasesPage = p;   this.loadLeases(); } }
  onPaymentsPageChange(p: number): void { if (p >= 1 && p <= this.paymentsTotalPages) { this.paymentsPage = p; this.loadAllPayments(); } }
  getPages(total: number): number[] { return Array.from({ length: total }, (_, i) => i + 1); }

  private today(): string { return new Date().toISOString().split('T')[0]; }
  private currentMonth(): string { return new Date().toISOString().substring(0, 7); }
}
