import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'detail/:id',
    loadComponent: () => import('./payment-detail/payment-detail.component').then(m => m.PaymentDetailComponent),
    title: 'Détail du Reçu'
  }
];
