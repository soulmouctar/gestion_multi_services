import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'overview',
    pathMatch: 'full'
  },
  {
    path: 'overview',
    loadComponent: () => import('./overview/statistics-overview.component').then(m => m.StatisticsOverviewComponent),
    title: 'Vue d\'ensemble des Statistiques'
  },
  {
    path: 'sales',
    loadComponent: () => import('./sales/statistics-sales.component').then(m => m.StatisticsSalesComponent),
    title: 'Statistiques des Ventes'
  },
  {
    path: 'finance',
    loadComponent: () => import('./finance/statistics-finance.component').then(m => m.StatisticsFinanceComponent),
    title: 'Statistiques Financières'
  },
  {
    path: 'inventory',
    loadComponent: () => import('./inventory/statistics-inventory.component').then(m => m.StatisticsInventoryComponent),
    title: 'Statistiques d\'Inventaire'
  }
];
