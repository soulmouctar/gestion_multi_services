import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  },
  {
    path: 'list',
    loadComponent: () => import('./container-list/container-list.component').then(m => m.ContainerListComponent),
    title: 'Liste des Conteneurs'
  }
];
