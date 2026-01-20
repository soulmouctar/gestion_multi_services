import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { ModuleService } from './module.service';

export interface UserModulePermission {
  module_code: string;
  module_name: string;
  is_active: boolean;
  permissions: string[];
}

export interface UserPermissions {
  userId: number;
  role: string;
  modules: UserModulePermission[];
}

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  private userPermissions = new BehaviorSubject<UserPermissions | null>(null);
  public userPermissions$ = this.userPermissions.asObservable();

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private moduleService: ModuleService
  ) {
    // Delay initialization to prevent blocking
    setTimeout(() => {
      this.initializePermissions();
    }, 0);
  }

  private initializePermissions(): void {
    try {
      // Load permissions when user logs in
      this.authService.authState$.subscribe(authState => {
        if (authState.isAuthenticated && authState.user) {
          // Use setTimeout to prevent blocking the main thread
          const userId = authState.user.id;
          setTimeout(() => {
            this.loadUserPermissions(Number(userId));
          }, 100);
        } else {
          this.userPermissions.next(null);
        }
      });
    } catch (error) {
      console.error('Error initializing permissions:', error);
      this.userPermissions.next(null);
    }
  }

  /**
   * Load user permissions from API
   */
  private loadUserPermissions(userId: number): void {
    // For SUPER_ADMIN, provide all modules with all permissions
    if (this.authService.isSuperAdmin) {
      const superAdminPermissions: UserPermissions = {
        userId,
        role: 'SUPER_ADMIN',
        modules: [
          { module_code: 'ADMIN', module_name: 'Administration', is_active: true, permissions: ['create', 'read', 'update', 'delete', 'view'] },
          { module_code: 'COMMERCIAL', module_name: 'Gestion Commerciale', is_active: true, permissions: ['create', 'read', 'update', 'delete', 'view'] },
          { module_code: 'FINANCE', module_name: 'Gestion Financière', is_active: true, permissions: ['create', 'read', 'update', 'delete', 'view'] },
          { module_code: 'PRODUCTS_STOCK', module_name: 'Produits & Stock', is_active: true, permissions: ['create', 'read', 'update', 'delete', 'view'] },
          { module_code: 'CLIENTS_SUPPLIERS', module_name: 'Clients & Fournisseurs', is_active: true, permissions: ['create', 'read', 'update', 'delete', 'view'] },
          { module_code: 'CONTAINERS', module_name: 'Conteneurs', is_active: true, permissions: ['create', 'read', 'update', 'delete', 'view'] },
          { module_code: 'RENTAL', module_name: 'Location', is_active: true, permissions: ['create', 'read', 'update', 'delete', 'view'] },
          { module_code: 'TAXI', module_name: 'Gestion Taxi', is_active: true, permissions: ['create', 'read', 'update', 'delete', 'view'] },
          { module_code: 'STATISTICS', module_name: 'Statistiques', is_active: true, permissions: ['create', 'read', 'update', 'delete', 'view'] }
        ]
      };
      this.userPermissions.next(superAdminPermissions);
      return;
    }

    // For ADMIN, provide all modules with all permissions (same as SUPER_ADMIN for now)
    if (this.authService.isTenantAdmin) {
      const adminPermissions: UserPermissions = {
        userId,
        role: 'ADMIN',
        modules: [
          { module_code: 'ADMIN', module_name: 'Administration', is_active: true, permissions: ['create', 'read', 'update', 'delete', 'view'] },
          { module_code: 'COMMERCIAL', module_name: 'Gestion Commerciale', is_active: true, permissions: ['create', 'read', 'update', 'delete', 'view'] },
          { module_code: 'FINANCE', module_name: 'Gestion Financière', is_active: true, permissions: ['create', 'read', 'update', 'delete', 'view'] },
          { module_code: 'PRODUCTS_STOCK', module_name: 'Produits & Stock', is_active: true, permissions: ['create', 'read', 'update', 'delete', 'view'] },
          { module_code: 'CLIENTS_SUPPLIERS', module_name: 'Clients & Fournisseurs', is_active: true, permissions: ['create', 'read', 'update', 'delete', 'view'] },
          { module_code: 'CONTAINERS', module_name: 'Conteneurs', is_active: true, permissions: ['create', 'read', 'update', 'delete', 'view'] },
          { module_code: 'RENTAL', module_name: 'Location', is_active: true, permissions: ['create', 'read', 'update', 'delete', 'view'] },
          { module_code: 'TAXI', module_name: 'Gestion Taxi', is_active: true, permissions: ['create', 'read', 'update', 'delete', 'view'] },
          { module_code: 'STATISTICS', module_name: 'Statistiques', is_active: true, permissions: ['create', 'read', 'update', 'delete', 'view'] }
        ]
      };
      this.userPermissions.next(adminPermissions);
      return;
    }

    this.userService.getUserModulePermissions(userId).subscribe({
      next: (response) => {
        const permissions: UserPermissions = {
          userId,
          role: this.authService.currentUser?.role || 'USER',
          modules: response.data || []
        };
        this.userPermissions.next(permissions);
      },
      error: (error) => {
        console.error('Error loading user permissions:', error);
        this.userPermissions.next(null);
      }
    });
  }

  /**
   * Check if user has access to a specific module
   */
  hasModuleAccess(moduleCode: string): Observable<boolean> {
    return this.userPermissions$.pipe(
      map(permissions => {
        // Super admin has access to everything
        if (this.authService.isSuperAdmin) {
          return true;
        }

        if (!permissions) {
          return false;
        }

        const modulePermission = permissions.modules.find(
          m => m.module_code === moduleCode
        );

        return modulePermission?.is_active || false;
      })
    );
  }

  /**
   * Check if user has a specific permission on a module
   */
  hasPermission(moduleCode: string, permission: string): Observable<boolean> {
    return this.userPermissions$.pipe(
      map(permissions => {
        // Super admin has all permissions
        if (this.authService.isSuperAdmin) {
          return true;
        }

        if (!permissions) {
          return false;
        }

        const modulePermission = permissions.modules.find(
          m => m.module_code === moduleCode && m.is_active
        );

        return modulePermission?.permissions.includes(permission) || false;
      })
    );
  }

  /**
   * Get all active modules for current user
   */
  getActiveModules(): Observable<UserModulePermission[]> {
    return this.userPermissions$.pipe(
      map(permissions => {
        if (this.authService.isSuperAdmin) {
          // Return all available modules for super admin
          return this.userService.getAvailableModules().map(module => ({
            module_code: module.module_code,
            module_name: module.module_name,
            is_active: true,
            permissions: module.permissions
          }));
        }

        return permissions?.modules.filter(m => m.is_active) || [];
      })
    );
  }

  /**
   * Check if user can perform CRUD operations
   */
  canView(moduleCode: string): Observable<boolean> {
    return this.hasPermission(moduleCode, 'view');
  }

  canCreate(moduleCode: string): Observable<boolean> {
    return this.hasPermission(moduleCode, 'create');
  }

  canEdit(moduleCode: string): Observable<boolean> {
    return this.hasPermission(moduleCode, 'edit');
  }

  canDelete(moduleCode: string): Observable<boolean> {
    return this.hasPermission(moduleCode, 'delete');
  }

  /**
   * Refresh user permissions
   */
  refreshPermissions(): void {
    const currentUser = this.authService.currentUser;
    if (currentUser) {
      this.loadUserPermissions(Number(currentUser.id));
    }
  }

  /**
   * Get current user permissions synchronously
   */
  getCurrentPermissions(): UserPermissions | null {
    return this.userPermissions.value;
  }

  /**
   * Check if user has admin role
   */
  isAdmin(): boolean {
    const permissions = this.getCurrentPermissions();
    return this.authService.isSuperAdmin || 
           permissions?.role === 'ADMIN' || 
           permissions?.role === 'SUPER_ADMIN';
  }

  /**
   * Get module permissions for navigation menu
   */
  getNavigationModules(): Observable<UserModulePermission[]> {
    return this.getActiveModules().pipe(
      map(modules => modules.filter(module => 
        module.permissions.includes('view')
      ))
    );
  }
}
