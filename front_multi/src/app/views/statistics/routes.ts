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
  }
];
