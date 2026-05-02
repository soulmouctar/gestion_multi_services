import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import { AlertService } from '../../../core/services/alert.service';

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

  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  itemsPerPage = 15;

  selectedSuppliers: Set<number> = new Set();
  selectAll = false;

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

  // Relations financières
  showFinancialModal = false;
  financialLoading = false;
  supplierFinancial: any = null;

  Math = Math;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef,
  ) {
    this.supplierForm = this.fb.group({
      name:     ['', [Validators.required, Validators.maxLength(150)]],
      email:    ['', [Validators.email]],
      phone1:   [''],
      phone2:   [''],
      address:  [''],
      notes:    [''],
      currency: ['GNF'],
    });
  }

  ngOnInit(): void {
    this.loadSuppliers();
  }

  loadSuppliers(): void {
    this.loading = true;
    this.error   = null;
    const params = this.searchTerm
      ? `?search=${encodeURIComponent(this.searchTerm)}&page=${this.currentPage}`
      : `?page=${this.currentPage}`;
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
    this.supplierForm.reset({ name: '', email: '', phone1: '', phone2: '', address: '', notes: '', currency: 'GNF' });
    this.showFormModal = true;
  }

  openEditModal(supplier: any): void {
    this.editMode = true;
    this.submitted = false;
    this.selectedSupplier = supplier;
    this.selectedPhotoFile = null;
    this.photoPreview = supplier.photo_url || null;
    this.supplierForm.patchValue({
      name:     supplier.name     || '',
      email:    supplier.email    || '',
      phone1:   supplier.phone1   || '',
      phone2:   supplier.phone2   || '',
      address:  supplier.address  || '',
      notes:    supplier.notes    || '',
      currency: supplier.currency || 'GNF',
    });
    this.showFormModal = true;
  }

  saveSupplier(): void {
    this.submitted = true;
    if (this.supplierForm.invalid) return;
    this.savingSupplier = true;

    const data = this.supplierForm.value;
    const obs  = this.editMode && this.selectedSupplier
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
        this.alertService.showError('Erreur', err?.error?.message || 'Erreur lors de la sauvegarde');
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
        error: (err) => this.alertService.showError('Erreur', err?.error?.message || 'Erreur'),
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
    this.apiService.post<any>(`suppliers/${supplierId}/photo`, formData).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.uploadingPhoto = false; callback(); },
      error: () => { this.uploadingPhoto = false; callback(); },
    });
  }

  // ─── Relations financières ───────────────────────────────────────────────────

  openFinancialRelations(supplier: any): void {
    this.financialLoading  = true;
    this.supplierFinancial = null;
    this.showFinancialModal = true;
    this.cdr.detectChanges();

    this.apiService.get<any>(`suppliers/${supplier.id}/financial-relations`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => { this.supplierFinancial = r.data; this.financialLoading = false; this.cdr.detectChanges(); },
        error: () => {
          this.financialLoading  = false;
          this.showFinancialModal = false;
          this.alertService.showError('Erreur', 'Impossible de charger les relations financières');
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

  getMethodLabel(method: string): string {
    return ({ ORANGE_MONEY: 'Orange Money', WAVE: 'Wave', MTN_MONEY: 'MTN Money',
              VIREMENT: 'Virement', CHEQUE: 'Chèque', ESPECES: 'Espèces' } as any)[method] ?? method;
  }

  getPages(): number[] {
    const start = Math.max(1, this.currentPage - 4);
    const end   = Math.min(this.totalPages, start + 9);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  trackById(_: number, item: any): any { return item?.id ?? _; }
}
