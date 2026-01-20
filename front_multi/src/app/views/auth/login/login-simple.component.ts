import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AlertModule } from '@coreui/angular';
import { IconModule } from '@coreui/icons-angular';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login-simple',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AlertModule,
    IconModule
  ],
  template: `
    <div class="min-vh-100 d-flex flex-row align-items-center bg-light">
      <div class="container">
        <div class="row justify-content-center">
          <div class="col-md-6">
            <div class="card shadow">
              <div class="card-body p-4">
                <h1 class="mb-3">Connexion</h1>
                <p class="text-muted mb-4">Connectez-vous à votre compte</p>
                
                <c-alert *ngIf="errorMessage" color="danger" [dismissible]="false" class="mb-3">
                  {{ errorMessage }}
                </c-alert>

                <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" novalidate>
                  <div class="mb-3">
                    <div class="input-group">
                      <span class="input-group-text">
                        <svg cIcon name="cil-user"></svg>
                      </span>
                      <input
                        type="email"
                        class="form-control"
                        formControlName="email"
                        placeholder="Email"
                        [class.is-invalid]="submitted && loginForm.get('email')?.errors"
                      />
                    </div>
                    <div *ngIf="submitted && loginForm.get('email')?.errors" class="text-danger small mt-1">
                      <div *ngIf="loginForm.get('email')?.errors?.['required']">L'email est requis</div>
                      <div *ngIf="loginForm.get('email')?.errors?.['email']">Format d'email invalide</div>
                    </div>
                  </div>

                  <div class="mb-4">
                    <div class="input-group">
                      <span class="input-group-text">
                        <svg cIcon name="cil-lock-locked"></svg>
                      </span>
                      <input
                        type="password"
                        class="form-control"
                        formControlName="password"
                        placeholder="Mot de passe"
                        [class.is-invalid]="submitted && loginForm.get('password')?.errors"
                      />
                    </div>
                    <div *ngIf="submitted && loginForm.get('password')?.errors" class="text-danger small mt-1">
                      <div *ngIf="loginForm.get('password')?.errors?.['required']">Le mot de passe est requis</div>
                      <div *ngIf="loginForm.get('password')?.errors?.['minlength']">Minimum 6 caractères</div>
                    </div>
                  </div>

                  <div class="row">
                    <div class="col-6">
                      <button
                        type="submit"
                        class="btn btn-primary px-4"
                        [disabled]="isLoading"
                      >
                        <span *ngIf="isLoading" class="spinner-border spinner-border-sm me-2"></span>
                        {{ isLoading ? 'Connexion...' : 'Se connecter' }}
                      </button>
                    </div>
                    <div class="col-6 text-end">
                      <a routerLink="/auth/forgot-password" class="btn btn-link px-0">
                        Mot de passe oublié?
                      </a>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LoginSimpleComponent implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  submitted = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}
  
  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }
  
  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    
    if (this.loginForm.invalid) {
      return;
    }
    
    this.isLoading = true;
    
    const loginData = {
      email: this.loginForm.value.email,
      password: this.loginForm.value.password
    };
    
    this.authService.login(loginData).subscribe({
      next: (response) => {
        this.isLoading = false;
        
        if (response.success) {
          this.errorMessage = '';
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
          this.router.navigate([returnUrl]);
        } else {
          this.errorMessage = response.message || 'Identifiants incorrects.';
        }
      },
      error: (error) => {
        this.isLoading = false;
        
        if (error.status === 401) {
          this.errorMessage = 'Identifiants incorrects. Veuillez vérifier votre email et mot de passe.';
        } else if (error.status === 0) {
          this.errorMessage = 'Impossible de se connecter au serveur.';
        } else {
          this.errorMessage = 'Une erreur est survenue lors de la connexion.';
        }
      }
    });
  }
}
