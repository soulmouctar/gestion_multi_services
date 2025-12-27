import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from '@coreui/angular';

@Component({
  selector: 'app-property-list',
  standalone: true,
  imports: [CommonModule, CardModule],
  template: `
    <c-card>
      <c-card-header>
        <strong>Liste des Biens Immobiliers</strong>
      </c-card-header>
      <c-card-body>
        <p class="text-muted">Module location immobilière en cours de développement...</p>
      </c-card-body>
    </c-card>
  `
})
export class PropertyListComponent {}
