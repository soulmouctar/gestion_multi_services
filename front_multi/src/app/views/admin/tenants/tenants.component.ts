import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { TenantService } from '../../../core/services/tenant.service';
import { Tenant, Module, ApiResponse } from '../../../core/models/tenant.model';
import { IconDirective } from '@coreui/icons-angular';
import {
  ButtonModule,
  ButtonGroupModule,
  CardModule,
  FormModule,
  TableModule,
  BadgeModule,
  ModalModule,
  AlertModule,
  SpinnerModule
} from '@coreui/angular';

@Component({
  selector: 'app-tenants',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    IconDirective,
    ButtonModule,
    ButtonGroupModule,
    CardModule,
    FormModule,
    TableModule,
    BadgeModule,
    ModalModule,
    AlertModule,
    SpinnerModule
    ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tenants.component.html',
  styleUrls: ['./tenants.component.scss']
})
export class TenantsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  organisations: Tenant[] = [];
  modules: Module[] = [];
  loading = false;
  submitted = false;
  editMode = false;
  selectedOrganisation: Tenant | null = null;
  deleteModalOpen = false;
  organisationToDelete: Tenant | null = null;
  moduleModalOpen = false;
  selectedOrganisationForModules: Tenant | null = null;

  // UI moderne : panneau lateral d'edition + recherche
  showFormDrawer = false;
  searchText = '';
  statusFilter: 'ALL' | 'ACTIVE' | 'SUSPENDED' = 'ALL';

  organisationForm: FormGroup;
  filterForm: FormGroup;

  // ── KPIs computed ──────────────────────────────────────────────
  get kpiTotal(): number   { return Array.isArray(this.organisations) ? this.organisations.length : 0; }
  get kpiActive(): number  { return (this.organisations || []).filter(o => (o.subscription_status || '').toUpperCase() === 'ACTIVE').length; }
  get kpiSuspended(): number { return (this.organisations || []).filter(o => (o.subscription_status || '').toUpperCase() === 'SUSPENDED').length; }
  get kpiWithModules(): number {
    return (this.organisations || []).filter(o => Array.isArray((o as any).modules) && (o as any).modules.length > 0).length;
  }

  get filteredOrganisations(): Tenant[] {
    const list = Array.isArray(this.organisations) ? this.organisations : [];
    const q = this.searchText.trim().toLowerCase();
    return list.filter(o => {
      const statusOk = this.statusFilter === 'ALL'
        || (o.subscription_status || '').toUpperCase() === this.statusFilter;
      if (!statusOk) return false;
      if (!q) return true;
      return (o.name || '').toLowerCase().includes(q)
          || (o.email || '').toLowerCase().includes(q)
          || (o.phone || '').toLowerCase().includes(q);
    });
  }

  countActiveModules(org: any): number {
    if (!Array.isArray(org?.modules)) return 0;
    return org.modules.filter((m: any) => m?.pivot?.is_active || m?.is_active).length;
  }

  openCreateDrawer(): void {
    this.resetForm();
    this.showFormDrawer = true;
    this.cdr.detectChanges();
  }
  openEditDrawer(org: Tenant): void {
    this.editOrganisation(org);
    this.showFormDrawer = true;
    this.cdr.detectChanges();
  }
  closeDrawer(): void {
    this.showFormDrawer = false;
    this.resetForm();
  }

  
  constructor(
    private tenantService: TenantService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.organisationForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(150)]],
      email: ['', [Validators.email, Validators.maxLength(150)]],
      phone: ['', [Validators.maxLength(50)]],
      address: ['', [Validators.maxLength(255)]],
      subscription_status: ['ACTIVE', Validators.required]
    });

    this.filterForm = this.fb.group({
      search: [''],
      status: ['ALL']
    });
  }

  ngOnInit(): void {
    this.loadOrganisations();
    this.loadModules();
  }

  loadOrganisations(): void {
    this.loading = true;
    this.cdr.detectChanges();
    
    this.tenantService.getTenants().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: ApiResponse<any>) => {
        if (response.success && Array.isArray(response.data)) {
          this.organisations = response.data;
        } else if (response.data?.data && Array.isArray(response.data.data)) {
          this.organisations = response.data.data;
        } else {
          this.organisations = [];
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.organisations = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadModules(): void {
    // Charger les modules depuis la base de données via l'API
    this.tenantService.getModules().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: ApiResponse<any>) => {
        // Adapter la structure des modules de la base de données
        this.modules = (response.data?.data || []).map((module: any) => ({
          id: module.id,
          code: module.code,
          name: module.name,
          icon: this.getModuleIcon(module.code),
          is_active: module.is_active || true
        }));
        // Force change detection after async operation
        setTimeout(() => {
          this.cdr.detectChanges();
        }, 0);
      },
      error: () => {
        // Fallback vers les modules par défaut en cas d'erreur
        this.modules = [
          { id: 1, code: 'COMMERCE', name: 'Module Commerce', icon: 'cil-cart', is_active: true },
          { id: 2, code: 'CLIENTS_SUPPLIERS', name: 'Clients & Fournisseurs', icon: 'cil-people', is_active: true },
          { id: 3, code: 'USERS', name: 'Utilisateurs', icon: 'cil-people', is_active: true },
          { id: 4, code: 'PRODUCTS_STOCK', name: 'Module Produits & Stock', icon: 'cil-grid', is_active: true },
          { id: 5, code: 'CONTAINER', name: 'Module Conteneurs', icon: 'cil-truck', is_active: true },
          { id: 6, code: 'RENTAL', name: 'Module Immobilier', icon: 'cil-home', is_active: true },
          { id: 7, code: 'TAXI', name: 'Module Taxi', icon: 'cil-car-alt', is_active: true },
          { id: 8, code: 'FINANCE', name: 'Module Finance', icon: 'cil-dollar', is_active: true },
          { id: 9, code: 'STATISTICS', name: 'Module Statistiques', icon: 'cil-chart-pie', is_active: true }
        ];
        setTimeout(() => {
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  private getModuleIcon(code: string): string {
    const iconMap: { [key: string]: string } = {
      'COMMERCE': 'cil-cart',
      'CLIENTS_SUPPLIERS': 'cil-people',
      'USERS': 'cil-people',
      'PRODUCTS_STOCK': 'cil-grid',
      'CONTAINER': 'cil-truck',
      'RENTAL': 'cil-home',
      'TAXI': 'cil-car-alt',
      'FINANCE': 'cil-dollar',
      'STATISTICS': 'cil-chart-pie',
      'COMMERCIAL': 'cil-cart',
      'CONTAINERS': 'cil-truck'
    };
    return iconMap[code] || 'cil-puzzle';
  }

  
  
  get f() {
    return this.organisationForm.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    this.cdr.detectChanges();

    if (this.organisationForm.invalid) {
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    if (this.editMode && this.selectedOrganisation) {
      this.updateOrganisation();
    } else {
      this.createOrganisation();
    }
  }

  /**
   * Construit un FormData avec les champs + le logo (si selectionne).
   * Le service envoie automatiquement en multipart si on detecte FormData.
   */
  private buildPayload(): FormData | any {
    if (!this.logoFile) return this.organisationForm.value;
    const fd = new FormData();
    Object.entries(this.organisationForm.value).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') fd.append(k, String(v));
    });
    fd.append('logo', this.logoFile);
    return fd;
  }

  private createOrganisation(): void {
    // Utiliser le vrai backend pour créer le tenant dans la base de données
    this.tenantService.createTenant(this.buildPayload()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: ApiResponse<Tenant>) => {
        // S'assurer que this.organisations est un tableau avant d'utiliser push
        if (!Array.isArray(this.organisations)) {
          this.organisations = [];
        }

        this.organisations.push(response.data);
        this.resetForm();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private updateOrganisation(): void {
    if (!this.selectedOrganisation) return;

    // Utiliser le vrai backend pour mettre à jour le tenant dans la base de données
    // (FormData si logo selectionne, sinon JSON classique)
    const payload = this.buildPayload();
    this.tenantService.updateTenant(this.selectedOrganisation.id, payload as any).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: ApiResponse<Tenant>) => {
        const index = this.organisations.findIndex(t => t.id === this.selectedOrganisation!.id);
        if (index !== -1) {
          this.organisations[index] = response.data;
        }

        this.resetForm();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  editOrganisation(organisation: Tenant): void {
    this.editMode = true;
    this.selectedOrganisation = organisation;
    this.currentLogoUrl = (organisation as any).logo_url || null;
    this.logoPreview = null;
    this.logoFile = null;
    this.organisationForm.patchValue({
      name: organisation.name,
      email: organisation.email,
      phone: organisation.phone,
      address: (organisation as any).address || '',
      subscription_status: organisation.subscription_status
    });
  }

  // ── Gestion du logo ────────────────────────────────────────────────
  logoFile: File | null = null;
  logoPreview: string | null = null;
  currentLogoUrl: string | null = null;

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) return;
    if (file.size > 2 * 1024 * 1024) return;
    this.logoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => { this.logoPreview = e.target?.result as string; this.cdr.detectChanges(); };
    reader.readAsDataURL(file);
  }

  clearLogo(): void {
    this.logoFile = null;
    this.logoPreview = null;
  }

  get displayedLogo(): string | null {
    return this.logoPreview || this.currentLogoUrl;
  }

  deleteOrganisation(organisation: Tenant): void {
    this.organisationToDelete = organisation;
    this.deleteModalOpen = true;
  }

  confirmDelete(): void {
    if (!this.organisationToDelete) return;

    this.loading = true;
    this.cdr.detectChanges();
    
    // Utiliser le vrai backend pour supprimer le tenant de la base de données
    this.tenantService.deleteTenant(this.organisationToDelete.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        // S'assurer que this.organisations est un tableau avant d'utiliser filter
        if (!Array.isArray(this.organisations)) {
          this.organisations = [];
        }

        this.organisations = this.organisations.filter(t => t.id !== this.organisationToDelete!.id);
        this.cancelDelete();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  cancelDelete(): void {
    this.deleteModalOpen = false;
    this.organisationToDelete = null;
  }

  resetForm(): void {
    this.organisationForm.reset({
      name: '',
      email: '',
      phone: '',
      address: '',
      subscription_status: 'ACTIVE'
    });
    this.editMode = false;
    this.selectedOrganisation = null;
    this.submitted = false;
    this.logoFile = null;
    this.logoPreview = null;
    this.currentLogoUrl = null;
    this.cdr.detectChanges();
  }

  // Module management
  openModuleModal(organisation: Tenant): void {
    this.selectedOrganisationForModules = organisation;
    this.moduleModalOpen = true;
  }

  closeModuleModal(): void {
    this.moduleModalOpen = false;
    this.selectedOrganisationForModules = null;
  }

  isModuleAssigned(organisation: Tenant | null, module: Module): boolean {
    if (!organisation || !organisation.modules) {
      return false;
    }
    return organisation.modules.some(m => m.id === module.id);
  }

  isModuleActive(organisation: Tenant | null, module: Module): boolean {
    if (!organisation || !organisation.modules) {
      return false;
    }
    const organisationModule = organisation.modules.find(m => m.id === module.id);
    return organisationModule?.pivot?.is_active ?? false;
  }

  // Status management
  toggleOrganisationStatus(organisation: Tenant): void {
    const newStatus = organisation.subscription_status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    
    this.loading = true;
    this.cdr.detectChanges();
    
    this.tenantService.updateTenant(organisation.id, { subscription_status: newStatus }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: ApiResponse<Tenant>) => {
        const index = this.organisations.findIndex(t => t.id === organisation.id);
        if (index !== -1) {
          this.organisations[index] = response.data;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Utility methods
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'bg-success';
      case 'SUSPENDED':
        return 'bg-warning';
      default:
        return 'bg-secondary';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'Actif';
      case 'SUSPENDED':
        return 'Suspendu';
      default:
        return 'Inconnu';
    }
  }

  // Module management for organisation
  toggleModuleForOrganisation(organisation: Tenant | null, module: Module): void {
    if (!organisation) return;
    
    this.loading = true;
    this.cdr.detectChanges();
    
    // Toggle module activation for organisation
    const isCurrentlyActive = this.isModuleActive(organisation, module);
    
    if (isCurrentlyActive) {
      // Remove module from organisation
      this.tenantService.removeModule(organisation.id, module.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          if (organisation.modules) {
            organisation.modules = organisation.modules.filter(m => m.id !== module.id);
          }
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading = false; this.cdr.detectChanges(); }
      });
    } else {
      this.tenantService.assignModule(organisation.id, module.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          if (!organisation.modules) {
            organisation.modules = [];
          }
          organisation.modules.push({
            ...module,
            pivot: {
              tenant_id: organisation.id,
              module_id: module.id,
              is_active: true
            }
          });
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading = false; this.cdr.detectChanges(); }
      });
    }
  }

  // Filter and search
  applyFilters(): void {
    const search = this.filterForm.get('search')?.value?.toLowerCase() || '';
    const status = this.filterForm.get('status')?.value || 'ALL';

    // Logique de filtrage à implémenter
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      status: 'ALL'
    });
    this.loadOrganisations();
  }
  trackByOrg(_i: number, o: any): any { return o?.id ?? _i; }
  trackByModule(_i: number, m: any): any { return m?.id ?? _i; }

  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }

}
