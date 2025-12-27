import { INavData } from '@coreui/angular';

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
    iconComponent: { name: 'cilBasket' }
  },
  {
    name: 'Finance',
    url: '/finance',
    iconComponent: { name: 'cilDollar' }
  },
  {
    name: 'Clients & Fournisseurs',
    url: '/clients',
    iconComponent: { name: 'cilPeople' }
  },
  {
    name: 'Produits & Stock',
    url: '/products',
    iconComponent: { name: 'cilGrid' }
  },
  {
    name: 'Conteneurs',
    url: '/containers',
    iconComponent: { name: 'cilLayers' }
  },
  {
    name: 'Location',
    url: '/rental',
    iconComponent: { name: 'cilHome' }
  },
  {
    name: 'Taxi & Transport',
    url: '/taxi',
    iconComponent: { name: 'cilLocationPin' }
  },
  {
    name: 'Statistiques',
    url: '/statistics',
    iconComponent: { name: 'cilChart' }
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
