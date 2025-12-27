import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from '@coreui/angular';

@Component({
  selector: 'app-statistics-overview',
  standalone: true,
  imports: [CommonModule, CardModule],
  template: `
    <c-card>
      <c-card-header>
        <strong>Vue d'ensemble des Statistiques</strong>
      </c-card-header>
      <c-card-body>
        <p class="text-muted">Module statistiques en cours de développement...</p>
      </c-card-body>
    </c-card>
  `
})
export class StatisticsOverviewComponent {}
