import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { 
  CardModule, 
  ButtonModule, 
  AlertModule,
  BadgeModule,
  ProgressModule 
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

@Component({
  selector: 'app-statistics-overview',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule,
    CardModule, 
    ButtonModule, 
    AlertModule,
    BadgeModule,
    ProgressModule,
    IconDirective
  ],
  template: `
    <div class="container-fluid">
      <!-- Header -->
      <div class="row mb-4">
        <div class="col-12">
          <h2 class="mb-0">
            <svg cIcon name="cilChart" class="me-2"></svg>
            Vue d'ensemble des Statistiques
          </h2>
          <p class="text-muted mb-0">Tableau de bord complet de vos performances</p>
        </div>
      </div>

      <!-- Key Performance Indicators -->
      <div class="row mb-4">
        <div class="col-md-3">
          <c-card class="text-center border-start border-4 border-success">
            <c-card-body>
              <svg cIcon name="cilDollar" size="xl" class="text-success mb-3"></svg>
              <h3 class="text-success">0 €</h3>
              <p class="text-muted mb-0">Chiffre d'affaires</p>
              <small class="text-success">+0% ce mois</small>
            </c-card-body>
          </c-card>
        </div>
        <div class="col-md-3">
          <c-card class="text-center border-start border-4 border-primary">
            <c-card-body>
              <svg cIcon name="cilPeople" size="xl" class="text-primary mb-3"></svg>
              <h3 class="text-primary">0</h3>
              <p class="text-muted mb-0">Clients actifs</p>
              <small class="text-primary">+0 nouveaux</small>
            </c-card-body>
          </c-card>
        </div>
        <div class="col-md-3">
          <c-card class="text-center border-start border-4 border-warning">
            <c-card-body>
              <svg cIcon name="cilLayers" size="xl" class="text-warning mb-3"></svg>
              <h3 class="text-warning">0</h3>
              <p class="text-muted mb-0">Produits vendus</p>
              <small class="text-warning">+0% ce mois</small>
            </c-card-body>
          </c-card>
        </div>
        <div class="col-md-3">
          <c-card class="text-center border-start border-4 border-info">
            <c-card-body>
              <svg cIcon name="cilTruck" size="xl" class="text-info mb-3"></svg>
              <h3 class="text-info">0</h3>
              <p class="text-muted mb-0">Commandes traitées</p>
              <small class="text-info">+0% ce mois</small>
            </c-card-body>
          </c-card>
        </div>
      </div>

      <!-- Module Statistics -->
      <div class="row mb-4">
        <div class="col-12">
          <c-card>
            <c-card-header>
              <h5 class="mb-0">
                <svg cIcon name="cilApps" class="me-2"></svg>
                Statistiques par Module
              </h5>
            </c-card-header>
            <c-card-body>
              <div class="row g-3">
                <div class="col-md-6">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <span>
                      <svg cIcon name="cilCart" class="me-2 text-primary"></svg>
                      Commerce
                    </span>
                    <span class="badge bg-primary">Actif</span>
                  </div>
                  <c-progress [value]="75" class="mb-3">
                    <c-progress-bar color="primary">75% d'utilisation</c-progress-bar>
                  </c-progress>
                </div>
                <div class="col-md-6">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <span>
                      <svg cIcon name="cilDollar" class="me-2 text-success"></svg>
                      Finance
                    </span>
                    <span class="badge bg-success">Actif</span>
                  </div>
                  <c-progress [value]="60" class="mb-3">
                    <c-progress-bar color="success">60% d'utilisation</c-progress-bar>
                  </c-progress>
                </div>
                <div class="col-md-6">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <span>
                      <svg cIcon name="cilLayers" class="me-2 text-warning"></svg>
                      Conteneurs
                    </span>
                    <span class="badge bg-warning">Actif</span>
                  </div>
                  <c-progress [value]="45" class="mb-3">
                    <c-progress-bar color="warning">45% d'utilisation</c-progress-bar>
                  </c-progress>
                </div>
                <div class="col-md-6">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <span>
                      <svg cIcon name="cilLocationPin" class="me-2 text-info"></svg>
                      Taxi & Transport
                    </span>
                    <span class="badge bg-info">Actif</span>
                  </div>
                  <c-progress [value]="30" class="mb-3">
                    <c-progress-bar color="info">30% d'utilisation</c-progress-bar>
                  </c-progress>
                </div>
              </div>
            </c-card-body>
          </c-card>
        </div>
      </div>

      <!-- Quick Access to Detailed Statistics -->
      <div class="row mb-4">
        <div class="col-12">
          <c-card>
            <c-card-header>
              <h5 class="mb-0">
                <svg cIcon name="cilZoom" class="me-2"></svg>
                Statistiques Détaillées
              </h5>
            </c-card-header>
            <c-card-body>
              <div class="row g-3">
                <div class="col-md-4">
                  <button 
                    type="button" 
                    class="btn btn-outline-primary w-100"
                    routerLink="/statistics/sales">
                    <svg cIcon name="cilCart" class="me-2"></svg>
                    Statistiques des Ventes
                  </button>
                </div>
                <div class="col-md-4">
                  <button 
                    type="button" 
                    class="btn btn-outline-success w-100"
                    routerLink="/statistics/finance">
                    <svg cIcon name="cilDollar" class="me-2"></svg>
                    Statistiques Financières
                  </button>
                </div>
                <div class="col-md-4">
                  <button 
                    type="button" 
                    class="btn btn-outline-warning w-100"
                    routerLink="/statistics/inventory">
                    <svg cIcon name="cilLayers" class="me-2"></svg>
                    Statistiques d'Inventaire
                  </button>
                </div>
              </div>
            </c-card-body>
          </c-card>
        </div>
      </div>

      <!-- Recent Trends -->
      <div class="row">
        <div class="col-md-8">
          <c-card>
            <c-card-header>
              <h5 class="mb-0">
                <svg cIcon name="cilGraph" class="me-2"></svg>
                Tendances Récentes
              </h5>
            </c-card-header>
            <c-card-body>
              <c-alert color="info">
                <svg cIcon name="cilInfo" class="me-2"></svg>
                Les graphiques de tendances apparaîtront ici une fois que vous aurez des données d'activité.
                Commencez à utiliser les différents modules pour voir vos statistiques.
              </c-alert>
            </c-card-body>
          </c-card>
        </div>
        <div class="col-md-4">
          <c-card>
            <c-card-header>
              <h5 class="mb-0">
                <svg cIcon name="cilTarget" class="me-2"></svg>
                Objectifs
              </h5>
            </c-card-header>
            <c-card-body>
              <div class="mb-3">
                <div class="d-flex justify-content-between mb-1">
                  <span class="small">Ventes mensuelles</span>
                  <span class="small">0%</span>
                </div>
                <c-progress [value]="0" size="sm">
                  <c-progress-bar color="success"></c-progress-bar>
                </c-progress>
              </div>
              <div class="mb-3">
                <div class="d-flex justify-content-between mb-1">
                  <span class="small">Nouveaux clients</span>
                  <span class="small">0%</span>
                </div>
                <c-progress [value]="0" size="sm">
                  <c-progress-bar color="primary"></c-progress-bar>
                </c-progress>
              </div>
              <div class="mb-3">
                <div class="d-flex justify-content-between mb-1">
                  <span class="small">Satisfaction client</span>
                  <span class="small">0%</span>
                </div>
                <c-progress [value]="0" size="sm">
                  <c-progress-bar color="warning"></c-progress-bar>
                </c-progress>
              </div>
            </c-card-body>
          </c-card>
        </div>
      </div>
    </div>
  `
})
export class StatisticsOverviewComponent {}
