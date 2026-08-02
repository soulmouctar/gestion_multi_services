import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { ApiResponse, Tenant } from '../../../core/models/tenant.model';
import {
  CardModule,
  ButtonModule,
  FormModule,
  SpinnerModule,
  AlertModule,
  GridModule
} from '@coreui/angular';

@Component({
  selector: 'app-company-info',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    FormModule,
    SpinnerModule,
    AlertModule,
    GridModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './company-info.component.html',
  styleUrls: ['./company-info.component.scss']
})
export class CompanyInfoComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  companyForm: FormGroup;
  loading = false;
  saving = false;
  successMessage: string | null = null;
  error: string | null = null;
  currentOrganisation: Tenant | null = null;
  isSuperAdmin = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private tenantService: TenantService,
    private cdr: ChangeDetectorRef
  ) {
    this.companyForm = this.fb.group({
      name:    ['', [Validators.required, Validators.minLength(2)]],
      email:   ['', [Validators.email]],
      phone:   [''],
      address: [''],
    });
  }

  // ── Logo handling ─────────────────────────────────────────────────────
  logoFile: File | null = null;
  logoPreview: string | null = null;
  logoError: string | null = null;
  logoLoadFailed = false;

  get currentLogoUrl(): string | null {
    return (this.currentOrganisation as any)?.logo_url || null;
  }
  get displayedLogo(): string | null {
    return this.logoLoadFailed ? null : (this.logoPreview || this.currentLogoUrl);
  }

  onLogoLoadError(): void {
    this.logoLoadFailed = true;
    this.cdr.detectChanges();
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
      this.logoError = 'Format non supporté (JPG, PNG, WebP uniquement).';
      this.cdr.detectChanges();
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.logoError = 'Le logo ne doit pas dépasser 2 Mo.';
      this.cdr.detectChanges();
      return;
    }
    this.logoError = null;
    this.logoLoadFailed = false;
    this.logoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.logoPreview = e.target?.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  clearLogoSelection(): void {
    this.logoFile = null;
    this.logoPreview = null;
    this.logoError = null;
    this.cdr.detectChanges();
  }

  ngOnInit(): void {
    this.isSuperAdmin = this.authService.isSuperAdmin;
    this.loadOrganisationInfo();
  }

  loadOrganisationInfo(): void {
    this.loading = true;
    this.error = null;
    this.cdr.detectChanges();

    this.tenantService.getMyTenant().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: ApiResponse<Tenant>) => {
        this.currentOrganisation = response.data;
        this.logoLoadFailed = false;
        if (this.currentOrganisation) {
          this.companyForm.patchValue({
            name:    this.currentOrganisation.name  || '',
            email:   this.currentOrganisation.email || '',
            phone:   this.currentOrganisation.phone || '',
            address: (this.currentOrganisation as any).address || '',
          });
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Impossible de charger les informations de l\'organisation.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSubmit(): void {
    if (this.companyForm.invalid) return;

    this.saving = true;
    this.successMessage = null;
    this.error = null;
    this.cdr.detectChanges();

    // Construit le payload : FormData si logo selectionne, sinon JSON
    let payload: any = this.companyForm.value;
    if (this.logoFile) {
      const fd = new FormData();
      Object.entries(this.companyForm.value).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '') fd.append(k, String(v));
      });
      fd.append('logo', this.logoFile);
      payload = fd;
    }

    this.tenantService.updateMyTenant(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: ApiResponse<Tenant>) => {
        this.currentOrganisation = response.data;
        this.authService.updateCurrentTenant(response.data);
        this.logoLoadFailed = false;
        this.successMessage = 'Informations mises à jour avec succès.';
        this.saving = false;
        // On reset la selection logo : la nouvelle URL persistee s'affiche desormais
        this.logoFile = null;
        this.logoPreview = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = this.extractErrorMessage(err);
        this.saving = false;
        this.cdr.detectChanges();
      }
    });
  }

  private extractErrorMessage(err: any): string {
    const apiError = err?.error;
    if (apiError?.errors && typeof apiError.errors === 'object') {
      const first = Object.values(apiError.errors)[0] as any;
      if (Array.isArray(first) && first.length) return first[0];
      if (typeof first === 'string') return first;
    }
    return apiError?.message || err?.message || 'Erreur lors de la mise à jour.';
  }

  get f() {
    return this.companyForm.controls;
  }
}
