import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  },
  {
    path: 'list',
    loadComponent: () => import('./categories-list/categories-list.component').then(m => m.CategoriesListComponent),
    title: 'Liste des Catégories'
  }
];
