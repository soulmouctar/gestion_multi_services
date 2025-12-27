import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CardModule, ButtonModule, FormModule, AlertModule, GridModule } from '@coreui/angular';
import { IconModule } from '@coreui/icons-angular';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
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
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  isLoading = false;
  submitted = false;
  errorMessage = '';
  successMessage = '';
  
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    this.initForm();
  }
  
  initForm(): void {
    this.registerForm = this.fb.group({
      // Tenant information
      tenantName: ['', Validators.required],
      tenantEmail: ['', [Validators.required, Validators.email]],
      tenantPhone: [''],
      tenantAddress: [''],
      tenantCity: [''],
      tenantCountry: [''],
      
      // User information
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      agreeTerms: [false, Validators.requiredTrue]
    }, {
      validators: this.mustMatch('password', 'confirmPassword')
    });
  }
  
  // Custom validator for password matching
  mustMatch(controlName: string, matchingControlName: string) {
    return (formGroup: FormGroup) => {
      const control = formGroup.controls[controlName];
      const matchingControl = formGroup.controls[matchingControlName];
      
      if (matchingControl.errors && !matchingControl.errors['mustMatch']) {
        return null;
      }
      
      if (control.value !== matchingControl.value) {
        matchingControl.setErrors({ mustMatch: true });
      } else {
        matchingControl.setErrors(null);
      }
      
      return null;
    };
  }
  
  get tenantName() {
    return this.registerForm.get('tenantName');
  }
  
  get tenantEmail() {
    return this.registerForm.get('tenantEmail');
  }
  
  get firstName() {
    return this.registerForm.get('firstName');
  }
  
  get lastName() {
    return this.registerForm.get('lastName');
  }
  
  get email() {
    return this.registerForm.get('email');
  }
  
  get password() {
    return this.registerForm.get('password');
  }
  
  get confirmPassword() {
    return this.registerForm.get('confirmPassword');
  }
  
  get agreeTerms() {
    return this.registerForm.get('agreeTerms');
  }
  
  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';
    
    if (this.registerForm.invalid) {
      return;
    }
    
    this.isLoading = true;
    
    const registerData = {
      // Tenant info
      tenantName: this.registerForm.value.tenantName,
      tenantEmail: this.registerForm.value.tenantEmail,
      tenantPhone: this.registerForm.value.tenantPhone,
      planId: this.registerForm.value.planId,
      
      // User info
      name: this.registerForm.value.name,
      email: this.registerForm.value.email,
      password: this.registerForm.value.password
    };
    
    this.authService.register(registerData).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = 'Compte créé avec succès! Vous allez être redirigé vers la page de connexion.';
          setTimeout(() => {
            this.router.navigate(['/auth/login'], { 
              queryParams: { message: 'Compte créé avec succès! Vous pouvez maintenant vous connecter.' }
            });
          }, 2000);
        } else {
          this.errorMessage = response.message || 'Échec de création du compte';
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error.message || 'Une erreur est survenue lors de la création du compte';
        this.isLoading = false;
      }
    });
  }
}
