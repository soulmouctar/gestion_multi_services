import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule, RowComponent, ColComponent, ContainerComponent } from '@coreui/angular';

@Component({
  selector: 'app-statistics-inventory',
  standalone: true,
  imports: [CommonModule, CardModule, RowComponent, ColComponent, ContainerComponent],
  template: `
    <c-container>
      <c-row>
        <c-col xs="12">
          <c-card class="mb-4">
            <c-card-header><strong>Statistiques d'Inventaire</strong></c-card-header>
            <c-card-body>
              <p class="text-medium-emphasis">Les statistiques d'inventaire seront disponibles prochainement.</p>
              <div class="row text-center">
                <div class="col-md-3">
                  <c-card class="mb-3"><c-card-body><h4>0</h4><small class="text-medium-emphasis">Produits en stock</small></c-card-body></c-card>
                </div>
                <div class="col-md-3">
                  <c-card class="mb-3"><c-card-body><h4>0</h4><small class="text-medium-emphasis">Stock faible</small></c-card-body></c-card>
                </div>
                <div class="col-md-3">
                  <c-card class="mb-3"><c-card-body><h4>0</h4><small class="text-medium-emphasis">Catégories</small></c-card-body></c-card>
                </div>
                <div class="col-md-3">
                  <c-card class="mb-3"><c-card-body><h4>0</h4><small class="text-medium-emphasis">Valeur totale</small></c-card-body></c-card>
                </div>
              </div>
            </c-card-body>
          </c-card>
        </c-col>
      </c-row>
    </c-container>
  `
})
export class StatisticsInventoryComponent {}
