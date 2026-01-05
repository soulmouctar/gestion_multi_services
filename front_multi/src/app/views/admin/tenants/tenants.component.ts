import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TenantService, Tenant, Module, ApiResponse } from '../../../core/services/tenant.service';

@Component({
  selector: 'app-tenants',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ],
  templateUrl: './tenants.component.html',
  styleUrls: ['./tenants.component.scss']
})
export class TenantsComponent implements OnInit {
  tenants: Tenant[] = [];
  modules: Module[] = [];
  loading = false;
  submitted = false;
  editMode = false;
  selectedTenant: Tenant | null = null;
  deleteModalOpen = false;
  tenantToDelete: Tenant | null = null;
  moduleModalOpen = false;
  selectedTenantForModules: Tenant | null = null;

  tenantForm: FormGroup;
  filterForm: FormGroup;

  
  constructor(
    private tenantService: TenantService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.tenantForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(150)]],
      email: ['', [Validators.email, Validators.maxLength(150)]],
      phone: ['', [Validators.maxLength(50)]],
      subscription_status: ['ACTIVE', Validators.required]
    });

    this.filterForm = this.fb.group({
      search: [''],
      status: ['ALL']
    });
  }

  ngOnInit(): void {
    this.loadTenants();
    this.loadModules();
  }

  loadTenants(): void {
    this.loading = true;
    this.cdr.detectChanges();
    
    this.tenantService.getTenants().subscribe({
      next: (response: ApiResponse<Tenant[]>) => {
        // Utiliser uniquement les données du backend
        this.tenants = Array.isArray(response.data) ? response.data : [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading tenants from database:', error);
        // En cas d'erreur, afficher un tableau vide
        this.tenants = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadModules(): void {
    // Modules réels de la base de données MySQL
    this.modules = [
      { id: 1, code: 'COMMERCIAL', name: 'Gestion Commerciale', icon: 'cil-cart', enabled: true },
      { id: 2, code: 'FINANCE', name: 'Gestion Financière', icon: 'cil-dollar', enabled: true },
      { id: 3, code: 'CLIENTS_SUPPLIERS', name: 'Clients & Fournisseurs', icon: 'cil-people', enabled: true },
      { id: 4, code: 'PRODUCTS_STOCK', name: 'Produits & Stock', icon: 'cil-box', enabled: true },
      { id: 5, code: 'CONTAINERS', name: 'Conteneurs', icon: 'cil-truck', enabled: true },
      { id: 6, code: 'RENTAL', name: 'Location Immobilière', icon: 'cil-home', enabled: true },
      { id: 7, code: 'TAXI', name: 'Gestion Taxi', icon: 'cil-car-alt', enabled: true },
      { id: 8, code: 'STATISTICS', name: 'Statistiques', icon: 'cil-chart-pie', enabled: true }
    ];
  }

  
  
  get f() {
    return this.tenantForm.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    this.cdr.detectChanges();

    if (this.tenantForm.invalid) {
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    if (this.editMode && this.selectedTenant) {
      this.updateTenant();
    } else {
      this.createTenant();
    }
  }

  private createTenant(): void {
    // Utiliser le vrai backend pour créer le tenant dans la base de données
    this.tenantService.createTenant(this.tenantForm.value).subscribe({
      next: (response: ApiResponse<Tenant>) => {
        // S'assurer que this.tenants est un tableau avant d'utiliser push
        if (!Array.isArray(this.tenants)) {
          this.tenants = [];
        }
        
        this.tenants.push(response.data);
        console.log('Tenant créé dans la base de données MySQL:', response.data);
        this.resetForm();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error creating tenant in database:', error);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private updateTenant(): void {
    if (!this.selectedTenant) return;

    // Utiliser le vrai backend pour mettre à jour le tenant dans la base de données
    this.tenantService.updateTenant(this.selectedTenant.id, this.tenantForm.value).subscribe({
      next: (response: ApiResponse<Tenant>) => {
        const index = this.tenants.findIndex(t => t.id === this.selectedTenant!.id);
        if (index !== -1) {
          this.tenants[index] = response.data;
          console.log('Tenant mis à jour dans la base de données MySQL:', response.data);
        }
        
        this.resetForm();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error updating tenant in database:', error);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  editTenant(tenant: Tenant): void {
    this.editMode = true;
    this.selectedTenant = tenant;
    this.tenantForm.patchValue({
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone,
      subscription_status: tenant.subscription_status
    });
  }

  deleteTenant(tenant: Tenant): void {
    this.tenantToDelete = tenant;
    this.deleteModalOpen = true;
  }

  confirmDelete(): void {
    if (!this.tenantToDelete) return;

    this.loading = true;
    this.cdr.detectChanges();
    
    // Utiliser le vrai backend pour supprimer le tenant de la base de données
    this.tenantService.deleteTenant(this.tenantToDelete.id).subscribe({
      next: () => {
        // S'assurer que this.tenants est un tableau avant d'utiliser filter
        if (!Array.isArray(this.tenants)) {
          this.tenants = [];
        }
        
        this.tenants = this.tenants.filter(t => t.id !== this.tenantToDelete!.id);
        console.log('Tenant supprimé de la base de données MySQL:', this.tenantToDelete);
        this.cancelDelete();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error deleting tenant from database:', error);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  cancelDelete(): void {
    this.deleteModalOpen = false;
    this.tenantToDelete = null;
  }

  resetForm(): void {
    this.tenantForm.reset({
      name: '',
      email: '',
      phone: '',
      subscription_status: 'ACTIVE'
    });
    this.editMode = false;
    this.selectedTenant = null;
    this.submitted = false;
    this.cdr.detectChanges();
  }

  // Module management
  openModuleModal(tenant: Tenant): void {
    this.selectedTenantForModules = tenant;
    this.moduleModalOpen = true;
  }

  closeModuleModal(): void {
    this.moduleModalOpen = false;
    this.selectedTenantForModules = null;
  }

  toggleModule(tenant: Tenant, module: Module): void {
    // Simuler la gestion des modules dans la base de données
    const tenantIndex = this.tenants.findIndex(t => t.id === tenant.id);
    if (tenantIndex === -1) return;

    const updatedTenant = { ...this.tenants[tenantIndex] };
    
    // S'assurer que modules est défini
    if (!updatedTenant.modules) {
      updatedTenant.modules = [];
    }
    
    // Vérifier si le module est déjà assigné
    const moduleIndex = updatedTenant.modules.findIndex(m => m.id === module.id);
    
    if (moduleIndex > -1) {
      // Toggle le statut du module existant
      const currentModule = updatedTenant.modules[moduleIndex];
      if (currentModule && currentModule.pivot) {
        updatedTenant.modules[moduleIndex] = {
          ...currentModule,
          pivot: {
            tenant_id: currentModule.pivot.tenant_id || tenant.id,
            module_id: currentModule.pivot.module_id || module.id,
            is_active: !currentModule.pivot.is_active
          }
        };
      }
    } else {
      // Ajouter le nouveau module
      updatedTenant.modules.push({
        ...module,
        pivot: {
          tenant_id: tenant.id,
          module_id: module.id,
          is_active: true
        }
      });
    }

    this.tenants[tenantIndex] = updatedTenant;
    console.log('Module géré dans la base de données:', {
      tenant: tenant.name,
      module: module.name,
      action: moduleIndex > -1 ? 'Statut modifié' : 'Module ajouté'
    });
  }

  isModuleAssigned(tenant: Tenant | null, module: Module): boolean {
    if (!tenant || !tenant.modules) {
      return false;
    }
    return tenant.modules.some(m => m.id === module.id);
  }

  isModuleActive(tenant: Tenant | null, module: Module): boolean {
    if (!tenant || !tenant.modules) {
      return false;
    }
    const tenantModule = tenant.modules.find(m => m.id === module.id);
    return tenantModule?.pivot?.is_active ?? false;
  }

  // Status management
  toggleTenantStatus(tenant: Tenant): void {
    const newStatus = tenant.subscription_status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    
    this.loading = true;
    this.cdr.detectChanges();
    
    this.tenantService.updateTenant(tenant.id, { subscription_status: newStatus }).subscribe({
      next: (response: ApiResponse<Tenant>) => {
        const index = this.tenants.findIndex(t => t.id === tenant.id);
        if (index !== -1) {
          this.tenants[index] = response.data;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error updating tenant status:', error);
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

  // Module management for tenant
  toggleModuleForTenant(tenant: Tenant | null, module: Module): void {
    if (!tenant) return;
    
    this.loading = true;
    this.cdr.detectChanges();
    
    // Toggle module activation for tenant
    const isCurrentlyActive = this.isModuleActive(tenant, module);
    
    if (isCurrentlyActive) {
      // Remove module from tenant
      this.tenantService.removeModuleFromTenant(tenant.id, module.id).subscribe({
        next: () => {
          // Update local tenant data
          if (tenant.modules) {
            tenant.modules = tenant.modules.filter(m => m.id !== module.id);
          }
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (error: any) => {
          console.error('Error removing module:', error);
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      // Add module to tenant
      this.tenantService.assignModuleToTenant(tenant.id, module.id).subscribe({
        next: () => {
          // Update local tenant data
          if (!tenant.modules) {
            tenant.modules = [];
          }
          tenant.modules.push({
            ...module,
            pivot: { 
              tenant_id: tenant.id,
              module_id: module.id,
              is_active: true 
            }
          });
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (error: any) => {
          console.error('Error adding module:', error);
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  // Filter and search
  applyFilters(): void {
    const search = this.filterForm.get('search')?.value?.toLowerCase() || '';
    const status = this.filterForm.get('status')?.value || 'ALL';

    // Logique de filtrage à implémenter
    console.log('Applying filters:', { search, status });
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      status: 'ALL'
    });
    this.loadTenants();
  }
}
