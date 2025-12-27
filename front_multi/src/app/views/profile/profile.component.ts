import { Component, OnInit, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CardModule, ButtonModule, FormModule, AlertModule, GridModule, BadgeModule } from '@coreui/angular';
import { IconModule } from '@coreui/icons-angular';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    FormModule,
    AlertModule,
    GridModule,
    BadgeModule,
    IconModule
  ],
  template: `
    <c-row>
      <c-col xs="12" lg="8">
        <c-card class="mb-4">
          <c-card-header>
            <strong>Mon Profil</strong>
          </c-card-header>
          <c-card-body>
            @if (successMessage) {
              <c-alert color="success" class="mb-3">
                {{ successMessage }}
              </c-alert>
            }
            
            @if (errorMessage) {
              <c-alert color="danger" class="mb-3">
                {{ errorMessage }}
              </c-alert>
            }
            
            <form [formGroup]="profileForm" (ngSubmit)="onSubmit()">
              <c-row class="mb-3">
                <c-col sm="6">
                  <label cLabel for="name">Nom complet</label>
                  <input 
                    cFormControl 
                    id="name" 
                    formControlName="name"
                    [class.is-invalid]="submitted && name?.invalid"
                  />
                  @if (submitted && name?.invalid) {
                    <div class="invalid-feedback">
                      Le nom est requis
                    </div>
                  }
                </c-col>
                <c-col sm="6">
                  <label cLabel for="email">Email</label>
                  <input 
                    cFormControl 
                    type="email" 
                    id="email" 
                    formControlName="email"
                    [class.is-invalid]="submitted && email?.invalid"
                  />
                  @if (submitted && email?.invalid) {
                    <div class="invalid-feedback">
                      @if (email?.errors?.['required']) {
                        L'email est requis
                      } @else if (email?.errors?.['email']) {
                        Veuillez entrer un email valide
                      }
                    </div>
                  }
                </c-col>
              </c-row>
              
              <div class="d-flex gap-2">
                <button cButton color="primary" type="submit" [disabled]="isLoading">
                  @if (isLoading) {
                    <span class="spinner-border spinner-border-sm me-2"></span>
                  }
                  Mettre à jour
                </button>
                <button cButton color="secondary" type="button" (click)="changePassword()">
                  Changer le mot de passe
                </button>
              </div>
            </form>
          </c-card-body>
        </c-card>
      </c-col>
      
      <c-col xs="12" lg="4">
        <c-card class="mb-4">
          <c-card-header>
            <strong>Informations du Compte</strong>
          </c-card-header>
          <c-card-body>
            <table class="table table-sm">
              <tbody>
                <tr>
                  <td class="text-muted">Rôle</td>
                  <td><strong>{{ userRole }}</strong></td>
                </tr>
                <tr>
                  <td class="text-muted">Tenant</td>
                  <td><strong>{{ currentTenant?.name || 'N/A' }}</strong></td>
                </tr>
                <tr>
                  <td class="text-muted">Statut</td>
                  <td>
                    <c-badge [color]="isSubscriptionActive ? 'success' : 'danger'">
                      {{ isSubscriptionActive ? 'Actif' : 'Expiré' }}
                    </c-badge>
                  </td>
                </tr>
              </tbody>
            </table>
            
            <div class="d-grid">
              <button cButton color="outline-danger" (click)="logout()">
                <svg cIcon name="cil-account-logout" class="me-2"></svg>
                Se déconnecter
              </button>
            </div>
          </c-card-body>
        </c-card>
      </c-col>
    </c-row>
  `
})
export class ProfileComponent implements OnInit {
  profileForm!: FormGroup;
  isLoading = false;
  submitted = false;
  successMessage = '';
  errorMessage = '';
  
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private ngZone: NgZone
  ) {}
  
  ngOnInit(): void {
    this.initForm();
    this.loadUserData();
  }
  
  private initForm(): void {
    this.profileForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]]
    });
  }
  
  private loadUserData(): void {
    const user = this.authService.currentUser;
    if (user) {
      this.profileForm.patchValue({
        name: user.name,
        email: user.email
      });
    }
  }
  
  get name() {
    return this.profileForm.get('name');
  }
  
  get email() {
    return this.profileForm.get('email');
  }
  
  get userRole() {
    return this.authService.userRole;
  }
  
  get currentTenant() {
    return this.authService.currentTenant;
  }
  
  get isSubscriptionActive() {
    return this.authService.isSubscriptionActive;
  }
  
  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';
    
    if (this.profileForm.invalid) {
      return;
    }
    
    this.isLoading = true;
    
    this.authService.updateProfile(this.profileForm.value).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = 'Profil mis à jour avec succès!';
        } else {
          this.errorMessage = response.message || 'Échec de la mise à jour';
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error.message || 'Une erreur est survenue';
        this.isLoading = false;
      }
    });
  }
  
  changePassword(): void {
    // Navigate to change password page or open modal
    console.log('Change password functionality to be implemented');
  }
  
  logout(): void {
    // Use NgZone to ensure proper logout without Angular errors
    this.ngZone.runOutsideAngular(() => {
      this.ngZone.run(() => {
        this.authService.logout();
      });
    });
  }
}
