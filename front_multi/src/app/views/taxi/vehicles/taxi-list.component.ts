import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from '@coreui/angular';

@Component({
  selector: 'app-taxi-list',
  standalone: true,
  imports: [CommonModule, CardModule],
  template: `
    <c-card>
      <c-card-header>
        <strong>Liste des Véhicules Taxi</strong>
      </c-card-header>
      <c-card-body>
        <p class="text-muted">Module taxi en cours de développement...</p>
      </c-card-body>
    </c-card>
  `
})
export class TaxiListComponent {}
