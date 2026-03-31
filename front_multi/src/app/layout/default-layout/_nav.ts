import { INavData } from '@coreui/angular';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { NavigationService } from '../../core/services/navigation.service';

@Injectable({
  providedIn: 'root'
})
export class NavService {
  private navigationService = inject(NavigationService);

  getNavItems(): Observable<INavData[]> {
    return this.navigationService.getNavigationItems();
  }
}

export const navItems: INavData[] = [
  {
    name: 'Tableau de Bord',
    url: '/dashboard',
    iconComponent: { name: 'cil-speedometer' }
  },
  {
    title: true,
    name: 'GESTION MULTI-MODULES'
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
    title: true,
    name: 'ORGANISATION'
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
      },
      {
        name: 'Paramètres Avancés',
        url: '/organisation/settings-advanced',
        icon: 'nav-icon-bullet',
        badge: {
          color: 'info',
          text: 'NOUVEAU'
        }
      }
    ]
  },
  {
    title: true,
    name: 'ADMINISTRATION'
  },
  {
    name: 'Gestion des Tenants',
    url: '/admin/tenants',
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
    title: true,
    name: 'UTILISATEUR'
  },
  {
    name: 'Mon Profil',
    url: '/profile',
    iconComponent: { name: 'cilUser' }
  },
  {
    name: 'Paramètres',
    url: '/settings',
    iconComponent: { name: 'cilSettings' }
  },
  {
    title: true,
    name: 'SYSTÈME'
  },
  {
    name: 'Authentification',
    url: '/auth',
    iconComponent: { name: 'cilLockLocked' },
    children: [
      {
        name: 'Connexion',
        url: '/auth/login',
        icon: 'nav-icon-bullet'
      },
      {
        name: 'Inscription',
        url: '/register',
        icon: 'nav-icon-bullet'
      },
      {
        name: 'Abonnement Expiré',
        url: '/subscription-expired',
        icon: 'nav-icon-bullet'
      }
    ]
  },
  // {
  //   title: true,
  //   name: 'AIDE',
  //   class: 'mt-auto'
  // },
  // {
  //   name: 'Documentation',
  //   url: 'https://coreui.io/angular/docs/',
  //   iconComponent: { name: 'cilDescription' },
  //   attributes: { target: '_blank' }
  // }
];
