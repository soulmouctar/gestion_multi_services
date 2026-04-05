import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CardModule, ButtonModule, FormModule, AlertModule, GridModule, BadgeModule, SpinnerModule } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
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
    SpinnerModule,
    IconDirective
  ],
  templateUrl: './profile.component.html'
})
export class ProfileComponent implements OnInit {
  profileForm!: FormGroup;
  passwordForm!: FormGroup;

  // Photo
  selectedPhoto: File | null = null;
  photoPreview: string | null = null;
  savingAvatar = false;

  // Profile
  savingProfile = false;
  submittedProfile = false;
  successProfile = '';
  errorProfile = '';

  // Password
  savingPassword = false;
  submittedPassword = false;
  successPassword = '';
  errorPassword = '';
  showCurrentPassword = false;
  showNewPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.profileForm = this.fb.group({
      name:  ['', Validators.required],
      email: ['', [Validators.required, Validators.email]]
    });

    this.passwordForm = this.fb.group({
      current_password:      ['', Validators.required],
      new_password:          ['', [Validators.required, Validators.minLength(8)]],
      new_password_confirmation: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });

    const user = this.authService.currentUser;
    if (user) {
      this.profileForm.patchValue({ name: user.name, email: user.email });
      this.photoPreview = (user as any).avatar_url || null;
    }
  }

  private passwordMatchValidator(group: FormGroup) {
    const np = group.get('new_password')?.value;
    const nc = group.get('new_password_confirmation')?.value;
    return np === nc ? null : { passwordMismatch: true };
  }

  get f() { return this.profileForm.controls; }
  get pf() { return this.passwordForm.controls; }

  get userRole(): string { return this.authService.userRole || ''; }
  get currentTenant(): any { return this.authService.currentTenant; }
  get avatarInitial(): string {
    return (this.profileForm.get('name')?.value || 'U')[0]?.toUpperCase() || 'U';
  }
  get userAvatarBg(): string {
    const colors = ['#4F46E5','#0891B2','#059669','#D97706','#DC2626','#7C3AED'];
    const name = this.profileForm.get('name')?.value || 'U';
    return colors[name.charCodeAt(0) % colors.length];
  }

  // ─── Photo ────────────────────────────────────────────────────────────────

  triggerPhotoInput(input: HTMLInputElement): void {
    input.click();
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) {
      this.errorProfile = 'La photo ne doit pas dépasser 2 MB.';
      this.cdr.detectChanges();
      return;
    }
    this.selectedPhoto = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.photoPreview = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  saveAvatar(): void {
    if (!this.selectedPhoto) return;
    this.savingAvatar = true;
    this.errorProfile = '';
    this.cdr.detectChanges();

    this.authService.updateAvatar(this.selectedPhoto).subscribe({
      next: (res) => {
        this.photoPreview = res.data?.avatar_url || this.photoPreview;
        this.selectedPhoto = null;
        this.successProfile = 'Photo de profil mise à jour.';
        this.savingAvatar = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorProfile = err.message || 'Erreur lors de la mise à jour de la photo.';
        this.savingAvatar = false;
        this.cdr.detectChanges();
      }
    });
  }

  removePhotoPreview(): void {
    this.selectedPhoto = null;
    const user = this.authService.currentUser;
    this.photoPreview = (user as any)?.avatar_url || null;
  }

  // ─── Profil ───────────────────────────────────────────────────────────────

  onSubmitProfile(): void {
    this.submittedProfile = true;
    this.successProfile = '';
    this.errorProfile = '';

    if (this.profileForm.invalid) return;

    this.savingProfile = true;
    this.cdr.detectChanges();

    this.authService.updateProfile(this.profileForm.value).subscribe({
      next: () => {
        this.successProfile = 'Profil mis à jour avec succès.';
        this.savingProfile = false;
        this.submittedProfile = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorProfile = err.message || 'Erreur lors de la mise à jour.';
        this.savingProfile = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ─── Mot de passe ─────────────────────────────────────────────────────────

  onSubmitPassword(): void {
    this.submittedPassword = true;
    this.successPassword = '';
    this.errorPassword = '';

    if (this.passwordForm.invalid) return;

    this.savingPassword = true;
    this.cdr.detectChanges();

    const { current_password, new_password, new_password_confirmation } = this.passwordForm.value;

    this.authService.updateProfile({
      current_password,
      new_password,
      new_password_confirmation
    } as any).subscribe({
      next: () => {
        this.successPassword = 'Mot de passe modifié avec succès.';
        this.passwordForm.reset();
        this.submittedPassword = false;
        this.savingPassword = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorPassword = err.message || 'Erreur lors du changement de mot de passe.';
        this.savingPassword = false;
        this.cdr.detectChanges();
      }
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
