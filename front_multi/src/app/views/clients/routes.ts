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
    title: 'Liste des Clients'
  },
  {
    path: 'pneus',
    loadComponent: () => import('./client-list/client-list.component').then(m => m.ClientListComponent),
    title: 'Clients Pneus',
    data: {
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
      clientType: 'CONTAINER_PAGNE',
      pageTitle: 'Clients Conteneurs Pagne',
      pageDescription: 'client(s) conteneurs pagne enregistré(s)',
      createButtonLabel: 'Nouveau client conteneur'
    }
  }
];
