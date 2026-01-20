import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OrganisationGuard } from '../../core/guards/organisation.guard';
import { RoleGuard } from '../../core/guards/role.guard';

const routes: Routes = [
  {
    path: '',
    canActivate: [OrganisationGuard],
    data: {
      title: 'Organisation',
      roles: ['SUPER_ADMIN', 'ADMIN']
    },
    children: [
      {
        path: '',
        redirectTo: 'company-info',
        pathMatch: 'full'
      },
      {
        path: 'company-info',
        loadComponent: () => import('./company-info/company-info.component').then(m => m.CompanyInfoComponent),
        canActivate: [RoleGuard],
        data: {
          title: 'Informations Entreprise',
          roles: ['SUPER_ADMIN', 'ADMIN']
        }
      },
      {
        path: 'contacts',
        loadComponent: () => import('./contacts/contacts.component').then(m => m.ContactsComponent),
        canActivate: [RoleGuard],
        data: {
          title: 'Contacts & Adresses',
          roles: ['SUPER_ADMIN', 'ADMIN']
        }
      },
      {
        path: 'users',
        loadComponent: () => import('./users/organisation-users.component').then(m => m.OrganisationUsersComponent),
        canActivate: [RoleGuard],
        data: {
          title: 'Utilisateurs',
          roles: ['SUPER_ADMIN', 'ADMIN']
        }
      },
      {
        path: 'currencies',
        loadComponent: () => import('./currencies/currencies.component').then(m => m.CurrenciesComponent),
        canActivate: [RoleGuard],
        data: {
          title: 'Devises',
          roles: ['SUPER_ADMIN', 'ADMIN']
        }
      },
      {
        path: 'invoice-headers',
        loadComponent: () => import('./invoice-headers/invoice-headers.component').then(m => m.InvoiceHeadersComponent),
        canActivate: [RoleGuard],
        data: {
          title: 'En-têtes Factures',
          roles: ['SUPER_ADMIN', 'ADMIN']
        }
      },
      {
        path: 'settings',
        loadComponent: () => import('./settings/organisation-settings.component').then(m => m.OrganisationSettingsComponent),
        canActivate: [RoleGuard],
        data: {
          title: 'Configuration',
          roles: ['SUPER_ADMIN', 'ADMIN']
        }
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class OrganisationRoutingModule { }
