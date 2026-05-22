import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ButtonModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule, ProgressModule, NavModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-leases',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, ProgressModule, NavModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './leases.component.html'
})
export class LeasesComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);


  // ===== DATA =====
  leases: any[] = [];
  payments: any[] = [];
  housingUnits: any[] = [];
  selectedLeasePayments: any[] = [];
  selectedLeaseFinancialSituation: any = null;

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
  receiptLoading = false;

  // ===== SELECTED =====
  selectedLease: any = null;
  selectedLeasePhotoFile: File | null = null;
  selectedLeasePhotoPreview: string | null = null;

  // Months already paid for the selected lease (used in payment modal)
  paidPeriods: string[] = [];
  // Ordered list of unpaid months from contract start to today
  unpaidMonths: string[] = [];
  loadingPaidMonths = false;

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
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router
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

  get canCreateLeases(): boolean { return this.authService.hasModulePermission('RENTAL', 'create'); }
  get canEditLeases(): boolean { return this.authService.hasModulePermission('RENTAL', 'edit'); }
  get canDeleteLeases(): boolean { return this.authService.hasModulePermission('RENTAL', 'delete'); }
  get canRegisterLeasePayments(): boolean { return this.authService.hasModulePermission('RENTAL', 'create'); }
  get canDeleteLeasePayments(): boolean { return this.authService.hasModulePermission('RENTAL', 'delete'); }

  ngOnInit(): void {
    this.loadHousingUnits();
    this.loadLeases();
    this.loadAllPayments();
    this.loadStats();

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (params.get('action') === 'new-tenant') {
        this.openNewLeaseModal();
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { action: null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
      }
    });
  }

  // ===== LOAD DATA =====

  loadHousingUnits(): void {
    this.apiService.get<any>('housing-units?per_page=200').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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

    this.apiService.get<any>(url).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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

    this.apiService.get<any>(url).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    this.apiService.get<any>('leases/statistics').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { if (r.success && r.data) { this.stats = r.data; this.cdr.detectChanges(); } },
      error: () => {}
    });
  }

  loadLeasePayments(leaseId: number): void {
    this.apiService.get<any>(`leases/${leaseId}/payments?per_page=50`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.selectedLeasePayments = r.success ? (r.data?.data || []) : [];
        this.cdr.detectChanges();
      },
      error: () => { this.selectedLeasePayments = []; }
    });
  }

  loadLeaseFinancialSituation(leaseId: number): void {
    this.apiService.get<any>(`leases/${leaseId}/financial-situation`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.selectedLeaseFinancialSituation = r.success ? r.data : null;
        this.cdr.detectChanges();
      },
      error: () => {
        this.selectedLeaseFinancialSituation = null;
        this.cdr.detectChanges();
      }
    });
  }

  // ===== LEASES CRUD =====

  openNewLeaseModal(): void {
    if (!this.canCreateLeases) return;
    this.editMode  = false;
    this.submitted = false;
    this.selectedLease = null;
    this.selectedLeasePhotoFile = null;
    this.selectedLeasePhotoPreview = null;
    this.leaseForm.reset({
      housing_unit_id: null, renter_name: '', renter_phone: '',
      renter_email: '', start_date: this.today(), end_date: null,
      monthly_rent: null, deposit_amount: 0, currency: 'GNF',
      payment_day: 1, status: 'ACTIVE', notes: ''
    });
    this.showLeaseModal = true;
  }

  openEditLeaseModal(lease: any): void {
    if (!this.canEditLeases) return;
    this.editMode  = true;
    this.submitted = false;
    this.selectedLease = lease;
    this.selectedLeasePhotoFile = null;
    this.selectedLeasePhotoPreview = lease.renter_photo_url || null;
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

  onLeasePhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.selectedLeasePhotoFile = file;
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.selectedLeasePhotoPreview = String(reader.result || '');
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  saveLease(): void {
    this.submitted = true;
    if (this.leaseForm.invalid) return;
    if (this.editMode ? !this.canEditLeases : !this.canCreateLeases) return;

    const formData = new FormData();
    Object.entries(this.leaseForm.value).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        formData.append(key, String(value));
      }
    });
    if (this.selectedLeasePhotoFile) {
      formData.append('renter_photo', this.selectedLeasePhotoFile);
    }

    const obs = this.editMode && this.selectedLease
      ? this.apiService.put<any>(`leases/${this.selectedLease.id}`, formData)
      : this.apiService.post<any>('leases', formData);

    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ icon: 'success', title: this.editMode ? 'Contrat modifié' : 'Contrat créé', timer: 2000, showConfirmButton: false });
          this.showLeaseModal = false;
          this.loadLeases(); this.loadStats();
        }
      },
      error: (err) => Swal.fire({ icon: 'error', title: 'Erreur', text: err.message || 'Erreur' })
    });
  }

  deleteLease(lease: any): void {
    if (!this.canDeleteLeases) return;
    Swal.fire({
      title: `Supprimer le contrat de ${lease.renter_name} ?`,
      text: 'L\'unité sera remise à disponible.',
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#d33', cancelButtonColor: '#6c757d',
      confirmButtonText: 'Supprimer', cancelButtonText: 'Annuler'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.apiService.delete<any>(`leases/${lease.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    if (!this.canRegisterLeasePayments) return;
    this.submitted = false;
    this.selectedLease = lease;
    this.paidPeriods = [];
    this.unpaidMonths = [];
    this.loadingPaidMonths = true;

    // Load existing payments to determine next unpaid month
    this.apiService.get<any>(`leases/${lease.id}/payments?per_page=200`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        const payments = r.success ? (r.data?.data || []) : [];
        this.paidPeriods = payments
          .filter((p: any) => p.status === 'PAID')
          .map((p: any) => p.period_month as string);

        // Build list of all months from contract start to today (max 24)
        const startDate = new Date(lease.start_date);
        const today = new Date();
        const allMonths: string[] = [];
        const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const limit = new Date(today.getFullYear(), today.getMonth(), 1);
        while (cur <= limit && allMonths.length < 24) {
          allMonths.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
          cur.setMonth(cur.getMonth() + 1);
        }

        this.unpaidMonths = allMonths.filter(m => !this.paidPeriods.includes(m));
        const suggestedMonth = this.unpaidMonths.length > 0 ? this.unpaidMonths[0] : this.currentMonth();

        this.paymentForm.reset({
          period_month:   suggestedMonth,
          amount:         lease.monthly_rent,
          currency:       lease.currency || 'GNF',
          payment_date:   this.today(),
          payment_method: 'ESPECES',
          reference: '', status: 'PAID', notes: ''
        });
        this.loadingPaidMonths = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.paidPeriods = [];
        this.unpaidMonths = [];
        this.paymentForm.reset({
          period_month:   this.currentMonth(),
          amount:         lease.monthly_rent,
          currency:       lease.currency || 'GNF',
          payment_date:   this.today(),
          payment_method: 'ESPECES',
          reference: '', status: 'PAID', notes: ''
        });
        this.loadingPaidMonths = false;
        this.cdr.detectChanges();
      }
    });

    this.showPaymentModal = true;
  }

  savePayment(): void {
    this.submitted = true;
    if (this.paymentForm.invalid) return;
    if (!this.canRegisterLeasePayments) return;

    this.apiService.post<any>(`leases/${this.selectedLease.id}/payments`, this.paymentForm.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ icon: 'success', title: 'Paiement enregistré', timer: 2000, showConfirmButton: false });
          this.showPaymentModal = false;
          this.loadAllPayments(); this.loadStats();
          if (this.selectedLease?.id) {
            this.loadLeaseFinancialSituation(this.selectedLease.id);
          }
        }
      },
      error: (err) => Swal.fire({ icon: 'error', title: 'Erreur', text: err.message || 'Erreur' })
    });
  }

  deletePayment(payment: any): void {
    if (!this.canDeleteLeasePayments) return;
    Swal.fire({
      title: 'Supprimer ce paiement ?', icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#d33', cancelButtonColor: '#6c757d',
      confirmButtonText: 'Supprimer', cancelButtonText: 'Annuler'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.apiService.delete<any>(`lease-payments/${payment.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', timer: 1500, showConfirmButton: false, title: 'Supprimé' });
          this.loadAllPayments(); this.loadStats();
          if (this.showLeasePaymentsModal && this.selectedLease) {
            this.loadLeasePayments(this.selectedLease.id);
            this.loadLeaseFinancialSituation(this.selectedLease.id);
          }
        },
        error: () => Swal.fire({ icon: 'error', title: 'Impossible de supprimer' })
      });
    });
  }

  openLeasePaymentsModal(lease: any): void {
    this.selectedLease = lease;
    this.selectedLeasePayments = [];
    this.selectedLeaseFinancialSituation = null;
    this.showLeasePaymentsModal = true;
    this.loadLeasePayments(lease.id);
    this.loadLeaseFinancialSituation(lease.id);
  }

  printPaymentReceipt(payment: any): void {
    this.receiptLoading = true;
    this.apiService.get<any>(`lease-payments/${payment.id}/receipt`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.receiptLoading = false;
        if (r.success && r.data) {
          this.openReceiptWindow(r.data);
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.receiptLoading = false;
        Swal.fire({ icon: 'error', title: 'Erreur', text: 'Impossible de générer le reçu.' });
        this.cdr.detectChanges();
      }
    });
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

  /** Format "2026-04" → "Avril 2026" */
  formatPeriod(period: string): string {
    if (!period || period.length < 7) return period;
    const [year, month] = period.split('-');
    const months = ['Janvier','Février','Mars','Avril','Mai','Juin',
                    'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    return `${months[parseInt(month, 10) - 1]} ${year}`;
  }

  isPeriodAlreadyPaid(period: string): boolean {
    return this.paidPeriods.includes(period);
  }

  private today(): string { return new Date().toISOString().split('T')[0]; }
  private currentMonth(): string { return new Date().toISOString().substring(0, 7); }
  private openReceiptWindow(receipt: any): void {
    const popup = window.open('', '_blank', 'width=900,height=760');
    if (!popup) {
      Swal.fire({ icon: 'info', title: 'Popup bloqué', text: 'Autorisez les popups pour afficher le reçu.' });
      return;
    }

    const amount = this.formatAmount(receipt.amount, receipt.currency);
    const monthlyRent = this.formatAmount(receipt.lease?.monthly_rent || 0, receipt.lease?.currency || receipt.currency);
    const paymentDate = receipt.payment_date ? new Date(receipt.payment_date).toLocaleDateString('fr-FR') : '—';
    const generatedAt = receipt.generated_at ? new Date(receipt.generated_at).toLocaleString('fr-FR') : '';

    popup.document.write(`
      <html><head><title>Reçu ${receipt.receipt_number}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:28px;color:#0f172a}
        .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
        .title{font-size:28px;font-weight:700;color:#0f3460}
        .badge{display:inline-block;padding:6px 10px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-weight:600;font-size:12px}
        .card{border:1px solid #e5e7eb;border-radius:14px;padding:18px;margin-bottom:18px}
        .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
        .label{font-size:12px;color:#64748b;text-transform:uppercase;margin-bottom:4px}
        .value{font-size:16px;font-weight:600}.amount{font-size:30px;font-weight:800;color:#059669}
        .footer{margin-top:26px;font-size:12px;color:#64748b}
      </style></head><body>
        <div class="header">
          <div><div class="title">Reçu de paiement locataire</div><div style="margin-top:6px;color:#64748b;">Généré le ${generatedAt}</div></div>
          <div class="badge">${receipt.receipt_number}</div>
        </div>
        <div class="card"><div class="label">Montant encaissé</div><div class="amount">${amount}</div></div>
        <div class="grid">
          <div class="card"><div class="label">Locataire</div><div class="value">${receipt.lease?.renter_name || '—'}</div><div style="margin-top:8px;color:#475569;">${receipt.lease?.renter_phone || '—'}${receipt.lease?.renter_email ? ' • ' + receipt.lease.renter_email : ''}</div></div>
          <div class="card"><div class="label">Période réglée</div><div class="value">${this.formatPeriod(receipt.period_month)}</div><div style="margin-top:8px;color:#475569;">Paiement du ${paymentDate}</div></div>
          <div class="card"><div class="label">Unité / emplacement</div><div class="value">${receipt.lease?.housing_unit_label || '—'}</div><div style="margin-top:8px;color:#475569;">${receipt.lease?.building_name || ''}${receipt.lease?.location_name ? ' • ' + receipt.lease.location_name : ''}</div></div>
          <div class="card"><div class="label">Détails de paiement</div><div class="value">${receipt.payment_method || '—'}</div><div style="margin-top:8px;color:#475569;">Référence: ${receipt.reference || '—'} • Loyer mensuel: ${monthlyRent}</div></div>
        </div>
        <div class="footer">Statut: ${receipt.status || 'PAID'}${receipt.notes ? ' • Notes: ' + receipt.notes : ''}</div>
        <script>window.onload=()=>window.print();</script>
      </body></html>
    `);
    popup.document.close();
  }
  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }

}
