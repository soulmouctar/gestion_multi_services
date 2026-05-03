import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  },
  {
    path: 'list',
    loadComponent: () => import('./payments-list/payments-list.component').then(m => m.PaymentsListComponent),
    title: 'Liste des Paiements'
  },
  {
    path: 'detail/:id',
    loadComponent: () => import('./payment-detail/payment-detail.component').then(m => m.PaymentDetailComponent),
    title: 'Détail du Reçu'
  },
  {
    path: 'advanced',
    loadComponent: () => import('./payments-advanced/payments-advanced.component').then(m => m.PaymentsAdvancedComponent),
    title: 'Gestion Avancée des Paiements'
  }
];
