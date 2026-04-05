import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { IconDirective } from '@coreui/icons-angular';
import { CardModule, ButtonModule, FormModule, AlertModule, GridModule, ModalModule, TableModule, BadgeModule, ButtonGroupModule } from '@coreui/angular';
import { UserService, UserProfile, ModulePermission, CreateUserRequest, UpdateUserRequest } from '../../../core/services/user.service';
import { TenantService } from '../../../core/services/tenant.service';
import { Tenant, ApiResponse } from '../../../core/models/tenant.model';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IconDirective,
    CardModule,
    ButtonModule,
    FormModule,
    AlertModule,
    GridModule,
    ModalModule,
    TableModule,
    BadgeModule,
    ButtonGroupModule
  ],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnInit, AfterViewInit {
  users: UserProfile[] = [];
  filteredUsers: UserProfile[] = [];
  organisations: Tenant[] = [];
  loading = false;
  submitted = false;
  editMode = false;
  selectedUser: UserProfile | null = null;
  
  // Modal states
  userModalOpen = false;
  permissionModalOpen = false;
  roleModalOpen = false;
  deleteModalOpen = false;
  userToDelete: UserProfile | null = null;
  selectedUserForPermissions: UserProfile | null = null;
  selectedModuleForRoles: ModulePermission | null = null;

  // Forms
  userForm!: FormGroup;
  filterForm!: FormGroup;

  // Available data
  availableRoles = ['SUPER_ADMIN', 'ADMIN', 'USER', 'VIEWER'];
  availableModules: ModulePermission[] = [];
  filteredTenants: Tenant[] = [];
  tenants: Tenant[] = [];

  // Form controls getter
  get f() { return this.userForm.controls; }

  constructor(
    private userService: UserService,
    private tenantService: TenantService,
    private authService: AuthService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private alertService: AlertService
  ) {
    this.initializeForms();
    this.availableModules = this.userService.getAvailableModules();
  }

  ngOnInit(): void {
    // Initialize data structures to avoid NG0100 error
    this.filteredTenants = [];
    this.organisations = [];
  }

  ngAfterViewInit(): void {
    // Load async data after view initialization to prevent ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.loadOrganisations();
      this.loadUsers();
    });
  }

  private initializeForms(): void {
    this.userForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(150)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      tenant_id: [''],
      role: ['USER', Validators.required],
      module_permissions: this.fb.array([])
    });

    this.filterForm = this.fb.group({
      search: [''],
      role: ['ALL'],
      tenant_id: ['ALL']
    });
  }

  // Data loading methods
  loadUsers(): void {
    this.loading = true;

    this.userService.getUsers().subscribe({
      next: (response: ApiResponse<any>) => {
        setTimeout(() => {
          this.users = response.data?.data || [];
          this.filteredUsers = [...this.users];
          this.loading = false;
          
          // Load module permissions for each user après la mise à jour initiale
          this.loadUsersModulePermissions();
          
          this.cdr.detectChanges();
        }, 0);
      },
      error: (error) => {
        console.error('Error loading users:', error);
        setTimeout(() => {
          this.users = [];
          this.filteredUsers = [];
          this.loading = false;
          this.showErrorMessage('Erreur lors du chargement des utilisateurs.');
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  private loadUsersModulePermissions(): void {
    this.users.forEach(user => {
      this.userService.getUserModulePermissions(user.id).subscribe({
        next: (response: ApiResponse<ModulePermission[]>) => {
          // Utiliser setTimeout pour éviter l'erreur ExpressionChangedAfterItHasBeenCheckedError
          setTimeout(() => {
            user.module_permissions = response.data || [];
            this.cdr.detectChanges();
          }, 0);
        },
        error: (error) => {
          console.error(`Error loading module permissions for user ${user.id}:`, error);
          setTimeout(() => {
            user.module_permissions = [];
            this.cdr.detectChanges();
          }, 0);
        }
      });
    });
  }

  loadOrganisations(): void {
    this.tenantService.getTenants().subscribe({
      next: (response: ApiResponse<any>) => {
        // tenants returns direct array or paginated response.data
        if (response.success && Array.isArray(response.data)) {
          this.organisations = response.data;
        } else if (response.data?.data && Array.isArray(response.data.data)) {
          // Fallback for paginated response
          this.organisations = response.data.data;
        } else {
          this.organisations = [];
        }
        this.filteredTenants = [...this.organisations];
        console.log('Organisations loaded:', this.organisations.length, 'tenants');
        // Force change detection after async operation
        setTimeout(() => {
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        console.error('Error loading organisations:', error);
        this.organisations = [];
        this.filteredTenants = [];
        setTimeout(() => {
          this.cdr.detectChanges();
        });
      }
    });
  }

  onRoleChange(event: any): void {
    const selectedRole = event.target.value;
    this.filterTenantsByRole(selectedRole);
    
    // Reset tenant selection when role changes
    this.userForm.patchValue({ tenant_id: '' });
  }

  private filterTenantsByRole(role: string): void {
    if (role === 'SUPER_ADMIN') {
      // Super admin doesn't need a tenant
      this.filteredTenants = [];
      this.userForm.get('tenant_id')?.disable();
    } else if (role === 'ADMIN' || role === 'USER' || role === 'VIEWER') {
      // These roles need a tenant
      this.filteredTenants = [...this.organisations];
      this.userForm.get('tenant_id')?.enable();
    } else {
      this.filteredTenants = [...this.organisations];
      this.userForm.get('tenant_id')?.enable();
    }
    this.cdr.detectChanges();
  }

  // User management
  openUserModal(user?: UserProfile): void {
    setTimeout(() => {
      this.editMode = !!user;
      this.selectedUser = user || null;

      if (this.editMode && user) {
        // Edit mode - populate form with user data
        this.userForm.patchValue({
          name: user.name,
          email: user.email,
          tenant_id: user.tenant_id,
          role: user.role || 'USER'
        });

        // Filter tenants based on current role
        this.filterTenantsByRole(user.role || 'USER');

        // Remove password validation for edit mode
        this.userForm.get('password')?.clearValidators();
      } else {
        // Create mode - reset form
        this.userForm.reset({
          name: '',
          email: '',
          password: '',
          tenant_id: '',
          role: 'USER'
        });

        // Filter tenants for default role (USER)
        this.filterTenantsByRole('USER');

        // Add password validation for create mode
        this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
      }

      this.userForm.get('password')?.updateValueAndValidity();
      this.submitted = false;
      this.userModalOpen = true;
      this.cdr.detectChanges();
    }, 0);
  }

  closeUserModal(): void {
    this.userModalOpen = false;
    this.editMode = false;
    this.selectedUser = null;
    this.userForm.reset();
    this.submitted = false;
  }

  onSubmitUser(): void {
    this.submitted = true;
    this.cdr.detectChanges();

    if (this.userForm.invalid) {
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    const userData = {
      name: this.userForm.value.name,
      email: this.userForm.value.email,
      tenant_id: this.userForm.value.tenant_id || null,
      role: this.userForm.value.role
    };

    if (this.editMode && this.selectedUser) {
      // Update user
      const updateData: UpdateUserRequest = userData;
      if (this.userForm.value.password) {
        updateData.password = this.userForm.value.password;
      }

      this.userService.updateUser(this.selectedUser.id, updateData).subscribe({
        next: (response: ApiResponse<UserProfile>) => {
          const index = this.users.findIndex(u => u.id === this.selectedUser!.id);
          if (index !== -1) {
            this.users[index] = response.data;
            this.users = [...this.users];
          }
          this.closeUserModal();
          this.applyFilters();
          this.showSuccessMessage('Utilisateur modifié avec succès!');
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error updating user:', error);
          this.showErrorMessage('Erreur lors de la modification de l\'utilisateur.');
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      // Create user
      const createData: CreateUserRequest = {
        ...userData,
        password: this.userForm.value.password
      };

      this.userService.createUser(createData).subscribe({
        next: (response: ApiResponse<UserProfile>) => {
          this.users.push(response.data);
          this.users = [...this.users];
          this.closeUserModal();
          this.applyFilters();
          this.showSuccessMessage('Utilisateur créé avec succès!');
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error creating user:', error);
          this.showErrorMessage('Erreur lors de la création de l\'utilisateur.');
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  // Delete user
  deleteUser(user: UserProfile): void {
    this.alertService.showDeleteConfirmation(user.name, 'l\'utilisateur').then((result) => {
      if (result.isConfirmed) {
        this.confirmDelete(user);
      }
    });
  }

  confirmDelete(user: UserProfile): void {
    this.loading = true;
    this.cdr.detectChanges();

    this.userService.deleteUser(user.id).subscribe({
      next: () => {
        this.users = this.users.filter(u => u.id !== user.id);
        this.applyFilters();
        this.alertService.showSuccess('Succès!', 'Utilisateur supprimé avec succès!');
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error deleting user:', error);
        this.alertService.showError('Erreur!', 'Erreur lors de la suppression de l\'utilisateur.');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Permission management
  openPermissionModal(user: UserProfile): void {
    this.selectedUserForPermissions = user;
    this.permissionModalOpen = true;
    
    // Load tenant modules first, then user permissions
    if (user.tenant_id) {
      this.loadTenantModulesAndUserPermissions(user);
    } else {
      this.loadUserModulePermissions(user);
    }
  }

  closePermissionModal(): void {
    this.permissionModalOpen = false;
    this.selectedUserForPermissions = null;
  }

  // Role modal management
  openRoleModal(module: ModulePermission): void {
    this.selectedModuleForRoles = module;
    this.roleModalOpen = true;
  }

  closeRoleModal(): void {
    this.roleModalOpen = false;
    this.selectedModuleForRoles = null;
  }

  saveRolePermissions(): void {
    this.closeRoleModal();
  }

  private loadTenantModulesAndUserPermissions(user: UserProfile): void {
    this.loading = true;
    this.cdr.detectChanges();

    // First, load modules activated for the tenant
    this.tenantService.getTenantModules(user.tenant_id!).subscribe({
      next: (tenantResponse: ApiResponse<any>) => {
        const tenantModules = tenantResponse.data || [];
        console.log('Tenant modules loaded:', tenantModules.length, 'modules');
        
        // Then, load user's module permissions
        this.userService.getUserModulePermissions(user.id).subscribe({
          next: (userResponse: ApiResponse<ModulePermission[]>) => {
            // Start with all available modules
            let modules = userResponse.data || this.userService.getAvailableModules();
            
            // Filter to show only modules activated for the tenant
            this.availableModules = modules.filter((module: ModulePermission) => 
              tenantModules.some((tm: any) => tm.code === module.module_code)
            );
            
            console.log('Filtered modules for tenant:', this.availableModules.length, 'modules');
            this.loading = false;
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Error loading user module permissions:', error);
            // Fallback: show all tenant modules
            this.availableModules = tenantModules.map((tm: any) => ({
              module_code: tm.code,
              module_name: tm.name,
              is_active: false,
              permissions: []
            }));
            this.loading = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: (error) => {
        console.error('Error loading tenant modules:', error);
        // Fallback: load user permissions without tenant filtering
        this.loadUserModulePermissions(user);
      }
    });
  }

  private loadTenantModules(tenantId: number): void {
    // Load modules activated for the tenant
    this.tenantService.getTenantModules(tenantId).subscribe({
      next: (response: ApiResponse<any>) => {
        // Get tenant modules from response
        const tenantModules = response.data || [];
        console.log('Tenant modules loaded:', tenantModules.length, 'modules');
        
        // Filter availableModules to show only tenant's activated modules
        this.availableModules = this.availableModules.filter(module => 
          tenantModules.some((tm: any) => tm.code === module.module_code)
        );
        
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading tenant modules:', error);
        // If error, show all modules as fallback
      }
    });
  }

  private loadUserModulePermissions(user: UserProfile): void {
    this.loading = true;
    this.cdr.detectChanges();

    this.userService.getUserModulePermissions(user.id).subscribe({
      next: (response: ApiResponse<ModulePermission[]>) => {
        this.availableModules = response.data || this.userService.getAvailableModules();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading user module permissions:', error);
        this.availableModules = this.userService.getAvailableModules();

        if (user.module_permissions) {
          user.module_permissions.forEach(userPerm => {
            const moduleIndex = this.availableModules.findIndex(m => m.module_code === userPerm.module_code);
            if (moduleIndex !== -1) {
              this.availableModules[moduleIndex] = { ...userPerm };
            }
          });
        }
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  savePermissions(): void {
    if (!this.selectedUserForPermissions) return;

    this.loading = true;
    this.cdr.detectChanges();

    const activeModules = this.availableModules.filter(m => m.is_active);

    this.userService.updateUserModulePermissions(this.selectedUserForPermissions.id, activeModules).subscribe({
      next: () => {
        const userIndex = this.users.findIndex(u => u.id === this.selectedUserForPermissions!.id);
        if (userIndex !== -1) {
          this.users[userIndex].module_permissions = [...activeModules];
        }

        this.loadUserModulePermissions(this.selectedUserForPermissions!);
        this.applyFilters();
        this.closePermissionModal();
        this.showSuccessMessage('Permissions mises à jour avec succès!');
        
        // If the current user's permissions were updated, reload their data to refresh the menu
        const currentUser = this.authService.currentUser;
        if (currentUser && Number(currentUser.id) === this.selectedUserForPermissions!.id) {
          console.log('Reloading current user data to refresh menu...');
          this.authService.reloadCurrentUser().subscribe({
            next: () => {
              console.log('Current user data reloaded, menu should refresh');
              this.cdr.detectChanges();
            },
            error: (err: any) => {
              console.error('Error reloading current user:', err);
            }
          });
        }
        
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error updating permissions:', error);
        this.showErrorMessage('Erreur lors de la mise à jour des permissions.');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Utility methods
  getRoleDisplayName(role: string): string {
    return this.userService.getRoleDisplayName(role);
  }

  getPermissionDisplayName(permission: string): string {
    return this.userService.getPermissionDisplayName(permission);
  }

  getRoleBadgeColor(role: string): string {
    const colors: { [key: string]: string } = {
      'SUPER_ADMIN': 'danger',
      'ADMIN': 'warning',
      'USER': 'primary',
      'VIEWER': 'secondary'
    };
    return colors[role] || 'secondary';
  }

  getTenantName(tenantId: number): string {
    const organisation = this.organisations.find(t => t.id === tenantId);
    return organisation?.name || 'Aucune organisation';
  }

  getUserModuleCount(user: UserProfile): number {
    return user.module_permissions?.filter(m => m.is_active).length || 0;
  }

  // Filter methods
  applyFilters(): void {
    const search = this.filterForm.get('search')?.value?.toLowerCase() || '';
    const role = this.filterForm.get('role')?.value || 'ALL';
    const tenantId = this.filterForm.get('tenant_id')?.value || 'ALL';

    this.filteredUsers = this.users.filter(user => {
      const matchesSearch = !search ||
        user.name.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search);

      const matchesRole = role === 'ALL' ||
        user.role === role;

      const matchesTenant = tenantId === 'ALL' ||
        user.tenant_id?.toString() === tenantId;

      return matchesSearch && matchesRole && matchesTenant;
    });

    this.cdr.detectChanges();
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      role: 'ALL',
      tenant_id: 'ALL'
    });
    this.filteredUsers = [...this.users];
    this.cdr.detectChanges();
  }

  // Get available permissions for a specific module
  getAvailablePermissionsForModule(moduleCode?: string): string[] {
    const basePermissions = ['view', 'create', 'edit', 'delete'];

    if (!moduleCode) return basePermissions;

    switch (moduleCode) {
      case 'FINANCE':
        return [...basePermissions, 'approve'];
      case 'PRODUCTS_STOCK':
        return [...basePermissions, 'manage_stock'];
      case 'CONTAINERS':
        return [...basePermissions, 'track'];
      case 'RENTAL':
        return [...basePermissions, 'manage_contracts'];
      case 'TAXI':
        return [...basePermissions, 'assign_drivers'];
      case 'STATISTICS':
        return ['view', 'export'];
      default:
        return basePermissions;
    }
  }

  // Message handling with AlertService
  showSuccessMessage(message: string): void {
    this.alertService.showSuccess('Succès!', message);
  }

  showErrorMessage(message: string): void {
    this.alertService.showError('Erreur!', message);
  }

  toggleModuleAccess(module: ModulePermission): void {
    module.is_active = !module.is_active;
    if (!module.is_active) {
      module.permissions = [];
    }
    this.cdr.detectChanges();
  }

  togglePermission(module: ModulePermission | null, permission: string): void {
    if (!module) {
      return;
    }
    
    if (!module.permissions) {
      module.permissions = [];
    }
    
    const index = module.permissions.indexOf(permission);
    if (index > -1) {
      module.permissions.splice(index, 1);
    } else {
      module.permissions.push(permission);
    }
    this.cdr.detectChanges();
  }

  hasPermission(module: ModulePermission | null, permission: string): boolean {
    if (!module || !module.permissions) {
      return false;
    }
    return module.permissions.includes(permission);
  }
}
