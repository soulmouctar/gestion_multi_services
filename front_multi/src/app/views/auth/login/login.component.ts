import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CardModule, ButtonModule, FormModule, AlertModule } from '@coreui/angular';
import { IconModule } from '@coreui/icons-angular';
import { AuthService } from '../../../core/services/auth.service';
import Swal from 'sweetalert2';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    FormModule,
    AlertModule,
    IconModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  submitted = false;
  errorMessage = '';
  successMessage = '';
  returnUrl = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}
  
  ngOnInit(): void {
    this.initForm();
    
    // Check for success message from registration
    const message = this.route.snapshot.queryParamMap.get('message');
    if (message) {
      this.successMessage = message;
    }
  }
  
  private initForm(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      remember: [false]
    });
  }
  
  get email() {
    return this.loginForm.get('email');
  }
  
  get password() {
    return this.loginForm.get('password');
  }
  
  get remember() {
    return this.loginForm.get('remember');
  }
  
  // Convenience getter for easy access to form fields
  get f() {
    return this.loginForm.controls;
  }
  
  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';
    
    if (this.loginForm.invalid) {
      return;
    }
    
    this.isLoading = true;
    
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
        this.errorMessage = 'La connexion prend trop de temps. Veuillez réessayer.';
      }
    }, 10000); // 10 seconds timeout
    
    const loginData = {
      email: this.loginForm.value.email,
      password: this.loginForm.value.password,
      remember: this.loginForm.value.remember
    };
    
    this.authService.login(loginData).pipe(
      finalize(() => {
        this.isLoading = false; // Always stop the loader
      })
    ).subscribe({
      next: (response) => {
        console.log('Login response:', response);
        clearTimeout(timeoutId); // Clear the timeout
        this.isLoading = false;
        
        if (response.success) {
          this.errorMessage = '';
          this.successMessage = 'Connexion réussie! Redirection en cours...';
          
          // Navigate immediately without waiting
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
          this.router.navigate([returnUrl]);
        } else {
          Swal.fire({
            icon: 'warning',
            title: 'Connexion échouée',
            text: response.message || 'Identifiants incorrects. Veuillez vérifier votre email et mot de passe.',
            confirmButtonColor: '#ffc107',
            confirmButtonText: 'OK'
          });
        }
      },
      error: (error) => {
        console.error('Login error:', error);
        clearTimeout(timeoutId); // Clear the timeout
        
        // Gestion explicite des erreurs avec SweetAlert2
        if (error.status === 401) {
          Swal.fire({
            icon: 'error',
            title: 'Identifiants incorrects',
            text: 'L\'email ou le mot de saisi est incorrect. Veuillez vérifier vos informations et réessayer.',
            confirmButtonColor: '#dc3545',
            confirmButtonText: 'OK'
          });
        } else if (error.status === 422) {
          Swal.fire({
            icon: 'error',
            title: 'Données invalides',
            text: error.error?.message || 'Les données de connexion fournies ne sont pas valides.',
            confirmButtonColor: '#dc3545',
            confirmButtonText: 'OK'
          });
        } else if (error.status === 0) {
          Swal.fire({
            icon: 'error',
            title: 'Erreur de connexion',
            text: 'Impossible de se connecter au serveur. Veuillez vérifier votre connexion internet et réessayer.',
            confirmButtonColor: '#dc3545',
            confirmButtonText: 'OK'
          });
        } else if (error.status >= 500) {
          Swal.fire({
            icon: 'error',
            title: 'Erreur serveur',
            text: 'Le serveur rencontre des difficultés techniques. Veuillez réessayer plus tard.',
            confirmButtonColor: '#dc3545',
            confirmButtonText: 'OK'
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Erreur de connexion',
            text: error.error?.message || error.message || 'Une erreur inattendue est survenue. Veuillez réessayer.',
            confirmButtonColor: '#dc3545',
            confirmButtonText: 'OK'
          });
        }
      }
    });
  }
}
