import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from '@coreui/angular';

@Component({
  selector: 'app-commercial-dashboard',
  standalone: true,
  imports: [CommonModule, CardModule],
  template: `
    <c-card>
      <c-card-header>
        <strong>Tableau de Bord Commercial</strong>
      </c-card-header>
      <c-card-body>
        <p class="text-muted">Module commercial en cours de développement...</p>
      </c-card-body>
    </c-card>
  `
})
export class CommercialDashboardComponent {}
