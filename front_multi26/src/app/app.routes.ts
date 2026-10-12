import { Type } from '@angular/core';
import { Routes } from '@angular/router';

import { authGuard, guestGuard, windowGuard } from './core/auth.guard';
import { ALL_WINDOWS } from './core/windows';

type Loader = () => Promise<Type<unknown>>;

const sales: Loader = () => import('./features/commercial/sales').then((m) => m.Sales);
const stock: Loader = () => import('./features/commercial/stock').then((m) => m.Stock);
const products: Loader = () => import('./features/commercial/products').then((m) => m.Products);
const containers: Loader = () => import('./features/commercial/tyre-containers').then((m) => m.TyreContainers);
const statements: Loader = () => import('./features/textile/situation').then((m) => m.Situation);
const resourcePage: Loader = () => import('./features/resource/resource-page').then((m) => m.ResourcePage);

/** Écran de chaque fenêtre ; celles décrites comme ressource passent par la fenêtre générique. */
const SCREENS: Record<string, Loader> = {
  'tyres/sales': sales,
  'tyres/stock': stock,
  'tyres/products': products,
  'tyres/containers': containers,
  'cosmetics/sales': sales,
  'cosmetics/stock': stock,
  'cosmetics/products': products,
  'cosmetics/containers': containers,
  'commercial/clients': statements,
  'commercial/suppliers': () => import('./features/commercial/suppliers').then((m) => m.Suppliers),
  'textile/containers': () => import('./features/textile/containers').then((m) => m.Containers),
  'textile/arrivals': () => import('./features/textile/arrivals').then((m) => m.Arrivals),
  'textile/sales': () => import('./features/textile/sales').then((m) => m.Sales),
  'textile/payments': () => import('./features/textile/payments').then((m) => m.Payments),
  'textile/payments-by-period': () => import('./features/textile/period').then((m) => m.Period),
  'textile/client-statements': statements,
  'finance/statistics': () => import('./features/stats/statistics').then((m) => m.Statistics),
  'finance/payments': () => import('./features/finance/receipts').then((m) => m.Receipts),
  'finance/exchange-rates': () => import('./features/finance/rates').then((m) => m.Rates),
  'admin/tenants': () => import('./features/admin/tenants').then((m) => m.Tenants),
  'admin/organisation': () => import('./features/admin/organisation').then((m) => m.Organisation),
  'admin/users': () => import('./features/admin/users').then((m) => m.Users),
  'admin/trash': () => import('./features/admin/trash').then((m) => m.Trash),
  'admin/settings': () => import('./features/admin/settings').then((m) => m.Settings),
};

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Connexion',
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Tableau de bord',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      ...ALL_WINDOWS.map((window) => ({
        path: window.path,
        title: window.title,
        canActivate: [windowGuard],
        data: { windowPath: window.path, scope: window.path.split('/')[0], resource: window.resource, family: window.family },
        loadComponent: SCREENS[window.path] ?? resourcePage,
      })),
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
