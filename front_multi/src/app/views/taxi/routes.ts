import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'vehicles',
    pathMatch: 'full'
  },
  {
    path: 'vehicles',
    loadComponent: () => import('./vehicles/taxi-list.component').then(m => m.TaxiListComponent),
    title: 'Véhicules Taxi'
  }
];
