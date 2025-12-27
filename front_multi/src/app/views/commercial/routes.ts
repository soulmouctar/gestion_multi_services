import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/commercial-dashboard.component').then(m => m.CommercialDashboardComponent),
    title: 'Tableau de Bord Commercial'
  }
];
