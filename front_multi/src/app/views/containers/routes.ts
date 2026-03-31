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
  },
  {
    path: 'detail/:id',
    loadComponent: () => import('./container-detail/container-detail.component').then(m => m.ContainerDetailComponent),
    title: 'Détail du Conteneur'
  },
  {
    path: 'statistics',
    loadComponent: () => import('./container-statistics/container-statistics.component').then(m => m.ContainerStatisticsComponent),
    title: 'Statistiques Avancées'
  },
  {
    path: 'photos',
    loadComponent: () => import('./container-photos/container-photos.component').then(m => m.ContainerPhotosComponent),
    title: 'Photos des Conteneurs'
  },
  {
    path: 'payments',
    loadComponent: () => import('./container-payments/container-payments.component').then(m => m.ContainerPaymentsComponent),
    title: 'Suivi des Paiements'
  },
  {
    path: 'client-account/:id',
    loadComponent: () => import('./client-account/client-account.component').then(m => m.ClientAccountComponent),
    title: 'Situation du Client'
  }
];
