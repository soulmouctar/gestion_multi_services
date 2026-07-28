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
        path: 'users',
        loadComponent: () => import('./users/organisation-users.component').then(m => m.OrganisationUsersComponent),
        data: {
          title: 'Utilisateurs',
          module: 'USERS',
          roles: ['SUPER_ADMIN', 'ADMIN', 'USER']
        }
      },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class OrganisationRoutingModule { }
