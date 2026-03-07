import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  },
  {
    path: 'list',
    loadComponent: () => import('./units-list/units-list.component').then(m => m.UnitsListComponent),
    title: 'Liste des Unités de Mesure'
  }
];
