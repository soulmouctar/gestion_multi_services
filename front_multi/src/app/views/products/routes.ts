import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  },
  {
    path: 'list',
    loadComponent: () => import('./products-list/products-list.component').then(m => m.ProductsListComponent),
    title: 'Liste des Produits'
  },
  {
    path: 'create',
    loadComponent: () => import('./product-form/product-form.component').then(m => m.ProductFormComponent),
    title: 'Nouveau Produit'
  },
  {
    path: 'edit/:id',
    loadComponent: () => import('./product-form/product-form.component').then(m => m.ProductFormComponent),
    title: 'Modifier Produit'
  },
  {
    path: 'view/:id',
    loadComponent: () => import('./product-detail/product-detail.component').then(m => m.ProductDetailComponent),
    title: 'Détails du Produit'
  },
  {
    path: 'returns',
    loadComponent: () => import('./product-returns/product-returns.component').then(m => m.ProductReturnsComponent),
    title: 'Retours de Produits'
  }
];
