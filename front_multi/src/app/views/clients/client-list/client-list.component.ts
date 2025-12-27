import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from '@coreui/angular';

@Component({
  selector: 'app-client-list',
  standalone: true,
  imports: [CommonModule, CardModule],
  template: `
    <c-card>
      <c-card-header>
        <strong>Liste des Clients</strong>
      </c-card-header>
      <c-card-body>
        <p class="text-muted">Module clients en cours de développement...</p>
      </c-card-body>
    </c-card>
  `
})
export class ClientListComponent {}
