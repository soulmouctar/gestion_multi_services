import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  },
  {
    path: 'list',
    loadComponent: () => import('./client-list/client-list.component').then(m => m.ClientListComponent),
    title: 'Liste des Clients',
    data: {
      module: 'CLIENTS_SUPPLIERS',
      permission: 'view_clients_general'
    }
  },
  {
    path: 'statistics',
    loadComponent: () => import('./client-statistics/client-statistics.component').then(m => m.ClientStatisticsComponent),
    title: 'Statistiques Clients',
    data: {
      module: 'CLIENTS_SUPPLIERS',
      permission: 'view_clients_general'
    }
  },
  {
    path: 'ledger/:id',
    loadComponent: () => import('./client-ledger/client-ledger.component').then(m => m.ClientLedgerComponent),
    title: 'Compte client',
    data: {
      module: 'CLIENTS_SUPPLIERS',
      permission: 'view_clients_general'
    }
  },
  {
    path: 'index',
    loadComponent: () => import('./client-index/client-index.component').then(m => m.ClientIndexComponent),
    title: 'INDEX consolidé clients',
    data: {
      module: 'CLIENTS_SUPPLIERS',
      permission: 'view_clients_general'
    }
  },
  {
    path: 'pneus',
    loadComponent: () => import('./client-list/client-list.component').then(m => m.ClientListComponent),
    title: 'Clients Pneus',
    data: {
      module: 'CLIENTS_SUPPLIERS',
      permission: 'view_clients_pneus',
      clientType: 'PNEUS',
      pageTitle: 'Clients Pneus',
      pageDescription: 'client(s) pneus enregistré(s)',
      createButtonLabel: 'Nouveau client pneus'
    }
  },
  {
    path: 'textile',
    loadComponent: () => import('./client-list/client-list.component').then(m => m.ClientListComponent),
    title: 'Clients Textile',
    data: {
      module: 'CLIENTS_SUPPLIERS',
      permission: 'view_clients_textile',
      clientType: 'TEXTILE',
      pageTitle: 'Clients Textile',
      pageDescription: 'client(s) textile enregistré(s)',
      createButtonLabel: 'Nouveau client textile'
    }
  },
  {
    path: 'cosmetiques',
    loadComponent: () => import('./client-list/client-list.component').then(m => m.ClientListComponent),
    title: 'Clients Cosmétiques',
    data: {
      module: 'CLIENTS_SUPPLIERS',
      permission: 'view_clients_cosmetiques',
      clientType: 'COSMETIQUES',
      pageTitle: 'Clients Cosmétiques',
      pageDescription: 'client(s) cosmétiques enregistré(s)',
      createButtonLabel: 'Nouveau client cosmétique'
    }
  },
  {
    path: 'conteneurs-pagne',
    loadComponent: () => import('./client-list/client-list.component').then(m => m.ClientListComponent),
    title: 'Clients Conteneurs Pagne',
    data: {
      module: 'CLIENTS_SUPPLIERS',
      permission: 'view_clients_conteneurs_pagne',
      clientType: 'CONTAINER_PAGNE',
      pageTitle: 'Clients Conteneurs Pagne',
      pageDescription: 'client(s) conteneurs pagne enregistré(s)',
      createButtonLabel: 'Nouveau client conteneur'
    }
  }
];
