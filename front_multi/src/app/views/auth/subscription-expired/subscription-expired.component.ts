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
  tenantInfo: any = {
    name: 'Entreprise Demo',
    plan: 'Professional',
    expiryDate: new Date('2024-12-31'),
    daysExpired: 15
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
  
  loadTenantInfo(): void {
    // In real app, this would come from the auth service
    this.tenantInfo = {
      name: 'Entreprise Demo',
      plan: 'Professional',
      expiryDate: new Date('2024-12-31'),
      daysExpired: 15
    };
  }
  
  selectPlan(plan: any): void {
    // Redirect to payment page with selected plan
    this.router.navigate(['/subscription/renew'], { 
      queryParams: { planId: plan.id } 
    });
  }
  
  contactSupport(): void {
    // Open support contact modal or redirect to support page
    window.location.href = 'mailto:support@saas-management.com?subject=Problème d\'abonnement';
  }
  
  logout(): void {
    this.authService.logout();
  }
}
