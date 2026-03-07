import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { 
  CardModule, 
  ButtonModule, 
  AlertModule,
  BadgeModule 
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

@Component({
  selector: 'app-finance-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule,
    CardModule, 
    ButtonModule, 
    AlertModule,
    BadgeModule,
    IconDirective
  ],
  template: `
    <div class="container-fluid">
      <!-- Header -->
      <div class="row mb-4">
        <div class="col-12">
          <h2 class="mb-0">
            <svg cIcon name="cilDollar" class="me-2"></svg>
            Tableau de Bord Financier
          </h2>
          <p class="text-muted mb-0">Vue d'ensemble de vos finances et transactions</p>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="row mb-4">
        <div class="col-md-3">
          <c-card class="text-center">
            <c-card-body>
              <svg cIcon name="cilCreditCard" size="xl" class="text-success mb-3"></svg>
              <h4 class="text-success">0</h4>
              <p class="text-muted mb-0">Revenus du mois</p>
            </c-card-body>
          </c-card>
        </div>
        <div class="col-md-3">
          <c-card class="text-center">
            <c-card-body>
              <svg cIcon name="cilMoney" size="xl" class="text-danger mb-3"></svg>
              <h4 class="text-danger">0</h4>
              <p class="text-muted mb-0">Dépenses du mois</p>
            </c-card-body>
          </c-card>
        </div>
        <div class="col-md-3">
          <c-card class="text-center">
            <c-card-body>
              <svg cIcon name="cilChart" size="xl" class="text-primary mb-3"></svg>
              <h4 class="text-primary">0</h4>
              <p class="text-muted mb-0">Bénéfice net</p>
            </c-card-body>
          </c-card>
        </div>
        <div class="col-md-3">
          <c-card class="text-center">
            <c-card-body>
              <svg cIcon name="cilDescription" size="xl" class="text-warning mb-3"></svg>
              <h4 class="text-warning">0</h4>
              <p class="text-muted mb-0">Factures en attente</p>
            </c-card-body>
          </c-card>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="row mb-4">
        <div class="col-12">
          <c-card>
            <c-card-header>
              <h5 class="mb-0">
                <svg cIcon name="cilSettings" class="me-2"></svg>
                Actions Rapides
              </h5>
            </c-card-header>
            <c-card-body>
              <div class="row g-3">
                <div class="col-md-3">
                  <button 
                    type="button" 
                    class="btn btn-outline-primary w-100"
                    routerLink="/finance/currencies">
                    <svg cIcon name="cilGlobeAlt" class="me-2"></svg>
                    Gestion des Devises
                  </button>
                </div>
                <div class="col-md-3">
                  <button 
                    type="button" 
                    class="btn btn-outline-success w-100"
                    routerLink="/finance/exchange-rates">
                    <svg cIcon name="cilSwapHorizontal" class="me-2"></svg>
                    Taux de Change
                  </button>
                </div>
                <div class="col-md-3">
                  <button 
                    type="button" 
                    class="btn btn-outline-warning w-100"
                    routerLink="/finance/invoices">
                    <svg cIcon name="cilDescription" class="me-2"></svg>
                    Factures
                  </button>
                </div>
                <div class="col-md-3">
                  <button 
                    type="button" 
                    class="btn btn-outline-info w-100"
                    routerLink="/finance/currencies-advanced">
                    <svg cIcon name="cilStar" class="me-2"></svg>
                    Gestion Avancée
                    <span class="badge bg-info ms-2">NOUVEAU</span>
                  </button>
                </div>
              </div>
            </c-card-body>
          </c-card>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="row">
        <div class="col-md-8">
          <c-card>
            <c-card-header>
              <h5 class="mb-0">
                <svg cIcon name="cilHistory" class="me-2"></svg>
                Activité Récente
              </h5>
            </c-card-header>
            <c-card-body>
              <c-alert color="info">
                <svg cIcon name="cilInfo" class="me-2"></svg>
                Aucune activité récente. Les transactions apparaîtront ici une fois que vous commencerez à utiliser le module financier.
              </c-alert>
            </c-card-body>
          </c-card>
        </div>
        <div class="col-md-4">
          <c-card>
            <c-card-header>
              <h5 class="mb-0">
                <svg cIcon name="cilBell" class="me-2"></svg>
                Notifications
              </h5>
            </c-card-header>
            <c-card-body>
              <c-alert color="warning">
                <svg cIcon name="cilWarning" class="me-2"></svg>
                <strong>Configuration requise</strong><br>
                Configurez vos devises et taux de change pour commencer.
              </c-alert>
            </c-card-body>
          </c-card>
        </div>
      </div>
    </div>
  `
})
export class FinanceDashboardComponent {}
