import { Routes } from '@angular/router';
import { NoAuthGuard } from '../../core/guards/no-auth.guard';
import { AuthGuard } from '../../core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent),
    canActivate: [NoAuthGuard],
    title: 'Connexion'
  },
  {
    path: 'register',
    loadComponent: () => import('./register/register.component').then(m => m.RegisterComponent),
    canActivate: [NoAuthGuard],
    title: "Créer un Compte"
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
    canActivate: [NoAuthGuard],
    title: 'Mot de passe oublié'
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
    canActivate: [NoAuthGuard],
    title: 'Réinitialiser le mot de passe'
  },
  {
    path: 'subscription-expired',
    loadComponent: () => import('./subscription-expired/subscription-expired.component').then(m => m.SubscriptionExpiredComponent),
    canActivate: [AuthGuard],
    title: 'Abonnement Expiré'
  }
];
