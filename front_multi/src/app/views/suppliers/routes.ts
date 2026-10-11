import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  },
  {
    path: 'index',
    loadComponent: () => import('./supplier-index/supplier-index.component').then(m => m.SupplierIndexComponent),
    data: {
      title: 'INDEX comptes fournisseurs',
      module: 'CLIENTS_SUPPLIERS',
      permission: 'view_suppliers'
    }
  },
  {
    path: 'purchases',
    loadComponent: () => import('./supplier-purchases/supplier-purchases.component').then(m => m.SupplierPurchasesComponent),
    data: {
      title: 'Achats fournisseurs',
      module: 'CLIENTS_SUPPLIERS',
      permission: 'view_suppliers'
    }
  },
  {
    path: 'list',
    loadComponent: () => import('./suppliers-list/suppliers-list.component').then(m => m.SuppliersListComponent),
    title: 'Liste des Fournisseurs',
    data: {
      module: 'CLIENTS_SUPPLIERS',
      permission: 'view_suppliers'
    }
  }
];
