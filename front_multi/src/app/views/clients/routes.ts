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
  }
];
