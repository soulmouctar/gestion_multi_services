import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'settings',
    pathMatch: 'full'
  },
  {
    path: 'settings',
    loadComponent: () => import('./organisation-settings/organisation-settings.component').then(m => m.OrganisationSettingsComponent),
    title: 'Paramètres de l\'Organisation'
  },
  {
    path: 'contacts',
    loadComponent: () => import('./contacts/contacts.component').then(m => m.ContactsComponent),
    title: 'Contacts'
  },
  {
    path: 'invoice-headers',
    loadComponent: () => import('./invoice-headers/invoice-headers.component').then(m => m.InvoiceHeadersComponent),
    title: 'En-têtes de Factures'
  },
  {
    path: 'settings-advanced',
    loadComponent: () => import('./organisation-settings-advanced/organisation-settings-advanced.component').then(m => m.OrganisationSettingsAdvancedComponent),
    title: 'Paramètres Avancés'
  }
];
