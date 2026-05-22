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
      name:  ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.email]],
      phone: ['']
    });
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
        if (this.currentOrganisation) {
          this.companyForm.patchValue({
            name:  this.currentOrganisation.name  || '',
            email: this.currentOrganisation.email || '',
            phone: this.currentOrganisation.phone || ''
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

    const formData = this.companyForm.value;

    this.tenantService.updateMyTenant(formData).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: ApiResponse<Tenant>) => {
        this.currentOrganisation = response.data;
        this.successMessage = 'Informations mises à jour avec succès.';
        this.saving = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err.message || 'Erreur lors de la mise à jour.';
        this.saving = false;
        this.cdr.detectChanges();
      }
    });
  }

  get f() {
    return this.companyForm.controls;
  }
}
