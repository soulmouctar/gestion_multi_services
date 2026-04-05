import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  },
  {
    path: 'list',
    loadComponent: () => import('./expenses-list/expenses-list.component').then(m => m.ExpensesListComponent),
    title: 'Dépenses Personnelles'
  },
  {
    path: 'categories',
    loadComponent: () => import('./expense-categories/expense-categories.component').then(m => m.ExpenseCategoriesComponent),
    title: 'Catégories de Dépenses'
  },
  {
    path: 'statistics',
    loadComponent: () => import('./expense-statistics/expense-statistics.component').then(m => m.ExpenseStatisticsComponent),
    title: 'Statistiques des Dépenses'
  }
];
