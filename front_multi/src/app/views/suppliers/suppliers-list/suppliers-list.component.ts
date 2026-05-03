import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule,
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-suppliers-list',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suppliers-list.component.html',
  styleUrls: ['./suppliers-list.component.scss'],
})
export class SuppliersListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  suppliers: any[] = [];
  loading = false;
  error: string | null = null;
  searchTerm = '';
  filterCategory = '';

  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  itemsPerPage = 15;

  selectedSuppliers: Set<number> = new Set();
  selectAll = false;

  // Formulaire fournisseur
  showFormModal = false;
  editMode = false;
  submitted = false;
  supplierForm: FormGroup;
  selectedSupplier: any = null;
  savingSupplier = false;

  // Photo
  selectedPhotoFile: File | null = null;
  photoPreview: string | null = null;
  uploadingPhoto = false;

  // Historique / balance FIFO
  showHistoryModal = false;
  historyLoading = false;
  supplierHistory: any = null;
  historyTab: 'arrivals' | 'payments' = 'arrivals';

  // Modal versement
  showPaymentModal = false;
  paymentForm: FormGroup;
  savingPayment = false;
  paymentSubmitted = false;
  currentSupplierForPayment: any = null;

  // SUPER_ADMIN
  tenants: any[] = [];

  readonly categories = [
    'Textile', 'Cosmétiques', 'Pneus & Pièces auto',
    'Alimentation', 'Électronique', 'Matériaux construction',
    'Mobilier', 'Médicaments', 'Autres',
  ];

  readonly paymentMethods = [
    { value: 'ESPECES',      label: 'Espèces' },
    { value: 'VIREMENT',     label: 'Virement bancaire' },
    { value: 'CHEQUE',       label: 'Chèque' },
    { value: 'ORANGE_MONEY', label: 'Orange Money' },
    { value: 'WAVE',         label: 'Wave' },
    { value: 'MTN_MONEY',    label: 'MTN Money' },
    { value: 'AUTRE',        label: 'Autre' },
  ];

  Math = Math;

  get isSuperAdmin(): boolean {
    return this.authService.userRole === 'SUPER_ADMIN';
  }

  get showExchangeRate(): boolean {
    return this.paymentForm.get('currency')?.value !== 'GNF';
  }

  get estimatedAmountGnf(): number {
    const amount = parseFloat(this.paymentForm.get('amount')?.value) || 0;
    const rate   = parseFloat(this.paymentForm.get('exchange_rate')?.value) || 0;
    const cur    = this.paymentForm.get('currency')?.value;
    if (cur === 'GNF') return amount;
    return rate > 0 ? amount * rate : 0;
  }

  get outstandingDebt(): number {
    return this.supplierHistory?.summary?.balance_gnf ?? 0;
  }

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private alertService: AlertService,
    private authService: AuthService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {
    this.supplierForm = this.fb.group({
      name:      ['', [Validators.required, Validators.maxLength(150)]],
      category:  [''],
      email:     ['', [Validators.email]],
      phone1:    [''],
      phone2:    [''],
      address:   [''],
      notes:     [''],
      currency:  ['GNF'],
      tenant_id: [null],
    });

    this.paymentForm = this.fb.group({
      amount:         ['', [Validators.required, Validators.min(0.01)]],
      currency:       ['GNF', Validators.required],
      exchange_rate:  [''],
      payment_method: ['ESPECES', Validators.required],
      payment_date:   [new Date().toISOString().split('T')[0], Validators.required],
      reference:      [''],
      description:    [''],
    });
  }

  ngOnInit(): void {
    if (this.isSuperAdmin) this.loadTenants();
    this.loadSuppliers();
  }

  loadTenants(): void {
    this.apiService.get<any>('tenants?per_page=200').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { this.tenants = r.data?.data ?? r.data ?? []; this.cdr.detectChanges(); },
      error: () => {},
    });
  }

  loadSuppliers(): void {
    this.loading = true;
    this.error   = null;
    let params = `?page=${this.currentPage}`;
    if (this.searchTerm)     params += `&search=${encodeURIComponent(this.searchTerm)}`;
    if (this.filterCategory) params += `&category=${encodeURIComponent(this.filterCategory)}`;

    this.apiService.get<any>(`suppliers${params}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.suppliers    = r.data.data         || [];
          this.currentPage  = r.data.current_page || 1;
          this.totalPages   = r.data.last_page    || 1;
          this.totalItems   = r.data.total        || 0;
          this.itemsPerPage = r.data.per_page     || 15;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.error = 'Erreur lors du chargement'; this.loading = false; this.cdr.detectChanges(); },
    });
  }

  onSearch(): void { this.currentPage = 1; this.loadSuppliers(); }
  onFilterCategory(cat: string): void { this.filterCategory = cat; this.currentPage = 1; this.loadSuppliers(); }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadSuppliers();
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  openCreateModal(): void {
    this.editMode = false;
    this.submitted = false;
    this.selectedPhotoFile = null;
    this.photoPreview = null;
    this.supplierForm.reset({ name: '', category: '', email: '', phone1: '', phone2: '', address: '', notes: '', currency: 'GNF', tenant_id: null });
    this.showFormModal = true;
  }

  openEditModal(supplier: any): void {
    this.editMode = true;
    this.submitted = false;
    this.selectedSupplier = supplier;
    this.selectedPhotoFile = null;
    this.photoPreview = supplier.photo_url || null;
    this.supplierForm.patchValue({
      name:      supplier.name     || '',
      category:  supplier.category || '',
      email:     supplier.email    || '',
      phone1:    supplier.phone1   || '',
      phone2:    supplier.phone2   || '',
      address:   supplier.address  || '',
      notes:     supplier.notes    || '',
      currency:  supplier.currency || 'GNF',
      tenant_id: supplier.tenant_id || null,
    });
    this.showFormModal = true;
  }

  saveSupplier(): void {
    this.submitted = true;
    if (this.supplierForm.invalid) return;
    this.savingSupplier = true;

    const v    = this.supplierForm.value;
    const data: any = {
      name:     v.name     || null,
      category: v.category || null,
      email:    v.email    || null,
      phone1:   v.phone1   || null,
      phone2:   v.phone2   || null,
      address:  v.address  || null,
      notes:    v.notes    || null,
      currency: v.currency || 'GNF',
    };
    if (this.isSuperAdmin && v.tenant_id) data.tenant_id = v.tenant_id;

    const obs = this.editMode && this.selectedSupplier
      ? this.apiService.put<any>(`suppliers/${this.selectedSupplier.id}`, data)
      : this.apiService.post<any>('suppliers', data);

    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success) {
          const supplierId = r.data?.id ?? this.selectedSupplier?.id;
          if (this.selectedPhotoFile && supplierId) {
            this.uploadPhoto(supplierId, () => this.afterSave());
          } else {
            this.afterSave();
          }
        }
        this.savingSupplier = false;
      },
      error: (err) => {
        this.alertService.showError('Erreur', err.message || 'Erreur lors de la sauvegarde');
        this.savingSupplier = false;
        this.cdr.detectChanges();
      },
    });
  }

  private afterSave(): void {
    this.alertService.showSuccess(this.editMode ? 'Fournisseur mis à jour' : 'Fournisseur créé');
    this.showFormModal  = false;
    this.savingSupplier = false;
    this.loadSuppliers();
    this.cdr.detectChanges();
  }

  deleteSupplier(supplier: any): void {
    this.alertService.showDeleteConfirmation(supplier.name, 'fournisseur').then(r => {
      if (!r.isConfirmed) return;
      this.apiService.delete<any>(`suppliers/${supplier.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => { this.alertService.showSuccess('Fournisseur supprimé'); this.loadSuppliers(); },
        error: (err) => this.alertService.showError('Erreur', err.message || 'Erreur'),
      });
    });
  }

  // ─── Photo ───────────────────────────────────────────────────────────────────

  onPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.selectedPhotoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => { this.photoPreview = e.target?.result as string; this.cdr.detectChanges(); };
    reader.readAsDataURL(file);
  }

  private uploadPhoto(supplierId: number, callback: () => void): void {
    if (!this.selectedPhotoFile) { callback(); return; }
    this.uploadingPhoto = true;
    const formData = new FormData();
    formData.append('photo', this.selectedPhotoFile);
    this.http.post<any>(`${environment.apiUrl}/suppliers/${supplierId}/photo`, formData)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => { this.uploadingPhoto = false; callback(); },
        error: () => { this.uploadingPhoto = false; callback(); },
      });
  }

  // ─── Versement fournisseur ───────────────────────────────────────────────────

  openPaymentModal(supplier: any): void {
    this.currentSupplierForPayment = supplier;
    this.paymentSubmitted = false;

    // Pré-remplir avec la devise du fournisseur
    const currency = supplier.currency || 'GNF';
    this.paymentForm.reset({
      amount:         '',
      currency:       currency,
      exchange_rate:  '',
      payment_method: 'ESPECES',
      payment_date:   new Date().toISOString().split('T')[0],
      reference:      '',
      description:    '',
    });

    // Si on a déjà l'historique chargé, fermer le modal historique d'abord
    this.showHistoryModal = false;
    this.showPaymentModal = true;
    this.cdr.detectChanges();
  }

  savePayment(): void {
    this.paymentSubmitted = true;
    if (this.paymentForm.invalid) return;
    this.savingPayment = true;

    const v    = this.paymentForm.value;
    const data: any = {
      amount:         parseFloat(v.amount),
      currency:       v.currency,
      payment_method: v.payment_method,
      payment_date:   v.payment_date,
      reference:      v.reference || null,
      description:    v.description || null,
    };
    if (this.showExchangeRate && v.exchange_rate) {
      data.exchange_rate = parseFloat(v.exchange_rate);
    }

    this.apiService.post<any>(`suppliers/${this.currentSupplierForPayment.id}/payments`, data)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (r) => {
          if (r.success) {
            this.alertService.showSuccess('Versement enregistré avec succès');
            this.showPaymentModal = false;
            this.loadSuppliers();
            // Recharger l'historique avec la nouvelle balance
            this.openHistory(this.currentSupplierForPayment);
          }
          this.savingPayment = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.alertService.showError('Erreur', err.message || 'Erreur lors de l\'enregistrement');
          this.savingPayment = false;
          this.cdr.detectChanges();
        },
      });
  }

  deletePayment(payment: any): void {
    const supplier = this.currentSupplierForPayment;
    this.alertService.showConfirmation(
      'Supprimer ce versement',
      `Versement de ${payment.amount} ${payment.currency} du ${this.formatDate(payment.date)} ?`,
      'Oui, supprimer'
    ).then(r => {
      if (!r.isConfirmed) return;
      this.apiService.delete<any>(`suppliers/${supplier.id}/payments/${payment.id}`)
        .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => {
            this.alertService.showSuccess('Versement supprimé');
            this.openHistory(supplier);
          },
          error: (err) => this.alertService.showError('Erreur', err.message || 'Erreur'),
        });
    });
  }

  // ─── Historique FIFO ─────────────────────────────────────────────────────────

  openHistory(supplier: any): void {
    this.historyLoading   = true;
    this.supplierHistory  = null;
    this.historyTab       = 'arrivals';
    this.showHistoryModal = true;
    this.currentSupplierForPayment = supplier;
    this.cdr.detectChanges();

    this.apiService.get<any>(`suppliers/${supplier.id}/history`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.supplierHistory = r.data;
          this.historyLoading  = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.historyLoading   = false;
          this.showHistoryModal = false;
          this.alertService.showError('Erreur', 'Impossible de charger l\'historique');
          this.cdr.detectChanges();
        },
      });
  }

  // ─── Selection ───────────────────────────────────────────────────────────────

  toggleSelectAll(): void {
    if (this.selectAll) { this.selectedSuppliers.clear(); } else { this.suppliers.forEach(s => this.selectedSuppliers.add(s.id)); }
    this.selectAll = !this.selectAll;
  }

  toggleSelection(id: number): void {
    this.selectedSuppliers.has(id) ? this.selectedSuppliers.delete(id) : this.selectedSuppliers.add(id);
    this.selectAll = this.selectedSuppliers.size === this.suppliers.length;
  }

  isSelected(id: number): boolean { return this.selectedSuppliers.has(id); }

  deleteSelected(): void {
    if (!this.selectedSuppliers.size) return;
    this.alertService.showConfirmation('Supprimer', `Supprimer ${this.selectedSuppliers.size} fournisseur(s) ?`, 'Oui').then(r => {
      if (!r.isConfirmed) return;
      const ids = Array.from(this.selectedSuppliers);
      let done = 0;
      ids.forEach(id => {
        this.apiService.delete<any>(`suppliers/${id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => { if (++done === ids.length) { this.selectedSuppliers.clear(); this.selectAll = false; this.loadSuppliers(); } },
          error: () => { done++; },
        });
      });
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  getInitials(name: string): string {
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  getAvatarColor(name: string): string {
    const colors = ['#533483','#0f3460','#2d6a4f','#d62828','#023e8a','#7b2d8b'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
  }

  getCategoryColor(cat: string): { bg: string; color: string } {
    const map: Record<string, { bg: string; color: string }> = {
      'Textile':                { bg: '#EDE9FE', color: '#7C3AED' },
      'Cosmétiques':            { bg: '#FCE7F3', color: '#DB2777' },
      'Pneus & Pièces auto':    { bg: '#FEF3C7', color: '#D97706' },
      'Alimentation':           { bg: '#ECFDF5', color: '#059669' },
      'Électronique':           { bg: '#EFF6FF', color: '#2563EB' },
      'Matériaux construction': { bg: '#FEF2F2', color: '#DC2626' },
      'Mobilier':               { bg: '#F0FDF4', color: '#16A34A' },
      'Médicaments':            { bg: '#F0F9FF', color: '#0284C7' },
    };
    return map[cat] ?? { bg: '#F3F4F6', color: '#6B7280' };
  }

  getPaymentStatusStyle(status: string): { bg: string; color: string; label: string } {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      'SOLDE':  { bg: '#ECFDF5', color: '#059669', label: '✓ Soldé' },
      'PARTIEL':{ bg: '#FFFBEB', color: '#D97706', label: '⬤ Partiel' },
      'IMPAYE': { bg: '#FEF2F2', color: '#DC2626', label: '✗ Impayé' },
    };
    return map[status] ?? { bg: '#F3F4F6', color: '#6B7280', label: status };
  }

  getMethodLabel(method: string): string {
    return this.paymentMethods.find(m => m.value === method)?.label ?? method;
  }

  formatDate(d: string): string {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  getPages(): number[] {
    const start = Math.max(1, this.currentPage - 4);
    const end   = Math.min(this.totalPages, start + 9);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  trackById(_: number, item: any): any { return item?.id ?? _; }
}
