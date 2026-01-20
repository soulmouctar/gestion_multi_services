import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TenantService, Tenant, Module, ApiResponse } from '../../../core/services/tenant.service';
import { IconDirective } from '@coreui/icons-angular';
import { 
  ButtonModule, 
  ButtonGroupModule, 
  CardModule, 
  FormModule, 
  TableModule, 
  BadgeModule, 
  ModalModule,
  AlertModule 
} from '@coreui/angular';

@Component({
  selector: 'app-tenants',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IconDirective,
    ButtonModule,
    ButtonGroupModule,
    CardModule,
    FormModule,
    TableModule,
    BadgeModule,
    ModalModule,
    AlertModule
    ],
  templateUrl: './tenants.component.html',
  styleUrls: ['./tenants.component.scss']
})
export class TenantsComponent implements OnInit {
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

  organisationForm: FormGroup;
  filterForm: FormGroup;

  
  constructor(
    private tenantService: TenantService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.organisationForm = this.fb.group({
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
    this.loadOrganisations();
    this.loadModules();
  }

  loadOrganisations(): void {
    this.loading = true;
    this.cdr.detectChanges();
    
    this.tenantService.getTenants().subscribe({
      next: (response: ApiResponse<any>) => {
        console.log('Organisation API response:', response);
        // L'API retourne une structure paginée: response.data.data
        if (response.data && response.data.data && Array.isArray(response.data.data)) {
          this.organisations = response.data.data;
        } else if (Array.isArray(response.data)) {
          this.organisations = response.data;
        } else {
          this.organisations = [];
        }
        console.log('Organisations loaded:', this.organisations);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading organisations from database:', error);
        // En cas d'erreur, afficher un tableau vide
        this.organisations = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadModules(): void {
    // Charger les modules depuis la base de données via l'API
    this.tenantService.getModules().subscribe({
      next: (response: ApiResponse<any>) => {
        // Adapter la structure des modules de la base de données
        this.modules = (response.data?.data || []).map((module: any) => ({
          id: module.id,
          code: module.code,
          name: module.name,
          icon: this.getModuleIcon(module.code),
          enabled: module.is_active || true
        }));
        console.log('Modules chargés depuis la base de données:', this.modules);
        // Force change detection after async operation
        setTimeout(() => {
          this.cdr.detectChanges();
        }, 0);
      },
      error: (error) => {
        console.error('Erreur lors du chargement des modules:', error);
        // Fallback vers les modules par défaut en cas d'erreur
        this.modules = [
          { id: 1, code: 'COMMERCE', name: 'Module Commerce', icon: 'cil-cart', enabled: true },
          { id: 2, code: 'CONTAINER', name: 'Module Conteneurs', icon: 'cil-truck', enabled: true },
          { id: 3, code: 'IMMOBILIER', name: 'Module Immobilier', icon: 'cil-home', enabled: true },
          { id: 4, code: 'TAXI', name: 'Module Taxi', icon: 'cil-car-alt', enabled: true },
          { id: 5, code: 'FINANCE', name: 'Module Finance', icon: 'cil-dollar', enabled: true },
          { id: 6, code: 'STATISTICS', name: 'Module Statistiques', icon: 'cil-chart-pie', enabled: true }
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
      'CONTAINER': 'cil-truck',
      'IMMOBILIER': 'cil-home',
      'TAXI': 'cil-car-alt',
      'FINANCE': 'cil-dollar',
      'STATISTICS': 'cil-chart-pie',
      'COMMERCIAL': 'cil-cart',
      'CONTAINERS': 'cil-truck',
      'RENTAL': 'cil-home'
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

  private createOrganisation(): void {
    // Utiliser le vrai backend pour créer le tenant dans la base de données
    this.tenantService.createTenant(this.organisationForm.value).subscribe({
      next: (response: ApiResponse<Tenant>) => {
        // S'assurer que this.organisations est un tableau avant d'utiliser push
        if (!Array.isArray(this.organisations)) {
          this.organisations = [];
        }
        
        this.organisations.push(response.data);
        console.log('Organisation créée dans la base de données MySQL:', response.data);
        this.resetForm();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error creating organisation in database:', error);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private updateOrganisation(): void {
    if (!this.selectedOrganisation) return;

    // Utiliser le vrai backend pour mettre à jour le tenant dans la base de données
    this.tenantService.updateTenant(this.selectedOrganisation.id, this.organisationForm.value).subscribe({
      next: (response: ApiResponse<Tenant>) => {
        const index = this.organisations.findIndex(t => t.id === this.selectedOrganisation!.id);
        if (index !== -1) {
          this.organisations[index] = response.data;
          console.log('Organisation mise à jour dans la base de données MySQL:', response.data);
        }
        
        this.resetForm();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error updating organisation in database:', error);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  editOrganisation(organisation: Tenant): void {
    this.editMode = true;
    this.selectedOrganisation = organisation;
    this.organisationForm.patchValue({
      name: organisation.name,
      email: organisation.email,
      phone: organisation.phone,
      subscription_status: organisation.subscription_status
    });
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
    this.tenantService.deleteTenant(this.organisationToDelete.id).subscribe({
      next: () => {
        // S'assurer que this.organisations est un tableau avant d'utiliser filter
        if (!Array.isArray(this.organisations)) {
          this.organisations = [];
        }
        
        this.organisations = this.organisations.filter(t => t.id !== this.organisationToDelete!.id);
        console.log('Organisation supprimée de la base de données MySQL:', this.organisationToDelete);
        this.cancelDelete();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error deleting organisation from database:', error);
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
      subscription_status: 'ACTIVE'
    });
    this.editMode = false;
    this.selectedOrganisation = null;
    this.submitted = false;
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

  toggleModule(organisation: Tenant, module: Module): void {
    // Simuler la gestion des modules dans la base de données
    const organisationIndex = this.organisations.findIndex(t => t.id === organisation.id);
    if (organisationIndex === -1) return;

    const updatedOrganisation = { ...this.organisations[organisationIndex] };
    
    // S'assurer que modules est défini
    if (!updatedOrganisation.modules) {
      updatedOrganisation.modules = [];
    }
    
    // Vérifier si le module est déjà assigné
    const moduleIndex = updatedOrganisation.modules.findIndex(m => m.id === module.id);
    
    if (moduleIndex > -1) {
      // Toggle le statut du module existant
      const currentModule = updatedOrganisation.modules[moduleIndex];
      if (currentModule && currentModule.pivot) {
        updatedOrganisation.modules[moduleIndex] = {
          ...currentModule,
          pivot: {
            tenant_id: currentModule.pivot.tenant_id || organisation.id,
            module_id: currentModule.pivot.module_id || module.id,
            is_active: !currentModule.pivot.is_active
          }
        };
      }
    } else {
      // Ajouter le nouveau module
      updatedOrganisation.modules.push({
        ...module,
        pivot: {
          tenant_id: organisation.id,
          module_id: module.id,
          is_active: true
        }
      });
    }

    this.organisations[organisationIndex] = updatedOrganisation;
    console.log('Module géré dans la base de données:', {
      organisation: organisation.name,
      module: module.name,
      action: moduleIndex > -1 ? 'Statut modifié' : 'Module ajouté'
    });
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
    
    this.tenantService.updateTenant(organisation.id, { subscription_status: newStatus }).subscribe({
      next: (response: ApiResponse<Tenant>) => {
        const index = this.organisations.findIndex(t => t.id === organisation.id);
        if (index !== -1) {
          this.organisations[index] = response.data;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error updating organisation status:', error);
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
      this.tenantService.removeModuleFromTenant(organisation.id, module.id).subscribe({
        next: () => {
          // Update local organisation data
          if (organisation.modules) {
            organisation.modules = organisation.modules.filter(m => m.id !== module.id);
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
      // Add module to organisation
      this.tenantService.assignModuleToTenant(organisation.id, module.id).subscribe({
        next: () => {
          // Update local organisation data
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
    this.loadOrganisations();
  }
}
