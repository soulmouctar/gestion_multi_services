import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule, ButtonModule, FormModule, GridModule } from '@coreui/angular';
import { IconModule } from '@coreui/icons-angular';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    FormModule,
    GridModule,
    IconModule
  ],
  template: `
    <c-row>
      <c-col xs="12">
        <c-card class="mb-4">
          <c-card-header>
            <strong>Paramètres</strong>
          </c-card-header>
          <c-card-body>
            <p class="text-muted">
              Les paramètres de l'application seront bientôt disponibles.
            </p>
            
            <c-row>
              <c-col md="6" class="mb-4">
                <h6>Préférences utilisateur</h6>
                <ul class="list-unstyled">
                  <li>Langue</li>
                  <li>Fuseau horaire</li>
                  <li>Format de date</li>
                  <li>Thème</li>
                </ul>
              </c-col>
              
              <c-col md="6" class="mb-4">
                <h6>Notifications</h6>
                <ul class="list-unstyled">
                  <li>Email</li>
                  <li>SMS</li>
                  <li>Notifications push</li>
                  <li>Rappels automatiques</li>
                </ul>
              </c-col>
              
              <c-col md="6" class="mb-4">
                <h6>Sécurité</h6>
                <ul class="list-unstyled">
                  <li>Mot de passe</li>
                  <li>Authentification à deux facteurs</li>
                  <li>Sessions actives</li>
                  <li>Journal d'activité</li>
                </ul>
              </c-col>
              
              <c-col md="6" class="mb-4">
                <h6>Intégrations</h6>
                <ul class="list-unstyled">
                  <li>Orange Money</li>
                  <li>Services bancaires</li>
                  <li>API externes</li>
                  <li>Webhooks</li>
                </ul>
              </c-col>
            </c-row>
          </c-card-body>
        </c-card>
      </c-col>
    </c-row>
  `
})
export class SettingsComponent implements OnInit {
  constructor() {}
  
  ngOnInit(): void {
    // Settings initialization
  }
}
