import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
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
import { PdfService } from '../../../core/services/pdf.service';
import { resolveUploadUrl } from '../../../core/utils/upload-url.util';
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
  templateUrl: './leases.component.html',
  styleUrl: './leases.component.scss'
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
  leaseSearch = '';
  paymentMonthFilter = '';
  /** Évite une requête par frappe dans le champ de recherche. */
  private readonly leaseSearch$ = new Subject<string>();

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
  advancePaymentMonth = '';
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
    private pdfService: PdfService,
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
  get selectableHousingUnits(): any[] {
    const currentUnitId = Number(this.selectedLease?.housing_unit_id || 0);
    return this.housingUnits.filter(unit => {
      const isCurrentLeaseUnit = this.editMode && Number(unit.id) === currentUnitId;
      return isCurrentLeaseUnit || String(unit.status || 'LIBRE').toUpperCase() === 'LIBRE';
    });
  }

  ngOnInit(): void {
    this.loadHousingUnits();
    this.loadLeases();
    this.loadAllPayments();
    this.loadStats();

    this.leaseSearch$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.leasesPage = 1;
        this.loadLeases();
      });

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
        this.cdr.detectChanges();
      },
      error: () => { this.housingUnits = []; this.cdr.detectChanges(); }
    });
  }

  loadLeases(): void {
    this.loading = true;
    let url = `leases?page=${this.leasesPage}&per_page=15`;
    if (this.leaseStatusFilter) url += `&status=${this.leaseStatusFilter}`;
    if (this.leaseSearch.trim()) url += `&search=${encodeURIComponent(this.leaseSearch.trim())}`;

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
    this.selectedLeasePhotoPreview = this.leasePhotoUrl(lease) || null;
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

  leasePhotoUrl(lease: any): string {
    return resolveUploadUrl(lease?.renter_photo_url || lease?.renter_photo || '');
  }

  hideBrokenImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.style.display = 'none';
    const fallback = image.nextElementSibling as HTMLElement | null;
    if (fallback) {
      fallback.style.display = 'flex';
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
    this.advancePaymentMonth = '';
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
        this.advancePaymentMonth = this.unpaidMonths.length > 0 ? '' : this.nextAvailableMonth(this.paidPeriods, this.currentMonth());
        const suggestedMonth = this.unpaidMonths.length > 0 ? this.unpaidMonths[0] : this.advancePaymentMonth;

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
        this.advancePaymentMonth = '';
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
          this.showPaymentModal = false;
          this.loadAllPayments(); this.loadStats();
          if (this.selectedLease?.id) {
            this.loadLeaseFinancialSituation(this.selectedLease.id);
          }
          const payment = r.data;
          // On attend la fermeture de la modale : la boite d'impression ne peut pas
          // s'ouvrir tant que SweetAlert bloque le scroll et garde le focus.
          void Swal.fire({
            icon: 'success',
            title: 'Paiement enregistré',
            text: payment?.id ? 'Génération du reçu en cours...' : '',
            timer: 1200,
            showConfirmButton: false
          }).then(() => {
            if (payment?.id) {
              this.printPaymentReceipt(payment);
            }
          });
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
    const paymentId = payment?.id;
    if (!paymentId) {
      console.error('Reçu impossible : paiement sans identifiant', payment);
      Swal.fire({ icon: 'error', title: 'Erreur', text: 'Paiement sans identifiant : reçu impossible.' });
      return;
    }

    this.receiptLoading = true;
    this.apiService.get<any>(`lease-payments/${paymentId}/receipt`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (!r.success || !r.data) {
          this.receiptLoading = false;
          this.cdr.detectChanges();
          Swal.fire({ icon: 'error', title: 'Erreur', text: 'Reçu introuvable pour ce paiement.' });
          return;
        }

        const tenant = this.authService.currentTenant as any;
        this.pdfService.printRentalPaymentReceiptPdf({
          ...r.data,
          organisation: {
            name: tenant?.name || 'MATKOLLA',
            address: tenant?.address || '',
            phone: tenant?.phone || '',
            email: tenant?.email || '',
            logoUrl: tenant?.logo_url || '',
            footerText: 'Reçu de paiement locataire',
          },
        })
          .catch((err) => {
            console.error('Génération du reçu impossible', err);
            Swal.fire({ icon: 'error', title: 'Erreur', text: "Le reçu n'a pas pu être généré." });
          })
          .finally(() => {
            this.receiptLoading = false;
            this.cdr.detectChanges();
          });
      },
      error: (err) => {
        this.receiptLoading = false;
        // Le message generique masquait la vraie cause (403 module, 404 paiement,
        // session expiree...). On remonte ce que l'API a repondu.
        const detail = err?.message ? ` (${err.message})` : '';
        console.error(`Reçu KO sur lease-payments/${paymentId}/receipt`, err);
        Swal.fire({ icon: 'error', title: 'Erreur', text: `Impossible de générer le reçu${detail}` });
        this.cdr.detectChanges();
      }
    });
  }

  // ===== HELPERS =====

  getUnitLabel(unit: any): string {
    if (!unit) return '—';
    const floor = unit.floor;
    const building = unit.building || floor?.building;
    const level = floor ? `Étage ${floor.floor_number}` : 'Sans étage / annexe';
    const apartment = unit.unit_label || `Unité #${unit.id}`;
    return `${building?.name || 'Bâtiment'} - ${apartment} - ${level}`;
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

  onLeaseSearchChange(value: string): void {
    this.leaseSearch = value;
    this.leaseSearch$.next(value);
  }

  clearLeaseFilters(): void {
    this.leaseSearch = '';
    this.leaseStatusFilter = '';
    this.leasesPage = 1;
    this.loadLeases();
  }

  /** Part des contrats actifs, pour la jauge de la carte de synthèse. */
  getActiveRate(): number {
    if (!this.stats.total_leases) return 0;
    return Math.min(100, Math.round((this.stats.active_leases / this.stats.total_leases) * 100));
  }

  initialOf(name?: string | null): string {
    return (name || '?').trim().charAt(0).toUpperCase() || '?';
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

  private nextAvailableMonth(paidPeriods: string[], fromMonth: string): string {
    const paid = new Set(paidPeriods || []);
    const [year, month] = fromMonth.split('-').map(Number);
    const cursor = new Date(year, (month || 1) - 1, 1);
    for (let i = 0; i < 60; i++) {
      const candidate = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      if (!paid.has(candidate)) {
        return candidate;
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return fromMonth;
  }

  private today(): string { return new Date().toISOString().split('T')[0]; }
  private currentMonth(): string { return new Date().toISOString().substring(0, 7); }
  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }

}
