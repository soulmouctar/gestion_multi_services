import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./taxi-dashboard/taxi-dashboard.component').then(m => m.TaxiDashboardComponent),
    title: 'Tableau de Bord Taxi'
  },
  {
    path: 'vehicles',
    loadComponent: () => import('./vehicles/taxi-list.component').then(m => m.TaxiListComponent),
    title: 'Véhicules Taxi'
  },
  {
    path: 'drivers',
    loadComponent: () => import('./drivers/drivers.component').then(m => m.DriversComponent),
    title: 'Conducteurs'
  },
  {
    path: 'assignments',
    loadComponent: () => import('./taxi-assignments/taxi-assignments.component').then(m => m.TaxiAssignmentsComponent),
    title: 'Affectations Taxi-Conducteur'
  },
  {
    path: 'daily-payments',
    loadComponent: () => import('./daily-payments/daily-payments.component').then(m => m.DailyPaymentsComponent),
    title: 'Versements Journaliers'
  },
  {
    path: 'vehicle-expenses',
    loadComponent: () => import('./vehicle-expenses/vehicle-expenses.component').then(m => m.VehicleExpensesComponent),
    title: 'Dépenses Véhicules'
  },
  {
    path: 'documents',
    loadComponent: () => import('./taxi-documents/taxi-documents.component').then(m => m.TaxiDocumentsComponent),
    title: 'Documents & Assurances'
  }
];
