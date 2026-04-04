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

        // Get user role from authState
        const userRole = this.getUserRole(authState.user);
        const isSuperAdmin = userRole === 'SUPER_ADMIN';
        const isTenantAdmin = userRole === 'ADMIN';

        const baseNavigation: NavigationItem[] = [
          {
            name: 'Dashboard',
            url: '/dashboard',
            iconComponent: { name: 'cilSpeedometer' }
          }
        ];

        // Business modules section - Add title and modules
        baseNavigation.push({
          name: 'GESTION MULTI-MODULES',
          title: true
        });

        // Add modules right after the section title
        const tenantModules = this.getTenantModulesNavigation(authState.user);
        if (tenantModules.length > 0) {
          baseNavigation.push(...tenantModules);
        }

        // SUPER_ADMIN - Section ADMINISTRATION (gestion globale)
        if (isSuperAdmin) {
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
            },
            {
              name: 'Configuration',
              url: '/settings',
              iconComponent: { name: 'cilSettings' }
            }
          );
        }

        // ADMIN & SUPER_ADMIN - Section ORGANISATION (gestion de leur organisation)
        if (isTenantAdmin || isSuperAdmin) {
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

        return of(baseNavigation);
      })
    );
  }

  /**
   * Get user role from user object
   */
  private getUserRole(user: any): string | null {
    if (!user || !user.roles || !Array.isArray(user.roles) || user.roles.length === 0) {
      return null;
    }
    return user.roles[0].name;
  }

  /**
   * Get navigation items for tenant modules based on user's assigned modules
   * Uses user_module_permissions to filter accessible modules
   */
  private getTenantModulesNavigation(user: any): NavigationItem[] {
    if (!user) {
      console.log('NavigationService - getTenantModulesNavigation: No user');
      return [];
    }

    const moduleNavigation: NavigationItem[] = [];
    
    // Get user's accessible modules (intersection of tenant modules and user permissions)
    const accessibleModules = this.authService.getUserAccessibleModules();
    
    console.log('NavigationService - Accessible modules for user:', user.email, accessibleModules);
    
    if (!accessibleModules || accessibleModules.length === 0) {
      console.log('NavigationService - No accessible modules found');
      return [];
    }

    accessibleModules.forEach((module: any) => {
      console.log('NavigationService - Processing module:', module.code, module);
      switch (module.code) {
        case 'COMMERCE':
          moduleNavigation.push({
            name: 'Commercial',
            url: '/commercial',
            iconComponent: { name: 'cilBasket' },
            badge: {
              color: 'success',
              text: 'NOUVEAU'
            },
            children: [
              {
                name: 'Tableau de Bord',
                url: '/commercial/dashboard',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Produits',
                url: '/products/list',
                icon: 'nav-icon-bullet',
                badge: {
                  color: 'success',
                  text: 'COMPLET'
                }
              },
              {
                name: 'Gestion Avancée Produits',
                url: '/products/advanced',
                icon: 'nav-icon-bullet',
                badge: {
                  color: 'info',
                  text: 'NOUVEAU'
                }
              },
              {
                name: 'Catégories',
                url: '/product-categories/list',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Unités de Mesure',
                url: '/units/list',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Clients',
                url: '/clients/list',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Fournisseurs',
                url: '/suppliers/list',
                icon: 'nav-icon-bullet'
              }
            ]
          });
          break;
        case 'FINANCE':
          moduleNavigation.push({
            name: 'Finance',
            url: '/finance',
            iconComponent: { name: 'cilDollar' },
            badge: {
              color: 'success',
              text: 'NOUVEAU'
            },
            children: [
              {
                name: 'Tableau de Bord',
                url: '/finance/dashboard',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Paiements',
                url: '/payments/list',
                icon: 'nav-icon-bullet',
                badge: {
                  color: 'success',
                  text: 'COMPLET'
                }
              },
              {
                name: 'Gestion Avancée Paiements',
                url: '/payments/advanced',
                icon: 'nav-icon-bullet',
                badge: {
                  color: 'info',
                  text: 'NOUVEAU'
                }
              },
              {
                name: 'Devises',
                url: '/finance/currencies',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Taux de Change',
                url: '/finance/exchange-rates',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Factures',
                url: '/finance/invoices',
                icon: 'nav-icon-bullet'
              }
            ]
          });
          break;
        case 'CONTAINER':
          moduleNavigation.push({
            name: 'Conteneurs',
            url: '/containers',
            iconComponent: { name: 'cilLayers' },
            children: [
              {
                name: 'Liste des Conteneurs',
                url: '/containers/list',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Photos',
                url: '/containers/photos',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Suivi Paiements',
                url: '/containers/payments',
                icon: 'nav-icon-bullet',
                badge: {
                  color: 'success',
                  text: 'NOUVEAU'
                }
              },
              {
                name: 'Statistiques Avancées',
                url: '/containers/statistics',
                icon: 'nav-icon-bullet'
              }
            ]
          });
          break;
        case 'IMMOBILIER':
          moduleNavigation.push({
            name: 'Location',
            url: '/rental',
            iconComponent: { name: 'cilHome' },
            children: [
              {
                name: 'Emplacements',
                url: '/rental/locations',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Bâtiments',
                url: '/rental/buildings',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Étages',
                url: '/rental/floors',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Unités de Logement',
                url: '/rental/housing-units',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Configurations',
                url: '/rental/unit-configurations',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Gestion Avancée Emplacements',
                url: '/rental/locations-advanced',
                icon: 'nav-icon-bullet',
                badge: {
                  color: 'info',
                  text: 'NOUVEAU'
                }
              }
            ]
          });
          break;
        case 'TAXI':
          moduleNavigation.push({
            name: 'Taxi & Transport',
            url: '/taxi',
            iconComponent: { name: 'cilLocationPin' },
            children: [
              {
                name: 'Véhicules',
                url: '/taxi/vehicles',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Conducteurs',
                url: '/taxi/drivers',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Affectations',
                url: '/taxi/assignments',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Versements Journaliers',
                url: '/taxi/daily-payments',
                icon: 'nav-icon-bullet',
                badge: {
                  color: 'success',
                  text: 'NOUVEAU'
                }
              },
              {
                name: 'Dépenses Véhicules',
                url: '/taxi/vehicle-expenses',
                icon: 'nav-icon-bullet',
                badge: {
                  color: 'info',
                  text: 'NOUVEAU'
                }
              }
            ]
          });
          break;
        case 'STATISTICS':
          moduleNavigation.push({
            name: 'Statistiques',
            url: '/statistics',
            iconComponent: { name: 'cilChart' },
            children: [
              {
                name: 'Vue d\'ensemble',
                url: '/statistics/overview',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Ventes',
                url: '/statistics/sales',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Finances',
                url: '/statistics/finance',
                icon: 'nav-icon-bullet'
              },
              {
                name: 'Inventaire',
                url: '/statistics/inventory',
                icon: 'nav-icon-bullet'
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
