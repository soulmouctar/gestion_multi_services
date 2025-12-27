import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  },
  {
    path: 'list',
    loadComponent: () => import('./product-list/product-list.component').then(m => m.ProductListComponent),
    title: 'Liste des Produits'
  }
];
