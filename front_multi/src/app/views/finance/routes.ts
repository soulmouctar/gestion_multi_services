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
  },
  {
    path: 'invoices/:id',
    loadComponent: () => import('./invoices/invoice-detail/invoice-detail.component').then(m => m.InvoiceDetailComponent),
    title: 'Détail de la facture'
  },
  {
    path: 'sales-summary',
    loadComponent: () => import('./sales-summary/sales-summary.component').then(m => m.SalesSummaryComponent),
    title: 'Synthèse des ventes'
  }
];
