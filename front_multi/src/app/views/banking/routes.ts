import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'accounts',
    pathMatch: 'full'
  },
  {
    path: 'accounts',
    loadComponent: () => import('./banking-accounts/banking-accounts.component').then(m => m.BankingAccountsComponent),
    data: { title: 'Comptes Bancaires' }
  },
  {
    path: 'transactions',
    loadComponent: () => import('./banking-transactions/banking-transactions.component').then(m => m.BankingTransactionsComponent),
    data: { title: 'Transactions Bancaires' }
  },
  {
    path: 'statistics',
    loadComponent: () => import('./banking-statistics/banking-statistics.component').then(m => m.BankingStatisticsComponent),
    data: { title: 'Statistiques Bancaires' }
  }
];
