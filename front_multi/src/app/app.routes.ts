import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { SuperAdminGuard } from './core/guards/auth.guard';
import { SubscriptionGuard } from './core/guards/auth.guard';
import { NoAuthGuard } from './core/guards/no-auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full'
  },
  {
    path: '',
    loadComponent: () => import('./layout/default-layout/default-layout.component').then(m => m.DefaultLayoutComponent),
    canActivate: [AuthGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./views/dashboard/dashboard.component').then(m => m.DashboardComponent),
        title: 'Dashboard'
      },
      {
        path: 'admin',
        canActivate: [SuperAdminGuard],
        children: [
          {
            path: 'organisations',
            loadComponent: () => import('./views/admin/tenants/tenants.component').then(m => m.TenantsComponent),
            title: 'Gestion des Organisations'
          },
          {
            path: 'modules',
            loadComponent: () => import('./views/admin/modules/modules.component').then(m => m.ModulesComponent),
            title: 'Gestion des Modules'
          },
          {
            path: 'subscription-plans',
            loadComponent: () => import('./views/admin/subscription-plans/subscription-plans.component').then(m => m.SubscriptionPlansComponent),
            title: 'Plans d\'Abonnement'
          },
          {
            path: 'subscriptions',
            loadComponent: () => import('./views/admin/subscriptions/subscriptions.component').then(m => m.SubscriptionsComponent),
            title: 'Gestion des Abonnements'
          },
          {
            path: 'statistics',
            loadComponent: () => import('./views/admin/statistics/statistics.component').then(m => m.StatisticsComponent),
            title: 'Statistiques Globales'
          },
          {
            path: 'users',
            loadComponent: () => import('./views/admin/users/users.component').then(m => m.UsersComponent),
            title: 'Gestion des Utilisateurs'
          },
          {
            path: 'roles',
            loadComponent: () => import('./views/admin/roles/roles.component').then(m => m.RolesComponent),
            title: 'Gestion des Rôles et Permissions'
          }
        ]
      },
      {
        path: 'commercial',
        loadChildren: () => import('./views/commercial/routes').then(m => m.routes)
      },
      {
        path: 'finance',
        loadChildren: () => import('./views/finance/routes').then(m => m.routes)
      },
      {
        path: 'clients',
        loadChildren: () => import('./views/clients/routes').then(m => m.routes)
      },
      {
        path: 'products',
        loadChildren: () => import('./views/products/routes').then(m => m.routes)
      },
      {
        path: 'containers',
        loadChildren: () => import('./views/containers/routes').then(m => m.routes)
      },
      {
        path: 'rental',
        loadChildren: () => import('./views/rental/routes').then(m => m.routes)
      },
      {
        path: 'taxi',
        loadChildren: () => import('./views/taxi/routes').then(m => m.routes)
      },
      {
        path: 'statistics',
        loadChildren: () => import('./views/statistics/routes').then(m => m.routes)
      },
      {
        path: 'profile',
        loadComponent: () => import('./views/profile/profile.component').then(m => m.ProfileComponent),
        title: 'Mon Profil'
      },
      {
        path: 'settings',
        loadComponent: () => import('./views/settings/settings.component').then(m => m.SettingsComponent),
        title: 'Paramètres'
      },
      {
        path: 'organisation',
        loadChildren: () => import('./views/organisation/organisation.module').then(m => m.OrganisationModule),
        title: 'Organisation'
      }
    ]
  },
  {
    path: 'auth',
    loadChildren: () => import('./views/auth/routes').then(m => m.routes)
  },
  {
    path: 'login',
    redirectTo: 'auth/login',
    pathMatch: 'full'
  },
  {
    path: 'register',
    redirectTo: 'auth/register',
    pathMatch: 'full'
  },
  {
    path: 'subscription-expired',
    redirectTo: 'auth/subscription-expired',
    pathMatch: 'full'
  },
  {
    path: 'unauthorized',
    loadComponent: () => import('./views/errors/unauthorized.component').then(m => m.UnauthorizedComponent),
    title: 'Non Autorisé'
  },
  {
    path: '**',
    loadComponent: () => import('./views/errors/not-found.component').then(m => m.NotFoundComponent),
    title: 'Page Non Trouvée'
  }
];
