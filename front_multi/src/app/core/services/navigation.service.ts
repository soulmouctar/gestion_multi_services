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

        // Admin sections        // Business modules section
        baseNavigation.push({
          name: 'GESTION MULTI-MODULES',
          title: true
        });

        // SUPER_ADMIN navigation items
        if (this.authService.isSuperAdmin) {
          baseNavigation.push(
            {
              name: 'Commercial',
              url: '/commercial',
              iconComponent: { name: 'cilBasket' },
              children: [
                {
                  name: 'Tableau de Bord',
                  url: '/commercial/dashboard',
                  iconComponent: { name: 'cilSpeedometer' }
                },
                {
                  name: 'Produits ✓',
                  url: '/products/list',
                  iconComponent: { name: 'cilGrid' }
                },
                {
                  name: 'Catégories',
                  url: '/product-categories',
                  iconComponent: { name: 'cilTags' }
                },
                {
                  name: 'Unités de Mesure',
                  url: '/units',
                  iconComponent: { name: 'cilCalculator' }
                },
                {
                  name: 'Clients',
                  url: '/clients',
                  iconComponent: { name: 'cilPeople' }
                },
                {
                  name: 'Fournisseurs',
                  url: '/suppliers',
                  iconComponent: { name: 'cilTruck' }
                }
              ]
            },
            {
              name: 'Finance',
              url: '/finance',
              iconComponent: { name: 'cilDollar' },
              children: [
                {
                  name: 'Tableau de Bord',
                  url: '/finance/dashboard',
                  iconComponent: { name: 'cilSpeedometer' }
                },
                {
                  name: 'Paiements ✓',
                  url: '/payments',
                  iconComponent: { name: 'cilCreditCard' }
                },
                {
                  name: 'Devises',
                  url: '/currencies',
                  iconComponent: { name: 'cilMoney' }
                },
                {
                  name: 'Taux de Change',
                  url: '/exchange-rates',
                  iconComponent: { name: 'cilChart' }
                },
                {
                  name: 'Factures',
                  url: '/invoices',
                  iconComponent: { name: 'cilDescription' }
                }
              ]
            },
            {
              name: 'Conteneurs',
              url: '/containers',
              iconComponent: { name: 'cilLayers' },
              children: [
                {
                  name: 'Liste des Conteneurs',
                  url: '/containers/list',
                  iconComponent: { name: 'cilList' }
                },
                {
                  name: 'Tracking',
                  url: '/containers/tracking',
                  iconComponent: { name: 'cilLocationPin' }
                },
                {
                  name: 'Statistiques',
                  url: '/containers/statistics',
                  iconComponent: { name: 'cilChart' }
                }
              ]
            },
            {
              name: 'Location',
              url: '/rental',
              iconComponent: { name: 'cilHome' },
              children: [
                {
                  name: 'Emplacements',
                  url: '/locations',
                  iconComponent: { name: 'cilMap' }
                },
                {
                  name: 'Bâtiments',
                  url: '/buildings',
                  iconComponent: { name: 'cilBuilding' }
                },
                {
                  name: 'Étages',
                  url: '/floors',
                  iconComponent: { name: 'cilLayers' }
                },
                {
                  name: 'Unités de Logement',
                  url: '/housing-units',
                  iconComponent: { name: 'cilHome' }
                },
                {
                  name: 'Configurations',
                  url: '/unit-configurations',
                  iconComponent: { name: 'cilSettings' }
                }
              ]
            },
            {
              name: 'Taxi & Transport',
              url: '/taxi',
              iconComponent: { name: 'cilLocationPin' },
              children: [
                {
                  name: 'Véhicules',
                  url: '/taxis',
                  iconComponent: { name: 'cilCarAlt' }
                },
                {
                  name: 'Conducteurs',
                  url: '/drivers',
                  iconComponent: { name: 'cilUser' }
                },
                {
                  name: 'Affectations',
                  url: '/taxi-assignments',
                  iconComponent: { name: 'cilTask' }
                },
                {
                  name: 'Courses',
                  url: '/rides',
                  iconComponent: { name: 'cilSpeedometer' }
                }
              ]
            },
            {
              name: 'Statistiques',
              url: '/statistics',
              iconComponent: { name: 'cilChart' },
              children: [
                {
                  name: 'Vue d\'ensemble',
                  url: '/statistics/overview',
                  iconComponent: { name: 'cilSpeedometer' }
                },
                {
                  name: 'Ventes',
                  url: '/statistics/sales',
                  iconComponent: { name: 'cilBasket' }
                },
                {
                  name: 'Finances',
                  url: '/statistics/finance',
                  iconComponent: { name: 'cilDollar' }
                },
                {
                  name: 'Inventaire',
                  url: '/statistics/inventory',
                  iconComponent: { name: 'cilGrid' }
                }
              ]
            }
          );

          baseNavigation.push(
            {
              name: 'ORGANISATION',
              title: true
            },
            {
              name: 'Mon Organisation',
              url: '/organisation',
              iconComponent: { name: 'cilBuilding' },
              children: [
                {
                  name: 'Informations Entreprise',
                  url: '/organisation/company-info',
                  icon: 'nav-icon-bullet'
                },
                {
                  name: 'Utilisateurs',
                  url: '/organisation/users',
                  icon: 'nav-icon-bullet'
                },
                {
                  name: 'Contacts',
                  url: '/organisation/contacts',
                  icon: 'nav-icon-bullet'
                },
                {
                  name: 'Devises',
                  url: '/organisation/currencies',
                  icon: 'nav-icon-bullet'
                },
                {
                  name: 'En-têtes Factures',
                  url: '/organisation/invoice-headers',
                  icon: 'nav-icon-bullet'
                },
                {
                  name: 'Paramètres',
                  url: '/organisation/settings',
                  icon: 'nav-icon-bullet'
                }
              ]
            },
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
            requiredModule: 'COMMERCE',
            children: [
              {
                name: 'Tableau de Bord',
                url: '/commercial/dashboard',
                iconComponent: { name: 'cilSpeedometer' }
              },
              {
                name: 'Produits ✓',
                url: '/products/list',
                iconComponent: { name: 'cilGrid' }
              },
              {
                name: 'Catégories',
                url: '/product-categories',
                iconComponent: { name: 'cilTags' }
              },
              {
                name: 'Unités de Mesure',
                url: '/units',
                iconComponent: { name: 'cilCalculator' }
              },
              {
                name: 'Clients',
                url: '/clients',
                iconComponent: { name: 'cilPeople' }
              },
              {
                name: 'Fournisseurs',
                url: '/suppliers',
                iconComponent: { name: 'cilTruck' }
              }
            ]
          });
          break;
        case 'FINANCE':
          moduleNavigation.push({
            name: 'Finance',
            url: '/finance',
            iconComponent: { name: 'cilDollar' },
            requiredModule: 'FINANCE',
            children: [
              {
                name: 'Tableau de Bord',
                url: '/finance/dashboard',
                iconComponent: { name: 'cilSpeedometer' }
              },
              {
                name: 'Paiements ✓',
                url: '/payments',
                iconComponent: { name: 'cilCreditCard' }
              },
              {
                name: 'Devises',
                url: '/currencies',
                iconComponent: { name: 'cilMoney' }
              },
              {
                name: 'Taux de Change',
                url: '/exchange-rates',
                iconComponent: { name: 'cilChart' }
              },
              {
                name: 'Factures',
                url: '/invoices',
                iconComponent: { name: 'cilDescription' }
              }
            ]
          });
          break;
        case 'CONTAINER':
          moduleNavigation.push({
            name: 'Conteneurs',
            url: '/containers',
            iconComponent: { name: 'cilLayers' },
            requiredModule: 'CONTAINER',
            children: [
              {
                name: 'Liste des Conteneurs',
                url: '/containers/list',
                iconComponent: { name: 'cilList' }
              },
              {
                name: 'Tracking',
                url: '/containers/tracking',
                iconComponent: { name: 'cilLocationPin' }
              },
              {
                name: 'Statistiques',
                url: '/containers/statistics',
                iconComponent: { name: 'cilChart' }
              }
            ]
          });
          break;
        case 'IMMOBILIER':
          moduleNavigation.push({
            name: 'Location',
            url: '/rental',
            iconComponent: { name: 'cilHome' },
            requiredModule: 'IMMOBILIER',
            children: [
              {
                name: 'Emplacements',
                url: '/locations',
                iconComponent: { name: 'cilMap' }
              },
              {
                name: 'Bâtiments',
                url: '/buildings',
                iconComponent: { name: 'cilBuilding' }
              },
              {
                name: 'Étages',
                url: '/floors',
                iconComponent: { name: 'cilLayers' }
              },
              {
                name: 'Unités de Logement',
                url: '/housing-units',
                iconComponent: { name: 'cilHome' }
              },
              {
                name: 'Configurations',
                url: '/unit-configurations',
                iconComponent: { name: 'cilSettings' }
              }
            ]
          });
          break;
        case 'TAXI':
          moduleNavigation.push({
            name: 'Taxi & Transport',
            url: '/taxi',
            iconComponent: { name: 'cilLocationPin' },
            requiredModule: 'TAXI',
            children: [
              {
                name: 'Véhicules',
                url: '/taxis',
                iconComponent: { name: 'cilCarAlt' }
              },
              {
                name: 'Conducteurs',
                url: '/drivers',
                iconComponent: { name: 'cilUser' }
              },
              {
                name: 'Affectations',
                url: '/taxi-assignments',
                iconComponent: { name: 'cilTask' }
              },
              {
                name: 'Courses',
                url: '/rides',
                iconComponent: { name: 'cilSpeedometer' }
              }
            ]
          });
          break;
        case 'STATISTICS':
          moduleNavigation.push({
            name: 'Statistiques',
            url: '/statistics',
            iconComponent: { name: 'cilChart' },
            requiredModule: 'STATISTICS',
            children: [
              {
                name: 'Vue d\'ensemble',
                url: '/statistics/overview',
                iconComponent: { name: 'cilSpeedometer' }
              },
              {
                name: 'Ventes',
                url: '/statistics/sales',
                iconComponent: { name: 'cilBasket' }
              },
              {
                name: 'Finances',
                url: '/statistics/finance',
                iconComponent: { name: 'cilDollar' }
              },
              {
                name: 'Inventaire',
                url: '/statistics/inventory',
                iconComponent: { name: 'cilGrid' }
              }
            ]
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
