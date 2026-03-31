import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/finance-dashboard.component').then(m => m.FinanceDashboardComponent),
    title: 'Tableau de Bord Financier'
  },
  {
    path: 'currencies',
    loadComponent: () => import('./currencies/currencies.component').then(m => m.FinanceCurrenciesComponent),
    title: 'Gestion des Devises'
  },
  {
    path: 'exchange-rates',
    loadComponent: () => import('./exchange-rates/exchange-rates.component').then(m => m.ExchangeRatesComponent),
    title: 'Taux de Change'
  },
  {
    path: 'invoices',
    loadComponent: () => import('./invoices/invoices.component').then(m => m.InvoicesComponent),
    title: 'Gestion des Factures'
  }
];
