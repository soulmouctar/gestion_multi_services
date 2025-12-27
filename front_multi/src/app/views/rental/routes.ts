import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'properties',
    pathMatch: 'full'
  },
  {
    path: 'properties',
    loadComponent: () => import('./properties/property-list.component').then(m => m.PropertyListComponent),
    title: 'Biens Immobiliers'
  }
];
