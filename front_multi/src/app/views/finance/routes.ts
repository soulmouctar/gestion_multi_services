import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/finance-dashboard.component').then(m => m.FinanceDashboardComponent),
    title: 'Tableau de Bord Financier'
  }
];
