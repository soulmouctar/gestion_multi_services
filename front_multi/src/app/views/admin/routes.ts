import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    data: {
      title: 'Administration'
    },
    children: [
      {
        path: '',
        redirectTo: 'tenants',
        pathMatch: 'full'
      },
      {
        path: 'tenants',
        loadComponent: () => import('./tenants/tenants.component').then(m => m.TenantsComponent),
        data: {
          title: 'Gestion des Tenants'
        }
      },
      {
        path: 'modules',
        loadComponent: () => import('./modules/modules.component').then(m => m.ModulesComponent),
        data: {
          title: 'Gestion des Modules'
        }
      },
      {
        path: 'subscriptions',
        loadComponent: () => import('./subscriptions/subscriptions.component').then(m => m.SubscriptionsComponent),
        data: {
          title: 'Gestion des Abonnements'
        }
      },
      {
        path: 'subscription-plans',
        loadComponent: () => import('./subscription-plans/subscription-plans.component').then(m => m.SubscriptionPlansComponent),
        data: {
          title: 'Plans d\'Abonnement'
        }
      },
      {
        path: 'users',
        loadComponent: () => import('./users/users.component').then(m => m.UsersComponent),
        data: {
          title: 'Gestion des Utilisateurs'
        }
      },
      {
        path: 'roles',
        loadComponent: () => import('./roles/roles.component').then(m => m.RolesComponent),
        data: {
          title: 'Gestion des Rôles et Permissions'
        }
      }
    ]
  }
];
