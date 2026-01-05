import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { SubscriptionExpiredComponent } from './subscription-expired/subscription-expired.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { AuthGuard } from '../../core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    title: 'Connexion'
  },
  {
    path: 'register',
    component: RegisterComponent,
    title: "Créer un Compte"
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent,
    title: 'Mot de passe oublié'
  },
  {
    path: 'reset-password',
    component: ResetPasswordComponent,
    title: 'Réinitialiser le mot de passe'
  },
  {
    path: 'subscription-expired',
    component: SubscriptionExpiredComponent,
    canActivate: [AuthGuard],
    title: 'Abonnement Expiré'
  }
];
