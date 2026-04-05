import { Injectable } from '@angular/core';
import { Observable, of, map, switchMap, combineLatest } from 'rxjs';
import { PermissionService } from './permission.service';
import { AuthService } from './auth.service';
import { INavData } from '@coreui/angular';
import { User } from '../models';

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

  getNavigationItems(): Observable<NavigationItem[]> {
    return this.authService.authState$.pipe(
      switchMap(authState => {
        if (!authState.user) {
          return of([]);
        }

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

        baseNavigation.push({ name: 'GESTION MULTI-MODULES', title: true });

        const tenantModules = this.getTenantModulesNavigation(authState.user);
        if (tenantModules.length > 0) {
          baseNavigation.push(...tenantModules);
        }

        if (isSuperAdmin) {
          baseNavigation.push(
            { name: 'ADMINISTRATION', title: true },
            { name: 'Gestion des Organisations',  url: '/admin/organisations',       iconComponent: { name: 'cilApplicationsSettings' } },
            { name: 'Gestion des Modules',         url: '/admin/modules',             iconComponent: { name: 'cilPuzzle' } },
            { name: 'Gestion des Abonnements',     url: '/admin/subscriptions',       iconComponent: { name: 'cilCreditCard' } },
            { name: 'Plans d\'Abonnement',         url: '/admin/subscription-plans',  iconComponent: { name: 'cilList' } },
            { name: 'Gestion des Utilisateurs',    url: '/admin/users',               iconComponent: { name: 'cilPeople' } },
            { name: 'Rôles & Permissions',         url: '/admin/roles',               iconComponent: { name: 'cilShieldAlt' } },
            { name: 'Statistiques Globales',       url: '/admin/statistics',          iconComponent: { name: 'cilChartPie' } },
            { name: 'Configuration',               url: '/settings',                  iconComponent: { name: 'cilSettings' } }
          );
        }

        if (isTenantAdmin || isSuperAdmin) {
          baseNavigation.push(
            { name: 'ORGANISATION', title: true },
            { name: 'Informations Entreprise', url: '/organisation/company-info',      iconComponent: { name: 'cilBuilding' } },
            { name: 'Contacts & Adresses',     url: '/organisation/contacts',          iconComponent: { name: 'cilAddressBook' } },
            { name: 'Utilisateurs',            url: '/organisation/users',             iconComponent: { name: 'cilPeople' } },
            { name: 'Devises',                 url: '/organisation/currencies',        iconComponent: { name: 'cilDollar' } },
            { name: 'En-têtes Factures',       url: '/organisation/invoice-headers',   iconComponent: { name: 'cilDescription' } },
            { name: 'Configuration',           url: '/organisation/settings',          iconComponent: { name: 'cilSettings' } }
          );
        }

        return of(baseNavigation);
      })
    );
  }

  private getUserRole(user: User): string | null {
    if (!user?.roles || !Array.isArray(user.roles) || user.roles.length === 0) {
      return null;
    }
    return user.roles[0].name;
  }

  private getTenantModulesNavigation(user: User): NavigationItem[] {
    if (!user) return [];

    const moduleNavigation: NavigationItem[] = [];
    const accessibleModules = this.authService.getUserAccessibleModules();

    if (!accessibleModules || accessibleModules.length === 0) return [];

    accessibleModules.forEach(module => {
      switch (module.code) {
        case 'COMMERCE':
          moduleNavigation.push({
            name: 'Commercial',
            url: '/commercial',
            iconComponent: { name: 'cilBasket' },
            children: [
              { name: 'Tableau de Bord',              url: '/commercial/dashboard',      icon: 'nav-icon-bullet' },
              { name: 'Produits',                     url: '/products/list',             icon: 'nav-icon-bullet' },
              { name: 'Gestion Avancée Produits',     url: '/products/advanced',         icon: 'nav-icon-bullet' },
              { name: 'Catégories',                   url: '/product-categories/list',   icon: 'nav-icon-bullet' },
              { name: 'Unités de Mesure',             url: '/units/list',                icon: 'nav-icon-bullet' },
              { name: 'Clients',                      url: '/clients/list',              icon: 'nav-icon-bullet' },
              { name: 'Fournisseurs',                 url: '/suppliers/list',            icon: 'nav-icon-bullet' },
            ]
          });
          break;

        case 'FINANCE':
          moduleNavigation.push({
            name: 'Finance',
            url: '/finance',
            iconComponent: { name: 'cilDollar' },
            children: [
              { name: 'Tableau de Bord',              url: '/finance/dashboard',         icon: 'nav-icon-bullet' },
              { name: 'Paiements',                    url: '/payments/list',             icon: 'nav-icon-bullet' },
              { name: 'Gestion Avancée Paiements',    url: '/payments/advanced',         icon: 'nav-icon-bullet' },
              { name: 'Devises',                      url: '/finance/currencies',        icon: 'nav-icon-bullet' },
              { name: 'Taux de Change',               url: '/finance/exchange-rates',    icon: 'nav-icon-bullet' },
              { name: 'Factures',                     url: '/finance/invoices',          icon: 'nav-icon-bullet' },
            ]
          });
          break;

        case 'CONTAINER':
          moduleNavigation.push({
            name: 'Conteneurs',
            url: '/containers',
            iconComponent: { name: 'cilLayers' },
            children: [
              { name: 'Liste des Conteneurs',         url: '/containers/list',           icon: 'nav-icon-bullet' },
              { name: 'Photos',                       url: '/containers/photos',         icon: 'nav-icon-bullet' },
              { name: 'Suivi Paiements',              url: '/containers/payments',       icon: 'nav-icon-bullet' },
              { name: 'Statistiques Avancées',        url: '/containers/statistics',     icon: 'nav-icon-bullet' },
            ]
          });
          break;

        case 'RENTAL':
          moduleNavigation.push({
            name: 'Location',
            url: '/rental',
            iconComponent: { name: 'cilHome' },
            children: [
              { name: 'Emplacements',                 url: '/rental/locations',          icon: 'nav-icon-bullet' },
              { name: 'Bâtiments',                    url: '/rental/buildings',          icon: 'nav-icon-bullet' },
              { name: 'Étages',                       url: '/rental/floors',             icon: 'nav-icon-bullet' },
              { name: 'Unités de Logement',           url: '/rental/housing-units',      icon: 'nav-icon-bullet' },
              { name: 'Configurations',               url: '/rental/unit-configurations', icon: 'nav-icon-bullet' },
              { name: 'Gestion Avancée',              url: '/rental/locations-advanced', icon: 'nav-icon-bullet' },
            ]
          });
          break;

        case 'TAXI':
          moduleNavigation.push({
            name: 'Taxi & Transport',
            url: '/taxi',
            iconComponent: { name: 'cilLocationPin' },
            children: [
              { name: 'Véhicules',                    url: '/taxi/vehicles',             icon: 'nav-icon-bullet' },
              { name: 'Conducteurs',                  url: '/taxi/drivers',              icon: 'nav-icon-bullet' },
              { name: 'Affectations',                 url: '/taxi/assignments',          icon: 'nav-icon-bullet' },
              { name: 'Versements Journaliers',       url: '/taxi/daily-payments',       icon: 'nav-icon-bullet' },
              { name: 'Dépenses Véhicules',           url: '/taxi/vehicle-expenses',     icon: 'nav-icon-bullet' },
            ]
          });
          break;

        case 'STATISTICS':
          moduleNavigation.push({
            name: 'Statistiques',
            url: '/statistics',
            iconComponent: { name: 'cilChart' },
            children: [
              { name: 'Vue d\'ensemble',              url: '/statistics/overview',       icon: 'nav-icon-bullet' },
              { name: 'Ventes',                       url: '/statistics/sales',          icon: 'nav-icon-bullet' },
              { name: 'Finances',                     url: '/statistics/finance',        icon: 'nav-icon-bullet' },
              { name: 'Inventaire',                   url: '/statistics/inventory',      icon: 'nav-icon-bullet' },
            ]
          });
          break;
      }
    });

    return moduleNavigation;
  }

  private filterItemsRecursively(items: NavigationItem[], userPermissions: any): NavigationItem[] {
    return items.filter(item => {
      if (!item.requiredModule) return true;

      if (userPermissions.role === 'SUPER_ADMIN' || userPermissions.role === 'ADMIN') return true;

      const hasModuleAccess = userPermissions.modules.some((module: any) =>
        module.module_code === item.requiredModule && module.is_active
      );

      if (!hasModuleAccess) return false;

      if (item.requiredPermission) {
        const modulePermission = userPermissions.modules.find((module: any) =>
          module.module_code === item.requiredModule
        );
        if (!modulePermission?.permissions.includes(item.requiredPermission)) return false;
      }

      if (item.children) {
        item.children = this.filterItemsRecursively(item.children, userPermissions);
        return item.children.length > 0;
      }

      return true;
    });
  }

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