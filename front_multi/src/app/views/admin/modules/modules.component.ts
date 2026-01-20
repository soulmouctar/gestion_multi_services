import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModuleService, Module, ApiResponse } from '../../../core/services/module.service';
import Swal from 'sweetalert2';
import { AlertService } from '../../../core/services/alert.service';
import { 
  CardModule, 
  ButtonModule, 
  TableModule, 
  ModalModule, 
  FormModule, 
  BadgeModule,
  ButtonGroupModule,
  SpinnerModule,
  AlertModule
} from '@coreui/angular';
import { IconModule } from '@coreui/icons-angular';

@Component({
  selector: 'app-modules',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule,
    CardModule, 
    ButtonModule, 
    TableModule, 
    ModalModule, 
    FormModule, 
    BadgeModule,
    ButtonGroupModule,
    SpinnerModule,
    AlertModule,
    IconModule
  ],
  templateUrl: './modules.component.html',
  styleUrls: ['./modules.component.scss']
})
export class ModulesComponent implements OnInit {
  modules: Module[] = [];
  filteredModules: Module[] = [];
  activeModules: Module[] = [];
  loading = false;
  loadingModules = false;
  submitted = false;
  editMode = false;
  selectedModule: Module | null = null;
  
  // Messages and notifications (maintenant gérés par SweetAlert2)
  
  // Modal states
  moduleModalOpen = false;
  deleteModalOpen = false;
  moduleToDelete: Module | null = null;
  
  // Forms
  moduleForm!: FormGroup;
  filterForm!: FormGroup;
  
  // Available data
  availableIcons = [
    'chart-line', 'dollar-sign', 'people', 'basket', 
    'layers', 'home', 'car', 'graph'
  ];
  
  availablePermissions = [
    'view', 'create', 'edit', 'delete', 'approve', 
    'manage_stock', 'track', 'manage_contracts', 
    'assign_drivers', 'export'
  ];

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private moduleService: ModuleService,
    private alertService: AlertService
  ) {
    // Initialisation explicite des tableaux
    this.modules = [];
    this.filteredModules = [];
    this.activeModules = [];
    this.initializeForms();
  }

  ngOnInit(): void {
    // S'assurer que les tableaux sont initialisés avant de charger
    this.modules = [];
    this.filteredModules = [];
    this.loadModules();
  }

  private initializeForms(): void {
    this.moduleForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      code: ['', [Validators.required, Validators.maxLength(50)]],
      description: ['', [Validators.maxLength(255)]],
      icon: ['chart-line', Validators.required],
      is_active: [true],
      permissions: [['view'], Validators.required]
    });

    this.filterForm = this.fb.group({
      search: [''],
      status: ['ALL']
    });
  }

  // Data loading
  loadModules(): void {
    this.loading = true;
    this.cdr.detectChanges();
    
    this.moduleService.getModules().subscribe({
      next: (response: any) => {
        // L'API retourne une structure paginée avec data.data
        this.modules = response.data?.data || response.data || [];
        this.loading = false;
        setTimeout(() => {
          this.applyFilters();
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        console.error('Error loading modules:', error);
        this.modules = [];
        this.filteredModules = [];
        this.showErrorMessage('Erreur lors du chargement des modules.');
        this.loading = false;
        setTimeout(() => {
          this.cdr.detectChanges();
        });
      }
    });
  }

  // Module management
  openModuleModal(module?: Module): void {
    this.editMode = !!module;
    this.selectedModule = module || null;
    
    if (module) {
      this.moduleForm.patchValue({
        name: module.name,
        code: module.code,
        description: module.description,
        icon: module.icon,
        is_active: module.is_active,
        permissions: module.permissions
      });
    } else {
      this.moduleForm.reset({
        name: '',
        code: '',
        description: '',
        icon: 'chart-line',
        is_active: true,
        permissions: ['view']
      });
    }
    
    this.moduleModalOpen = true;
    this.submitted = false;
  }

  closeModuleModal(): void {
    this.moduleModalOpen = false;
    this.selectedModule = null;
    this.editMode = false;
    this.submitted = false;
  }

  saveModule(): void {
    this.submitted = true;
    
    if (this.moduleForm.valid) {
      this.loading = true;
      this.cdr.detectChanges();
      
      const formData = this.moduleForm.value;
      console.log('Saving module:', { editMode: this.editMode, selectedModule: this.selectedModule, formData });
      
      if (this.editMode && this.selectedModule) {
        // Update existing module
        this.moduleService.updateModule(this.selectedModule.id, formData).subscribe({
          next: (response: ApiResponse<Module>) => {
            const index = this.modules.findIndex(m => m.id === this.selectedModule!.id);
            if (index !== -1) {
              this.modules[index] = response.data;
              this.modules = [...this.modules];
            }
            this.loading = false;
            this.closeModuleModal();
            setTimeout(() => {
              this.applyFilters();
              this.showSuccessMessage('Module modifié avec succès!');
              this.cdr.detectChanges();
            });
          },
          error: (error) => {
            console.error('Error updating module:', error);
            this.showErrorMessage('Erreur lors de la modification du module.');
            this.loading = false;
            setTimeout(() => {
              this.cdr.detectChanges();
            });
          }
        });
      } else {
        // Create new module
        this.moduleService.createModule(formData).subscribe({
          next: (response: ApiResponse<Module>) => {
            this.modules.unshift(response.data);
            this.modules = [...this.modules];
            this.loading = false;
            this.closeModuleModal();
            setTimeout(() => {
              this.applyFilters();
              this.showSuccessMessage('Module créé avec succès!');
              this.cdr.detectChanges();
            });
          },
          error: (error) => {
            console.error('Error creating module:', error);
            this.showErrorMessage('Erreur lors de la création du module.');
            this.loading = false;
            setTimeout(() => {
              this.cdr.detectChanges();
            });
          }
        });
      }
    } else {
      console.log('Form is invalid:', this.moduleForm.errors);
      this.showErrorMessage('Veuillez corriger les erreurs dans le formulaire.');
    }
  }

  // Delete module with AlertService confirmation
  openDeleteModal(module: Module): void {
    this.alertService.showDeleteConfirmation(module.name, 'le module').then((result) => {
      if (result.isConfirmed) {
        this.confirmDelete(module);
      }
    });
  }

  // Méthodes obsolètes supprimées - maintenant géré par SweetAlert2

  confirmDelete(module: Module): void {
    this.loading = true;
    this.cdr.detectChanges();
    
    this.moduleService.deleteModule(module.id).subscribe({
      next: (response: ApiResponse<void>) => {
        this.modules = this.modules.filter(m => m.id !== module.id);
        this.loading = false;
        setTimeout(() => {
          this.applyFilters();
          this.showSuccessMessage('Module supprimé avec succès!');
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        console.error('Error deleting module:', error);
        this.showErrorMessage('Erreur lors de la suppression du module.');
        this.loading = false;
        setTimeout(() => {
          this.cdr.detectChanges();
        });
      }
    });
  }

  // Toggle module status with confirmation
  toggleModuleStatus(module: Module): void {
    const action = module.is_active ? 'désactiver' : 'activer';
    const actionPast = module.is_active ? 'désactivé' : 'activé';
    
    this.alertService.showConfirmation(
      'Confirmer l\'action',
      `Voulez-vous vraiment ${action} le module "${module.name}"?`,
      `Oui, ${action}!`,
      'Annuler',
      'question'
    ).then((result) => {
      if (result.isConfirmed) {
        this.confirmToggleStatus(module, actionPast);
      }
    });
  }

  private confirmToggleStatus(module: Module, actionPast: string): void {
    this.loading = true;
    this.cdr.detectChanges();
    
    const updatedData = { ...module, is_active: !module.is_active };
    
    this.moduleService.updateModule(module.id, updatedData).subscribe({
      next: (response: ApiResponse<Module>) => {
        const index = this.modules.findIndex(m => m.id === module.id);
        if (index !== -1) {
          this.modules[index] = response.data;
          this.modules = [...this.modules];
        }
        this.loading = false;
        setTimeout(() => {
          this.applyFilters();
          this.showSuccessMessage(`Module ${actionPast} avec succès!`);
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        console.error('Error toggling module status:', error);
        this.showErrorMessage('Erreur lors du changement de statut du module.');
        this.loading = false;
        setTimeout(() => {
          this.cdr.detectChanges();
        });
      }
    });
  }

  // Utility methods
  getStatusBadgeColor(isActive: boolean): string {
    return isActive ? 'success' : 'secondary';
  }

  getStatusText(isActive: boolean): string {
    return isActive ? 'ACTIF' : 'INACTIF';
  }

  getPermissionBadgeColor(permission: string): string {
    const colors: { [key: string]: string } = {
      'view': 'info',
      'create': 'success',
      'edit': 'warning',
      'delete': 'danger',
      'approve': 'primary',
      'manage_stock': 'info',
      'track': 'secondary',
      'manage_contracts': 'warning',
      'assign_drivers': 'info',
      'export': 'success'
    };
    return colors[permission] || 'secondary';
  }

  // Form helpers
  get f() { return this.moduleForm.controls; }

  isPermissionSelected(permission: string): boolean {
    const selectedPermissions = this.moduleForm.get('permissions')?.value || [];
    return selectedPermissions.includes(permission);
  }

  togglePermission(permission: string): void {
    const currentPermissions = this.moduleForm.get('permissions')?.value || [];
    const index = currentPermissions.indexOf(permission);
    
    if (index > -1) {
      currentPermissions.splice(index, 1);
    } else {
      currentPermissions.push(permission);
    }
    
    this.moduleForm.patchValue({ permissions: currentPermissions });
  }

  // Filter and search
  applyFilters(): void {
    // Vérification de sécurité pour éviter les erreurs
    if (!Array.isArray(this.modules)) {
      this.modules = [];
    }
    
    const search = this.filterForm.get('search')?.value?.toLowerCase() || '';
    const status = this.filterForm.get('status')?.value || 'ALL';
    
    this.filteredModules = this.modules.filter(module => {
      const matchesSearch = !search || 
        module.name.toLowerCase().includes(search) ||
        module.code.toLowerCase().includes(search) ||
        (module.description && module.description.toLowerCase().includes(search));
      
      const matchesStatus = status === 'ALL' || 
        (status === 'ACTIVE' && module.is_active) ||
        (status === 'INACTIVE' && !module.is_active);
      
      return matchesSearch && matchesStatus;
    });
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      status: 'ALL'
    });
    this.applyFilters();
  }

  getActiveModulesCount(): number {
    if (!Array.isArray(this.modules)) {
      return 0;
    }
    return this.modules.filter(m => m.is_active).length;
  }

  // Message handling with AlertService
  showSuccessMessage(message: string): void {
    this.alertService.showSuccess('Succès!', message);
  }

  showErrorMessage(message: string): void {
    this.alertService.showError('Erreur!', message);
  }

  dismissMessage(): void {
    // Plus nécessaire avec SweetAlert2
  }

  // Bulk operations with confirmation
  bulkActivate(): void {
    if (!Array.isArray(this.filteredModules)) {
      this.filteredModules = [];
    }
    const inactiveModules = this.filteredModules.filter(m => !m.is_active);
    if (inactiveModules.length === 0) {
      this.showErrorMessage('Aucun module inactif à activer.');
      return;
    }

    this.alertService.showConfirmation(
      'Activation en lot',
      `Voulez-vous vraiment activer ${inactiveModules.length} module(s) inactif(s)?`,
      'Oui, activer tout!',
      'Annuler',
      'question'
    ).then((result) => {
      if (result.isConfirmed) {
        this.confirmBulkActivate(inactiveModules);
      }
    });
  }

  private confirmBulkActivate(inactiveModules: Module[]): void {
    this.loading = true;
    setTimeout(() => {
      inactiveModules.forEach(module => {
        module.is_active = true;
        module.updated_at = new Date().toISOString();
      });
      this.loading = false;
      this.applyFilters();
      this.showSuccessMessage(`${inactiveModules.length} module(s) activé(s) avec succès!`);
      this.cdr.detectChanges();
    }, 1000);
  }

  bulkDeactivate(): void {
    if (!Array.isArray(this.filteredModules)) {
      this.filteredModules = [];
    }
    const activeModules = this.filteredModules.filter(m => m.is_active);
    if (activeModules.length === 0) {
      this.showErrorMessage('Aucun module actif à désactiver.');
      return;
    }

    this.alertService.showConfirmation(
      'Désactivation en lot',
      `Voulez-vous vraiment désactiver ${activeModules.length} module(s) actif(s)?`,
      'Oui, désactiver tout!',
      'Annuler',
      'warning'
    ).then((result) => {
      if (result.isConfirmed) {
        this.confirmBulkDeactivate(activeModules);
      }
    });
  }

  private confirmBulkDeactivate(activeModules: Module[]): void {
    this.loading = true;
    setTimeout(() => {
      activeModules.forEach(module => {
        module.is_active = false;
        module.updated_at = new Date().toISOString();
      });
      this.loading = false;
      this.applyFilters();
      this.showSuccessMessage(`${activeModules.length} module(s) désactivé(s) avec succès!`);
      this.cdr.detectChanges();
    }, 1000);
  }
}
