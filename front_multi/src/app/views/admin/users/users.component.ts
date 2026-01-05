import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { IconDirective } from '@coreui/icons-angular';
import { CardModule, ButtonModule, FormModule, AlertModule, GridModule, ModalModule, TableModule, BadgeModule, ButtonGroupModule } from '@coreui/angular';
import { UserService, UserProfile, ModulePermission, CreateUserRequest, UpdateUserRequest } from '../../../core/services/user.service';
import { TenantService, Tenant, ApiResponse } from '../../../core/services/tenant.service';

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
export class UsersComponent implements OnInit {
  users: UserProfile[] = [];
  tenants: Tenant[] = [];
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

  constructor(
    private userService: UserService,
    private tenantService: TenantService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForms();
    this.availableModules = this.userService.getAvailableModules();
  }

  ngOnInit(): void {
    this.loadUsers();
    this.loadTenants();
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
    this.cdr.detectChanges();

    this.userService.getUsers().subscribe({
      next: (response: ApiResponse<any>) => {
        this.users = response.data?.data || [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.users = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadTenants(): void {
    this.tenantService.getTenants().subscribe({
      next: (response: ApiResponse<Tenant[]>) => {
        this.tenants = Array.isArray(response.data) ? response.data : [];
      },
      error: (error) => {
        console.error('Error loading tenants:', error);
        this.tenants = [];
      }
    });
  }

  // Form getters
  get f() {
    return this.userForm.controls;
  }

  get modulePermissionsArray(): FormArray {
    return this.userForm.get('module_permissions') as FormArray;
  }

  // User CRUD operations
  openUserModal(user?: UserProfile): void {
    this.editMode = !!user;
    this.selectedUser = user || null;
    
    if (user) {
      this.userForm.patchValue({
        name: user.name,
        email: user.email,
        tenant_id: user.tenant_id || '',
        role: user.roles[0]?.name || 'USER'
      });
      // Remove password validation for edit mode
      this.userForm.get('password')?.clearValidators();
    } else {
      this.userForm.reset({
        name: '',
        email: '',
        password: '',
        tenant_id: '',
        role: 'USER'
      });
      // Add password validation for create mode
      this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
    }
    
    this.userForm.get('password')?.updateValueAndValidity();
    this.submitted = false;
    this.userModalOpen = true;
    this.cdr.detectChanges();
  }

  closeUserModal(): void {
    this.userModalOpen = false;
    this.editMode = false;
    this.selectedUser = null;
    this.userForm.reset();
    this.submitted = false;
  }

  onSubmit(): void {
    this.submitted = true;
    this.cdr.detectChanges();

    if (this.userForm.invalid) {
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    if (this.editMode && this.selectedUser) {
      this.updateUser();
    } else {
      this.createUser();
    }
  }

  private createUser(): void {
    const userData: CreateUserRequest = {
      name: this.userForm.value.name,
      email: this.userForm.value.email,
      password: this.userForm.value.password,
      tenant_id: this.userForm.value.tenant_id || undefined,
      role: this.userForm.value.role
    };

    this.userService.createUser(userData).subscribe({
      next: (response: ApiResponse<UserProfile>) => {
        this.users.push(response.data);
        this.closeUserModal();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error creating user:', error);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private updateUser(): void {
    if (!this.selectedUser) return;

    const userData: UpdateUserRequest = {
      name: this.userForm.value.name,
      email: this.userForm.value.email,
      tenant_id: this.userForm.value.tenant_id || undefined,
      role: this.userForm.value.role
    };

    if (this.userForm.value.password) {
      userData.password = this.userForm.value.password;
    }

    this.userService.updateUser(this.selectedUser.id, userData).subscribe({
      next: (response: ApiResponse<UserProfile>) => {
        const index = this.users.findIndex(u => u.id === this.selectedUser!.id);
        if (index !== -1) {
          this.users[index] = response.data;
        }
        this.closeUserModal();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error updating user:', error);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Delete user
  deleteUser(user: UserProfile): void {
    this.userToDelete = user;
    this.deleteModalOpen = true;
  }

  confirmDelete(): void {
    if (!this.userToDelete) return;

    this.loading = true;
    this.cdr.detectChanges();

    this.userService.deleteUser(this.userToDelete.id).subscribe({
      next: () => {
        this.users = this.users.filter(u => u.id !== this.userToDelete!.id);
        this.cancelDelete();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error deleting user:', error);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  cancelDelete(): void {
    this.deleteModalOpen = false;
    this.userToDelete = null;
  }

  // Permission management
  openPermissionModal(user: UserProfile): void {
    this.selectedUserForPermissions = user;
    this.permissionModalOpen = true;
    this.loadUserModulePermissions(user);
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
    // The permissions are already updated in togglePermission
    // Just close the modal
    this.closeRoleModal();
  }

  private loadUserModulePermissions(user: UserProfile): void {
    // Initialize with available modules
    this.availableModules = this.userService.getAvailableModules();
    
    // If user has existing permissions, merge them
    if (user.module_permissions) {
      user.module_permissions.forEach(userPerm => {
        const moduleIndex = this.availableModules.findIndex(m => m.module_code === userPerm.module_code);
        if (moduleIndex !== -1) {
          this.availableModules[moduleIndex] = { ...userPerm };
        }
      });
    }
    this.cdr.detectChanges();
  }

  toggleModuleAccess(module: ModulePermission): void {
    module.is_active = !module.is_active;
    if (!module.is_active) {
      module.permissions = [];
    }
    this.cdr.detectChanges();
  }

  togglePermission(module: ModulePermission, permission: string): void {
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

  hasPermission(module: ModulePermission, permission: string): boolean {
    return module.permissions?.includes(permission) || false;
  }

  savePermissions(): void {
    if (!this.selectedUserForPermissions) return;

    this.loading = true;
    this.cdr.detectChanges();

    const activeModules = this.availableModules.filter(m => m.is_active);
    
    this.userService.updateUserModulePermissions(this.selectedUserForPermissions.id, activeModules).subscribe({
      next: () => {
        // Update user in the list
        const userIndex = this.users.findIndex(u => u.id === this.selectedUserForPermissions!.id);
        if (userIndex !== -1) {
          this.users[userIndex].module_permissions = activeModules;
        }
        this.closePermissionModal();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error updating permissions:', error);
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
    const tenant = this.tenants.find(t => t.id === tenantId);
    return tenant?.name || 'Aucun tenant';
  }

  getUserModuleCount(user: UserProfile): number {
    return user.module_permissions?.filter(m => m.is_active).length || 0;
  }

  // Filter methods
  applyFilters(): void {
    const search = this.filterForm.get('search')?.value?.toLowerCase() || '';
    const role = this.filterForm.get('role')?.value || 'ALL';
    const tenantId = this.filterForm.get('tenant_id')?.value || 'ALL';

    // Implementation for filtering
    console.log('Applying filters:', { search, role, tenantId });
    this.loadUsers(); // For now, just reload
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      role: 'ALL',
      tenant_id: 'ALL'
    });
    this.loadUsers();
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
}
