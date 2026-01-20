import { Injectable } from '@angular/core';
import { Observable, of, map, switchMap, combineLatest } from 'rxjs';
import { PermissionService } from './permission.service';
import { AuthService } from './auth.service';
import { INavData } from '@coreui/angular';

export interface NavigationItem extends INavData {
  requiredModule?: string;
  requiredPermission?: string;
  children?: NavigationItem[];
}

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  
  constructor(
    private permissionService: PermissionService,
    private authService: AuthService
  ) {}

  /**
   * Get navigation items based on user permissions
   */
  getNavigationItems(): Observable<NavigationItem[]> {
    return this.authService.authState$.pipe(
      switchMap(authState => {
        if (!authState.user) {
          return of([]);
        }

        const baseNavigation: NavigationItem[] = [
          {
            name: 'Dashboard',
            url: '/dashboard',
            iconComponent: { name: 'cilSpeedometer' }
          }
        ];

        // Admin sections        // SUPER_ADMIN navigation items
        if (this.authService.isSuperAdmin) {
          baseNavigation.push(
            {
              name: 'ADMINISTRATION',
              title: true
            },
            {
              name: 'Gestion des Organisations',
              url: '/admin/organisations',
              iconComponent: { name: 'cilApplicationsSettings' }
            },
            {
              name: 'Gestion des Modules',
              url: '/admin/modules',
              iconComponent: { name: 'cilPuzzle' }
            },
            {
              name: 'Gestion des Abonnements',
              url: '/admin/subscriptions',
              iconComponent: { name: 'cilCreditCard' }
            },
            {
              name: 'Plans d\'Abonnement',
              url: '/admin/subscription-plans',
              iconComponent: { name: 'cilList' }
            },
            {
              name: 'Gestion des Utilisateurs',
              url: '/admin/users',
              iconComponent: { name: 'cilPeople' }
            },
            {
              name: 'Rôles & Permissions',
              url: '/admin/roles',
              iconComponent: { name: 'cilShieldAlt' }
            },
            {
              name: 'Statistiques Globales',
              url: '/admin/statistics',
              iconComponent: { name: 'cilChartPie' }
            }
          );
        }

        // ADMIN navigation items for organisation management
        if (this.authService.isTenantAdmin || this.authService.isSuperAdmin) {
          baseNavigation.push(
            {
              name: 'ORGANISATION',
              title: true
            },
            {
              name: 'Informations Entreprise',
              url: '/organisation/company-info',
              iconComponent: { name: 'cilBuilding' }
            },
            {
              name: 'Contacts & Adresses',
              url: '/organisation/contacts',
              iconComponent: { name: 'cilAddressBook' }
            },
            {
              name: 'Utilisateurs',
              url: '/organisation/users',
              iconComponent: { name: 'cilPeople' }
            },
            {
              name: 'Devises',
              url: '/organisation/currencies',
              iconComponent: { name: 'cilDollar' }
            },
            {
              name: 'En-têtes Factures',
              url: '/organisation/invoice-headers',
              iconComponent: { name: 'cilDescription' }
            },
            {
              name: 'Configuration',
              url: '/organisation/settings',
              iconComponent: { name: 'cilSettings' }
            }
          );
        }

        // Modules section - for SUPER_ADMIN show all modules, for others show tenant modules
        if (this.authService.isSuperAdmin) {
          // SUPER_ADMIN sees all available modules
          baseNavigation.push(
            {
              name: 'MODULES DISPONIBLES',
              title: true
            },
            {
              name: 'Commercial',
              url: '/commercial',
              iconComponent: { name: 'cilBasket' },
              requiredModule: 'COMMERCE'
            },
            {
              name: 'Finance',
              url: '/finance',
              iconComponent: { name: 'cilDollar' },
              requiredModule: 'FINANCE'
            },
            {
              name: 'Conteneurs',
              url: '/containers',
              iconComponent: { name: 'cilLayers' },
              requiredModule: 'CONTAINER'
            },
            {
              name: 'Location',
              url: '/rental',
              iconComponent: { name: 'cilHome' },
              requiredModule: 'IMMOBILIER'
            },
            {
              name: 'Taxi & Transport',
              url: '/taxi',
              iconComponent: { name: 'cilLocationPin' },
              requiredModule: 'TAXI'
            },
            {
              name: 'Statistiques',
              url: '/statistics',
              iconComponent: { name: 'cilChart' },
              requiredModule: 'STATISTICS'
            }
          );
        } else {
          // Regular users see only their tenant's active modules
          const tenantModules = this.getTenantModulesNavigation(authState.user);
          if (tenantModules.length > 0) {
            baseNavigation.push(
              {
                name: 'MODULES DISPONIBLES',
                title: true
              },
              ...tenantModules
            );
          }
        }

        // Settings for all users
        baseNavigation.push({
          name: 'Paramètres',
          url: '/settings',
          iconComponent: { name: 'cilSettings' }
        });

        return of(baseNavigation);
      })
    );
  }

  /**
   * Get navigation items for tenant modules based on user's assigned modules
   */
  private getTenantModulesNavigation(user: any): NavigationItem[] {
    if (!user || !user.tenant || !user.tenant.modules) {
      return [];
    }

    const moduleNavigation: NavigationItem[] = [];
    
    // Filter only active modules for the user's tenant
    const activeModules = user.tenant.modules.filter((module: any) => 
      module.pivot && module.pivot.is_active
    );

    activeModules.forEach((module: any) => {
      switch (module.code) {
        case 'COMMERCE':
          moduleNavigation.push({
            name: 'Commercial',
            url: '/commercial',
            iconComponent: { name: 'cilBasket' },
            requiredModule: 'COMMERCE'
          });
          break;
        case 'FINANCE':
          moduleNavigation.push({
            name: 'Finance',
            url: '/finance',
            iconComponent: { name: 'cilDollar' },
            requiredModule: 'FINANCE'
          });
          break;
        case 'CONTAINER':
          moduleNavigation.push({
            name: 'Conteneurs',
            url: '/containers',
            iconComponent: { name: 'cilLayers' },
            requiredModule: 'CONTAINER'
          });
          break;
        case 'IMMOBILIER':
          moduleNavigation.push({
            name: 'Location',
            url: '/rental',
            iconComponent: { name: 'cilHome' },
            requiredModule: 'IMMOBILIER'
          });
          break;
        case 'TAXI':
          moduleNavigation.push({
            name: 'Taxi & Transport',
            url: '/taxi',
            iconComponent: { name: 'cilLocationPin' },
            requiredModule: 'TAXI'
          });
          break;
        case 'STATISTICS':
          moduleNavigation.push({
            name: 'Statistiques',
            url: '/statistics',
            iconComponent: { name: 'cilChart' },
            requiredModule: 'STATISTICS'
          });
          break;
      }
    });

    return moduleNavigation;
  }

  /**
   * Filter navigation items based on user permissions
   */
  private filterNavigationByPermissions(items: NavigationItem[]): Observable<NavigationItem[]> {
    return this.permissionService.userPermissions$.pipe(
      map(userPermissions => {
        if (!userPermissions) {
          // Return only dashboard if no permissions
          return items.filter(item => !item.requiredModule);
        }

        return this.filterItemsRecursively(items, userPermissions);
      })
    );
  }

  /**
   * Recursively filter navigation items
   */
  private filterItemsRecursively(items: NavigationItem[], userPermissions: any): NavigationItem[] {
    return items.filter(item => {
      // Always show items without module requirements (like Dashboard)
      if (!item.requiredModule) {
        return true;
      }

      // Super admin and admin have access to everything
      if (userPermissions.role === 'SUPER_ADMIN' || userPermissions.role === 'ADMIN') {
        return true;
      }

      // Check if user has access to the required module
      const hasModuleAccess = userPermissions.modules.some((module: any) => 
        module.module_code === item.requiredModule && module.is_active
      );

      if (!hasModuleAccess) {
        return false;
      }

      // Check specific permission if required
      if (item.requiredPermission) {
        const modulePermission = userPermissions.modules.find((module: any) => 
          module.module_code === item.requiredModule
        );
        
        if (!modulePermission?.permissions.includes(item.requiredPermission)) {
          return false;
        }
      }

      // Filter children if they exist
      if (item.children) {
        item.children = this.filterItemsRecursively(item.children, userPermissions);
        // Hide parent if no children are visible
        return item.children.length > 0;
      }

      return true;
    });
  }

  /**
   * Check if user can access a specific navigation item
   */
  canAccessNavItem(item: NavigationItem): Observable<boolean> {
    if (!item.requiredModule) {
      return new Observable(observer => observer.next(true));
    }

    const moduleAccess$ = this.permissionService.hasModuleAccess(item.requiredModule);
    
    if (!item.requiredPermission) {
      return moduleAccess$;
    }

    const permissionAccess$ = this.permissionService.hasPermission(
      item.requiredModule, 
      item.requiredPermission
    );

    return combineLatest([moduleAccess$, permissionAccess$]).pipe(
      map(([hasModule, hasPermission]) => hasModule && hasPermission)
    );
  }
}
