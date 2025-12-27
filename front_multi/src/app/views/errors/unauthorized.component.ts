import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CardModule, ButtonModule } from '@coreui/angular';
import { IconModule } from '@coreui/icons-angular';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    IconModule
  ],
  template: `
    <div class="d-flex flex-row align-items-center min-vh-100">
      <c-card class="text-center">
        <c-card-body>
          <svg cIcon name="cil-ban" size="4xl" class="text-danger mb-4"></svg>
          <h1 class="display-1">401</h1>
          <h2>Accès Non Autorisé</h2>
          <p class="text-muted">
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </p>
          <div class="d-flex justify-content-center gap-2">
            <button cButton color="primary" (click)="goBack()">
              <svg cIcon name="cil-arrow-left" class="me-2"></svg>
              Retour
            </button>
            <button cButton color="secondary" (click)="goHome()">
              <svg cIcon name="cil-home" class="me-2"></svg>
              Accueil
            </button>
          </div>
        </c-card-body>
      </c-card>
    </div>
  `
})
export class UnauthorizedComponent {
  constructor(private router: Router) {}

  goBack(): void {
    window.history.back();
  }

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }
}
