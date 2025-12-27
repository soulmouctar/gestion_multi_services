import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { SuperAdminGuard } from './core/guards/auth.guard';
import { SubscriptionGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
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
            path: 'tenants',
            loadComponent: () => import('./views/admin/tenants/tenants.component').then(m => m.TenantsComponent),
            title: 'Gestion des Tenants'
          },
          {
            path: 'modules',
            loadComponent: () => import('./views/admin/modules/modules.component').then(m => m.ModulesComponent),
            title: 'Gestion des Modules'
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
    path: 'auth/login',
    loadComponent: () => import('./views/auth/login/login.component').then(m => m.LoginComponent),
    title: 'Connexion'
  },
  {
    path: 'register',
    redirectTo: 'auth/register',
    pathMatch: 'full'
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./views/auth/register/register.component').then(m => m.RegisterComponent),
    title: "Créer un Compte"
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
