import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CardModule, ButtonModule, FormModule, AlertModule, GridModule } from '@coreui/angular';
import { IconModule } from '@coreui/icons-angular';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
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
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordComponent implements OnInit {
  resetPasswordForm!: FormGroup;
  isLoading = false;
  submitted = false;
  errorMessage = '';
  successMessage = '';
  token = '';
  email = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Récupérer le token et l'email depuis les paramètres de l'URL
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    this.email = this.route.snapshot.queryParamMap.get('email') || '';
    
    if (!this.token || !this.email) {
      this.errorMessage = 'Lien de réinitialisation invalide ou expiré';
      this.cdr.detectChanges();
      return;
    }

    this.initForm();
  }

  private initForm(): void {
    this.resetPasswordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
    this.cdr.detectChanges();
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('password_confirmation');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }

  get password() {
    return this.resetPasswordForm.get('password');
  }

  get password_confirmation() {
    return this.resetPasswordForm.get('password_confirmation');
  }

  get f() {
    return this.resetPasswordForm.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.resetPasswordForm.invalid) {
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    const resetData = {
      token: this.token,
      email: this.email,
      password: this.resetPasswordForm.value.password,
      password_confirmation: this.resetPasswordForm.value.password_confirmation
    };

    this.authService.resetPassword(resetData).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success) {
          this.successMessage = 'Votre mot de passe a été réinitialisé avec succès. Vous allez être redirigé vers la page de connexion.';
          this.cdr.detectChanges();
          
          // Rediriger vers la page de connexion après 3 secondes
          setTimeout(() => {
            this.router.navigate(['/auth/login'], {
              queryParams: { message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.' }
            });
          }, 3000);
        } else {
          this.errorMessage = response.message || 'Une erreur est survenue';
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Une erreur est survenue lors de la réinitialisation du mot de passe';
        this.cdr.detectChanges();
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }
}
