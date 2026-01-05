import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CardModule, ButtonModule, FormModule, AlertModule, GridModule } from '@coreui/angular';
import { IconModule } from '@coreui/icons-angular';
import { AuthService } from '../../../core/services/auth.service';

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
    GridModule,
    IconModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
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
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}
  
  ngOnInit(): void {
    this.initForm();
    
    // Check for success message from registration
    const message = this.route.snapshot.queryParamMap.get('message');
    if (message) {
      this.successMessage = message;
    }
    
    // Check if user is already logged in - use detectChanges to update view
    if (this.authService.isAuthenticated) {
      this.cdr.detectChanges();
      this.router.navigate(['/dashboard']);
    }
  }
  
  private initForm(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      remember: [false]
    });
    this.cdr.detectChanges(); // Update view after form initialization
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
    
    if (this.loginForm.invalid) {
      return;
    }
    
    this.isLoading = true;
    
    const loginData = {
      email: this.loginForm.value.email,
      password: this.loginForm.value.password,
      remember: this.loginForm.value.remember
    };
    
    this.authService.login(loginData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.cdr.detectChanges(); // Manually trigger change detection
        
        if (response.success) {
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
          
          // Ajouter un petit délai pour permettre au service de se mettre à jour
          setTimeout(() => {
            this.router.navigate([returnUrl]);
          }, 100);
        } else {
          this.errorMessage = response.message || 'Échec de connexion';
          this.cdr.detectChanges(); // Update error message
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Une erreur est survenue lors de la connexion';
        this.cdr.detectChanges(); // Update error message
      }
    });
  }
}
