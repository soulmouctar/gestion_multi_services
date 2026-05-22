import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';

import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-client-list',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, RouterModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-list.component.html',
  styleUrls: ['./client-list.component.scss'],
})
export class ClientListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  clients: any[] = [];
  loading = false;
  error: string | null = null;
  searchTerm = '';
  clientTypeFilter = '';

  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  itemsPerPage = 15;

  selectedClients: Set<number> = new Set();
  selectAll = false;

  showFormModal = false;
  editMode = false;
  submitted = false;
  clientForm: FormGroup;
  selectedClient: any = null;
  savingClient = false;

  // Photo upload
  selectedPhotoFile: File | null = null;
  photoPreview: string | null = null;
  uploadingPhoto = false;

  // Historique des transactions
  showHistoryModal = false;
  historyLoading = false;
  clientHistory: any = null;
  financialOverview: any = null;

  // Tenants (pour SUPER_ADMIN)
  tenants: any[] = [];

  clientTypes = [
    { value: '', label: 'Tous les types' },
    { value: 'GENERAL', label: 'Clients généraux' },
    { value: 'PNEUS', label: 'Clients pneus' },
    { value: 'TEXTILE', label: 'Clients textile' },
    { value: 'COSMETIQUES', label: 'Clients cosmétiques' },
    { value: 'CONTAINER_PAGNE', label: 'Clients conteneurs pagne' },
  ];

  pageTitle = 'Gestion des Clients';
  pageDescription = 'clients enregistré(s)';
  createButtonLabel = 'Nouveau client';

  Math = Math;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private alertService: AlertService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {
    this.clientForm = this.fb.group({
      name:      ['', [Validators.required, Validators.maxLength(150)]],
      phone1:    [''],
      phone2:    [''],
      email:     ['', [Validators.email]],
      address:   [''],
      notes:     [''],
      client_type: ['GENERAL', Validators.required],
      tenant_id: [null],
    });
  }

  get isSuperAdmin(): boolean { return this.authService.isSuperAdmin; }
  get canCreateClients(): boolean { return this.authService.hasModulePermission('CLIENTS_SUPPLIERS', 'create'); }
  get canEditClients(): boolean { return this.authService.hasModulePermission('CLIENTS_SUPPLIERS', 'edit'); }
  get canDeleteClients(): boolean { return this.authService.hasModulePermission('CLIENTS_SUPPLIERS', 'delete'); }
  get canManageClientPhotos(): boolean { return this.canEditClients || this.canCreateClients; }

  ngOnInit(): void {
    const routeClientType = this.route.snapshot.data['clientType'] as string | undefined;
    const routeTitle = this.route.snapshot.data['pageTitle'] as string | undefined;
    const routeDescription = this.route.snapshot.data['pageDescription'] as string | undefined;
    const routeCreateLabel = this.route.snapshot.data['createButtonLabel'] as string | undefined;

    if (routeClientType) {
      this.clientTypeFilter = routeClientType;
      this.clientForm.patchValue({ client_type: routeClientType });
    }
    if (routeTitle) this.pageTitle = routeTitle;
    if (routeDescription) this.pageDescription = routeDescription;
    if (routeCreateLabel) this.createButtonLabel = routeCreateLabel;

    this.loadClients();
    this.loadFinancialOverview();
    if (this.isSuperAdmin) this.loadTenants();
  }

  loadTenants(): void {
    this.apiService.get<any>('tenants?per_page=200').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.tenants = r?.data?.data || r?.data || [];
        this.cdr.detectChanges();
      }
    });
  }

  loadClients(): void {
    this.loading = true;
    this.error   = null;
    const query = new URLSearchParams();
    query.set('page', String(this.currentPage));
    if (this.searchTerm) {
      query.set('search', this.searchTerm);
    }
    if (this.clientTypeFilter) {
      query.set('client_type', this.clientTypeFilter);
    }

    const params = `?${query.toString()}`;
    this.apiService.get<any>(`clients${params}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.clients      = r.data.data         || [];
          this.currentPage  = r.data.current_page || 1;
          this.totalPages   = r.data.last_page    || 1;
          this.totalItems   = r.data.total        || 0;
          this.itemsPerPage = r.data.per_page     || 15;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.error = 'Erreur lors du chargement des clients'; this.loading = false; this.cdr.detectChanges(); },
    });
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadClients();
    this.loadFinancialOverview();
  }

  onClientTypeFilterChange(): void {
    if (this.route.snapshot.data['clientType']) return;
    this.currentPage = 1;
    this.loadClients();
    this.loadFinancialOverview();
  }

  loadFinancialOverview(): void {
    const query = new URLSearchParams();
    if (this.searchTerm) {
      query.set('search', this.searchTerm);
    }
    if (this.clientTypeFilter) {
      query.set('client_type', this.clientTypeFilter);
    }

    const params = query.toString() ? `?${query.toString()}` : '';
    this.apiService.get<any>(`clients/financial-overview${params}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.financialOverview = r?.success ? r.data : null;
        this.cdr.detectChanges();
      },
      error: () => {
        this.financialOverview = null;
        this.cdr.detectChanges();
      }
    });
  }

  get isRouteLockedClientType(): boolean {
    return !!this.route.snapshot.data['clientType'];
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadClients();
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  openCreateModal(): void {
    if (!this.canCreateClients) return;
    this.editMode = false;
    this.submitted = false;
    this.selectedPhotoFile = null;
    this.photoPreview = null;
    this.clientForm.reset({
      name: '',
      phone1: '',
      phone2: '',
      email: '',
      address: '',
      notes: '',
      client_type: this.clientTypeFilter || 'GENERAL',
      tenant_id: null
    });
    this.showFormModal = true;
  }

  openEditModal(client: any): void {
    if (!this.canEditClients) return;
    this.editMode = true;
    this.submitted = false;
    this.selectedClient = client;
    this.selectedPhotoFile = null;
    this.photoPreview = client.photo_url || null;
    this.clientForm.patchValue({
      name:      client.name      || '',
      phone1:    client.phone1    || '',
      phone2:    client.phone2    || '',
      email:     client.email     || '',
      address:   client.address   || '',
      notes:     client.notes     || '',
      client_type: client.client_type || 'GENERAL',
      tenant_id: client.tenant_id || null,
    });
    this.showFormModal = true;
  }

  saveClient(): void {
    this.submitted = true;
    if (this.clientForm.invalid) return;
    if (this.isSuperAdmin && !this.clientForm.get('tenant_id')?.value) {
      this.alertService.showError('Organisation requise', 'Veuillez sélectionner une organisation.');
      return;
    }
    this.savingClient = true;

    const raw = this.clientForm.value;
    // Nettoyer les chaînes vides → null pour les champs optionnels
    const data: any = {
      name:    raw.name,
      phone1:  raw.phone1  || null,
      phone2:  raw.phone2  || null,
      email:   raw.email   || null,
      address: raw.address || null,
      notes:   raw.notes   || null,
      client_type: raw.client_type || 'GENERAL',
    };
    // Inclure tenant_id seulement si SUPER_ADMIN et valeur sélectionnée
    if (this.isSuperAdmin && raw.tenant_id) {
      data.tenant_id = raw.tenant_id;
    }

    const obs = this.editMode && this.selectedClient
      ? this.apiService.put<any>(`clients/${this.selectedClient.id}`, data)
      : this.apiService.post<any>('clients', data);

    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success) {
          const clientId = r.data?.id ?? this.selectedClient?.id;
          if (this.selectedPhotoFile && clientId) {
            this.uploadPhoto(clientId, () => { this.afterSave(); });
          } else {
            this.afterSave();
          }
        }
        this.savingClient = false;
      },
      error: (err) => {
        this.alertService.showError('Erreur', err.message || 'Erreur lors de la sauvegarde');
        this.savingClient = false;
        this.cdr.detectChanges();
      },
    });
  }

  private afterSave(): void {
    this.alertService.showSuccess(this.editMode ? 'Client mis à jour' : 'Client créé');
    this.showFormModal = false;
    this.savingClient  = false;
    this.loadClients();
    this.cdr.detectChanges();
  }

  getClientTypeLabel(type: string): string {
    return this.clientTypes.find((item) => item.value === type)?.label || type || 'Non défini';
  }

  deleteClient(client: any): void {
    if (!this.canDeleteClients) return;
    this.alertService.showDeleteConfirmation(client.name, 'client').then(r => {
      if (!r.isConfirmed) return;
      this.apiService.delete<any>(`clients/${client.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => { this.alertService.showSuccess('Client supprimé'); this.loadClients(); },
        error: (err) => this.alertService.showError('Erreur', err.message || 'Erreur lors de la suppression'),
      });
    });
  }

  // ─── Photo ───────────────────────────────────────────────────────────────────

  onPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.selectedPhotoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.photoPreview = e.target?.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  private uploadPhoto(clientId: number, callback: () => void): void {
    if (!this.selectedPhotoFile) { callback(); return; }
    this.uploadingPhoto = true;
    const formData = new FormData();
    formData.append('photo', this.selectedPhotoFile);
    // Utiliser HttpClient directement pour que le browser gère Content-Type multipart/form-data
    this.http.post<any>(`${environment.apiUrl}/clients/${clientId}/photo`, formData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.uploadingPhoto = false; callback(); },
        error: (err) => {
          this.uploadingPhoto = false;
          this.alertService.showError('Photo', err.message || 'Erreur upload photo');
          callback();
        },
      });
  }

  removePhoto(client: any): void {
    if (!this.canManageClientPhotos) return;
    this.alertService.showConfirmation('Supprimer la photo', 'Confirmer la suppression de la photo ?').then(r => {
      if (!r.isConfirmed) return;
      this.apiService.delete<any>(`clients/${client.id}/photo`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => { this.alertService.showSuccess('Photo supprimée'); this.loadClients(); },
        error: () => this.alertService.showError('Erreur', 'Impossible de supprimer la photo'),
      });
    });
  }

  // ─── Historique des transactions ─────────────────────────────────────────────

  openHistory(client: any): void {
    this.historyLoading   = true;
    this.clientHistory    = null;
    this.showHistoryModal = true;
    this.cdr.detectChanges();

    this.apiService.get<any>(`clients/${client.id}/transactions`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.clientHistory  = r.data ?? null;
          this.historyLoading = false;
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

  // ─── Helpers historique ───────────────────────────────────────────────────

  getEntryIcon(type: string): string {
    const icons: Record<string, string> = {
      invoice:           'cilDescription',
      payment:           'cilMoney',
      container_sale:    'cilStorage',
      container_payment: 'cilCash',
      advance:           'cilWallet',
    };
    return icons[type] ?? 'cilCircle';
  }

  getEntryColor(type: string, direction: string): { bg: string; color: string } {
    if (direction === 'credit') return { bg: '#ECFDF5', color: '#059669' };
    const colors: Record<string, { bg: string; color: string }> = {
      invoice:        { bg: '#EFF6FF', color: '#1D4ED8' },
      container_sale: { bg: '#F5F3FF', color: '#7C3AED' },
    };
    return colors[type] ?? { bg: '#F3F4F6', color: '#6B7280' };
  }

  getStatusBadge(entry: any): { label: string; bg: string; color: string } | null {
    if (entry.type === 'invoice') {
      const map: any = {
        PAYE:   { label: 'Payée',    bg: '#ECFDF5', color: '#059669' },
        PARTIEL:{ label: 'Partielle',bg: '#FFFBEB', color: '#D97706' },
        IMPAYE: { label: 'Impayée',  bg: '#FEF2F2', color: '#DC2626' },
      };
      return map[entry.status] ?? null;
    }
    if (entry.type === 'container_sale') {
      const map: any = {
        PAYE_TOTAL: { label: 'Payé',    bg: '#ECFDF5', color: '#059669' },
        PARTIEL:    { label: 'Partiel', bg: '#FFFBEB', color: '#D97706' },
        IMPAYE:     { label: 'Impayé',  bg: '#FEF2F2', color: '#DC2626' },
      };
      return map[entry.status] ?? null;
    }
    if (entry.type === 'advance') {
      const map: any = {
        DISPONIBLE: { label: 'Disponible', bg: '#ECFDF5', color: '#059669' },
        UTILISE:    { label: 'Utilisé',    bg: '#F3F4F6', color: '#6B7280' },
        PARTIEL:    { label: 'Partiel',    bg: '#FFFBEB', color: '#D97706' },
      };
      return map[entry.status] ?? null;
    }
    return null;
  }

  // ─── Selection ───────────────────────────────────────────────────────────────

  toggleSelectAll(): void {
    if (this.selectAll) { this.selectedClients.clear(); } else { this.clients.forEach(c => this.selectedClients.add(c.id)); }
    this.selectAll = !this.selectAll;
  }

  toggleSelection(id: number): void {
    this.selectedClients.has(id) ? this.selectedClients.delete(id) : this.selectedClients.add(id);
    this.selectAll = this.selectedClients.size === this.clients.length;
  }

  isSelected(id: number): boolean { return this.selectedClients.has(id); }

  deleteSelected(): void {
    if (!this.canDeleteClients) return;
    if (!this.selectedClients.size) return;
    this.alertService.showConfirmation('Supprimer', `Supprimer ${this.selectedClients.size} client(s) ?`, 'Oui, supprimer').then(r => {
      if (!r.isConfirmed) return;
      const ids = Array.from(this.selectedClients);
      let done = 0;
      ids.forEach(id => {
        this.apiService.delete<any>(`clients/${id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => { if (++done === ids.length) { this.selectedClients.clear(); this.selectAll = false; this.loadClients(); } },
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
    const colors = ['#0f3460','#16213e','#533483','#2d6a4f','#c77dff','#e63946'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  getDebtStatusColor(remaining: number): string {
    return remaining > 0 ? '#EF4444' : '#10B981';
  }

  getFinancialRow(clientId: number): any {
    return this.financialOverview?.clients?.find((item: any) => item.id === clientId) || null;
  }

  getFinancialStatusStyle(status: string | undefined): { bg: string; color: string } {
    switch (status) {
      case 'DEBITEUR':
        return { bg: '#FEF2F2', color: '#DC2626' };
      case 'AVANCE':
        return { bg: '#ECFDF5', color: '#059669' };
      default:
        return { bg: '#EFF6FF', color: '#2563EB' };
    }
  }

  getPages(): number[] {
    const start = Math.max(1, this.currentPage - 4);
    const end   = Math.min(this.totalPages, start + 9);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  trackById(_: number, item: any): any { return item?.id ?? _; }
}
