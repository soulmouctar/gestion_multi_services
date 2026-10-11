import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CardModule, ButtonModule, AlertModule, GridModule, ProgressModule } from '@coreui/angular';
import { IconModule } from '@coreui/icons-angular';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-subscription-expired',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    AlertModule,
    GridModule,
    ProgressModule,
    IconModule
  ],
  templateUrl: './subscription-expired.component.html',
  styleUrls: ['./subscription-expired.component.scss']
})
export class SubscriptionExpiredComponent implements OnInit {
  tenantInfo: { name: string; plan: string; daysExpired: number | null } = {
    name: '—',
    plan: '—',
    daysExpired: null
  };
  
  availablePlans = [
    {
      id: 'basic',
      name: 'Basic',
      price: 29,
      features: ['5 utilisateurs', '10GB stockage', 'Support email'],
      color: 'info'
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 79,
      features: ['20 utilisateurs', '50GB stockage', 'Support prioritaire', 'API access'],
      color: 'primary',
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 199,
      features: ['Utilisateurs illimités', 'Stockage illimité', 'Support 24/7', 'API avancée', 'Personnalisation'],
      color: 'warning'
    }
  ];
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    // Load tenant information
    this.loadTenantInfo();
  }
  
  /** Organisation et abonnement réels de l'utilisateur connecté (plus de données de démonstration). */
  loadTenantInfo(): void {
    const tenant: any = this.authService.currentTenant || (this.authService.currentUser as any)?.tenant;
    if (!tenant) {
      return;
    }
    const subscription = tenant.subscription;
    const endDate = subscription?.end_date || subscription?.endDate;
    const daysExpired = endDate
      ? Math.max(0, Math.floor((Date.now() - new Date(endDate).getTime()) / 86_400_000))
      : null;

    this.tenantInfo = {
      name: tenant.name || '—',
      plan: subscription?.plan?.name || '—',
      daysExpired
    };
  }

  /**
   * Le renouvellement se fait auprès du support : il n'existe pas de paiement
   * en ligne (l'ancien lien menait à une page inexistante).
   */
  selectPlan(plan: any): void {
    const subject = `Renouvellement d'abonnement — ${this.tenantInfo.name}`;
    const body = `Bonjour,\n\nNous souhaitons renouveler notre abonnement avec la formule ${plan.name}.\n\nOrganisation : ${this.tenantInfo.name}`;
    window.location.href = `mailto:support@saas-management.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  contactSupport(): void {
    // Open support contact modal or redirect to support page
    window.location.href = 'mailto:support@saas-management.com?subject=Problème d\'abonnement';
  }
  
  logout(): void {
    this.authService.logout();
  }
}
