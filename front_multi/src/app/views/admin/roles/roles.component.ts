import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { CardModule, ButtonModule, FormModule, AlertModule, GridModule, ModalModule, TableModule, BadgeModule, ButtonGroupModule } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { RoleService, Role, Permission } from '../../../core/services/role.service';
import Swal from 'sweetalert2';
import { AlertService } from '../../../core/services/alert.service';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    FormModule,
    AlertModule,
    GridModule,
    ModalModule,
    TableModule,
    BadgeModule,
    ButtonGroupModule,
    IconDirective
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './roles.component.html',
  styleUrls: ['./roles.component.scss']
})
export class RolesComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  roles: Role[] = [];
  permissions: Permission[] = [];
  filteredRoles: Role[] = [];
  loading = false;
  submitted = false;
  editMode = false;
  selectedRole: Role | null = null;
  
  // Modal states
  roleModalOpen = false;
  permissionModalOpen = false;
  roleToDelete: Role | null = null;
  selectedRoleForPermissions: Role | null = null;

  // Forms
  roleForm!: FormGroup;
  permissionForm!: FormGroup;
  filterForm!: FormGroup;
  
  // Available data
  availablePermissions: Permission[] = [];
  selectedPermissions: number[] = [];

  constructor(
    private roleService: RoleService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private alertService: AlertService
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadRoles();
    this.loadPermissions();
  }

  private initializeForms(): void {
    this.roleForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(125)]],
      guard_name: ['web', Validators.required],
      permissions: this.fb.array([])
    });

    this.permissionForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(125)]],
      guard_name: ['web', Validators.required]
    });

    this.filterForm = this.fb.group({
      search: [''],
      guard_name: ['ALL']
    });
  }

  // Data loading methods
  loadRoles(): void {
    this.loading = true;
    this.cdr.detectChanges();

    this.roleService.getRoles().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.roles = response.data || [];
        this.filteredRoles = [...this.roles];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.roles = [];
        this.filteredRoles = [];
        this.showErrorMessage('Erreur lors du chargement des rôles.');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadPermissions(): void {
    this.roleService.getPermissions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
        setTimeout(() => {
          this.permissions = response.data || [];
          this.availablePermissions = [...this.permissions];
          this.cdr.detectChanges();
        }, 0);
      },
      error: (error) => {
        setTimeout(() => {
          this.permissions = [];
          this.availablePermissions = [];
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  // Form getters
  get f() {
    return this.roleForm.controls;
  }

  get pf() {
    return this.permissionForm.controls;
  }

  get permissionsArray(): FormArray {
    return this.roleForm.get('permissions') as FormArray;
  }

  // Role CRUD operations
  openRoleModal(role?: Role): void {
    this.editMode = !!role;
    this.selectedRole = role || null;
    
    if (role) {
      this.roleForm.patchValue({
        name: role.name,
        guard_name: role.guard_name || 'web'
      });
      this.selectedPermissions = role.permissions?.map(p => p.id) || [];
    } else {
      this.roleForm.reset({
        name: '',
        guard_name: 'web'
      });
      this.selectedPermissions = [];
    }
    
    this.submitted = false;
    this.roleModalOpen = true;
    this.cdr.detectChanges();
  }

  closeRoleModal(): void {
    this.roleModalOpen = false;
    this.editMode = false;
    this.selectedRole = null;
    this.roleForm.reset();
    this.selectedPermissions = [];
    this.submitted = false;
  }

  onSubmitRole(): void {
    this.submitted = true;
    this.cdr.detectChanges();

    if (this.roleForm.invalid) {
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    if (this.editMode && this.selectedRole) {
      this.updateRole();
    } else {
      this.createRole();
    }
  }

  private createRole(): void {
    const roleData = {
      name: this.roleForm.value.name,
      guard_name: this.roleForm.value.guard_name,
      permission_ids: this.selectedPermissions
    };

    this.roleService.createRole(roleData).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.roles.push(response.data);
        this.applyFilters();
        this.closeRoleModal();
        this.showSuccessMessage('Rôle créé avec succès!');
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.showErrorMessage('Erreur lors de la création du rôle.');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private updateRole(): void {
    if (!this.selectedRole) return;

    const roleData = {
      name: this.roleForm.value.name,
      guard_name: this.roleForm.value.guard_name,
      permission_ids: this.selectedPermissions
    };

    this.roleService.updateRole(this.selectedRole.id, roleData).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        const index = this.roles.findIndex(r => r.id === this.selectedRole!.id);
        if (index !== -1) {
          this.roles[index] = response.data;
        }
        this.applyFilters();
        this.closeRoleModal();
        this.showSuccessMessage('Rôle modifié avec succès!');
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.showErrorMessage('Erreur lors de la modification du rôle.');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Delete role with AlertService confirmation
  deleteRole(role: Role): void {
    this.alertService.showDeleteConfirmation(role.name, 'le rôle').then((result) => {
      if (result.isConfirmed) {
        this.confirmDeleteRole(role);
      }
    });
  }

  confirmDeleteRole(role: Role): void {
    this.loading = true;
    this.cdr.detectChanges();

    this.roleService.deleteRole(role.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.roles = this.roles.filter(r => r.id !== role.id);
        this.applyFilters();
        this.showSuccessMessage('Rôle supprimé avec succès!');
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.showErrorMessage('Erreur lors de la suppression du rôle.');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Permission management
  openPermissionModal(): void {
    this.permissionForm.reset({
      name: '',
      guard_name: 'web'
    });
    this.permissionModalOpen = true;
    this.submitted = false;
  }

  closePermissionModal(): void {
    this.permissionModalOpen = false;
    this.permissionForm.reset();
    this.submitted = false;
  }

  onSubmitPermission(): void {
    this.submitted = true;
    this.cdr.detectChanges();

    if (this.permissionForm.invalid) {
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    const permissionData = {
      name: this.permissionForm.value.name,
      guard_name: this.permissionForm.value.guard_name
    };

    this.roleService.createPermission(permissionData).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.permissions.push(response.data);
        this.availablePermissions = [...this.permissions];
        this.closePermissionModal();
        this.showSuccessMessage('Permission créée avec succès!');
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.showErrorMessage('Erreur lors de la création de la permission.');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  deletePermission(permission: Permission): void {
    this.alertService.showDeleteConfirmation(permission.name, 'la permission').then((result) => {
      if (result.isConfirmed) {
        this.confirmDeletePermission(permission);
      }
    });
  }

  confirmDeletePermission(permission: Permission): void {
    this.loading = true;
    this.cdr.detectChanges();

    this.roleService.deletePermission(permission.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.permissions = this.permissions.filter(p => p.id !== permission.id);
        this.availablePermissions = [...this.permissions];
        this.showSuccessMessage('Permission supprimée avec succès!');
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.showErrorMessage('Erreur lors de la suppression de la permission.');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Permission selection for roles
  togglePermissionSelection(permissionId: number): void {
    const index = this.selectedPermissions.indexOf(permissionId);
    if (index > -1) {
      this.selectedPermissions.splice(index, 1);
    } else {
      this.selectedPermissions.push(permissionId);
    }
  }

  isPermissionSelected(permissionId: number): boolean {
    return this.selectedPermissions.includes(permissionId);
  }

  // Filter methods
  applyFilters(): void {
    const search = this.filterForm.get('search')?.value?.toLowerCase() || '';
    const guardName = this.filterForm.get('guard_name')?.value || 'ALL';

    this.filteredRoles = this.roles.filter(role => {
      const matchesSearch = !search || 
        role.name.toLowerCase().includes(search) ||
        (role.permissions && role.permissions.some(p => p.name.toLowerCase().includes(search)));
      
      const matchesGuard = guardName === 'ALL' || role.guard_name === guardName;
      
      return matchesSearch && matchesGuard;
    });

    this.cdr.detectChanges();
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      guard_name: 'ALL'
    });
    this.filteredRoles = [...this.roles];
    this.cdr.detectChanges();
  }

  // Utility methods
  getRoleDisplayName(roleName: string): string {
    return this.roleService.getRoleDisplayName(roleName);
  }

  getPermissionDisplayName(permissionName: string): string {
    return this.roleService.getPermissionDisplayName(permissionName);
  }

  getRoleBadgeColor(roleName: string): string {
    const colors: { [key: string]: string } = {
      'SUPER_ADMIN': 'danger',
      'ADMIN': 'warning',
      'USER': 'primary',
      'VIEWER': 'secondary'
    };
    return colors[roleName] || 'info';
  }

  getPermissionCount(role: Role): number {
    return role.permissions?.length || 0;
  }

  // Message handling with AlertService
  showSuccessMessage(message: string): void {
    this.alertService.showSuccess('Succès!', message);
  }

  showErrorMessage(message: string): void {
    this.alertService.showError('Erreur!', message);
  }

  // Helper methods for template
  getAdminRoleCount(): number {
    return this.roles.filter(r => r.name === 'ADMIN').length;
  }

  getUserRoleCount(): number {
    return this.roles.filter(r => r.name === 'USER').length;
  }
  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }

}
