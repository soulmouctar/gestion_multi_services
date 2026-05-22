import { Routes } from '@angular/router';
import { OrganisationGuard } from '../../core/guards/organisation.guard';
import { RoleGuard } from '../../core/guards/role.guard';

export const routes: Routes = [
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
        data: {
          title: 'Utilisateurs',
          module: 'USERS',
          roles: ['SUPER_ADMIN', 'ADMIN', 'USER']
        }
      },
      {
        path: 'settings-advanced',
        loadComponent: () => import('./organisation-settings-advanced/organisation-settings-advanced.component').then(m => m.OrganisationSettingsAdvancedComponent),
        canActivate: [RoleGuard],
        data: {
          title: 'Paramètres Avancés',
          roles: ['SUPER_ADMIN', 'ADMIN']
        }
      }
    ]
  }
];
