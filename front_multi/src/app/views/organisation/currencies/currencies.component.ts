import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { 
  CardModule, 
  ButtonModule, 
  TableModule, 
  ModalModule, 
  FormModule, 
  BadgeModule,
  SpinnerModule,
  AlertModule,
  GridModule 
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { OrganisationCurrencyService, OrganisationCurrency } from '../../../core/services/organisation-currency.service';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-currencies',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    CardModule,
    ButtonModule,
    TableModule,
    ModalModule,
    FormModule,
    BadgeModule,
    SpinnerModule,
    AlertModule,
    GridModule,
    IconDirective
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './currencies.component.html',
  styleUrls: ['./currencies.component.scss']
})
export class CurrenciesComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  currencyForm: FormGroup;
  currencies: OrganisationCurrency[] = [];
  loading = false;
  saving = false;
  editingCurrency: OrganisationCurrency | null = null;
  showModal = false;
  tenantSelectionRequired = false;
  managedTenants: any[] = [];
  tenantsLoading = false;
  selectedTenantId: number | null = null;
  selectedStatusFilter: 'all' | 'active' | 'inactive' = 'all';

  commonCurrencies = [
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'USD', name: 'Dollar américain', symbol: '$' },
    { code: 'GBP', name: 'Livre sterling', symbol: '£' },
    { code: 'CHF', name: 'Franc suisse', symbol: 'CHF' },
    { code: 'CAD', name: 'Dollar canadien', symbol: 'C$' },
    { code: 'JPY', name: 'Yen japonais', symbol: '¥' },
    { code: 'CNY', name: 'Yuan chinois', symbol: '¥' },
    { code: 'AUD', name: 'Dollar australien', symbol: 'A$' }
  ];

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private currencyService: OrganisationCurrencyService,
    private authService: AuthService,
    private tenantService: TenantService
  ) {
    this.currencyForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
      name: ['', [Validators.required, Validators.minLength(2)]],
      symbol: ['', [Validators.required, Validators.minLength(1)]],
      exchange_rate: [1, [Validators.required, Validators.min(0.0001)]],
      is_default: [false],
      is_active: [true]
    });
  }

  ngOnInit(): void {
    this.selectedTenantId = this.authService.selectedManagedTenantId;
    if (this.authService.isSuperAdmin) {
      this.loadTenants();
    }
    this.loadCurrencies();
  }

  get isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin;
  }

  loadCurrencies(): void {
    if (this.authService.isSuperAdmin && !this.authService.selectedManagedTenantId) {
      this.currencies = [];
      this.loading = false;
      this.tenantSelectionRequired = true;
      this.cdr.detectChanges();
      return;
    }

    this.tenantSelectionRequired = false;
    this.loading = true;
    const isActive =
      this.selectedStatusFilter === 'all'
        ? undefined
        : this.selectedStatusFilter === 'active';

    this.currencyService.getCurrencies(isActive).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.success) {
          this.currencies = response.data;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: 'Impossible de charger les devises.',
          confirmButtonColor: '#dc3545'
        });
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadTenants(): void {
    this.tenantsLoading = true;
    this.tenantService.getTenants().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        const tenants = response.data as any;
        this.managedTenants = Array.isArray(tenants) ? tenants : (tenants?.data || []);
        this.tenantsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.managedTenants = [];
        this.tenantsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onTenantFilterChange(): void {
    this.authService.setSelectedManagedTenantId(this.selectedTenantId);
    this.loadCurrencies();
  }

  onStatusFilterChange(): void {
    this.loadCurrencies();
  }

  openModal(currency?: OrganisationCurrency): void {
    if (this.authService.isSuperAdmin && !this.authService.selectedManagedTenantId) {
      this.tenantSelectionRequired = true;
      Swal.fire({
        icon: 'info',
        title: 'Organisation requise',
        text: 'Sélectionnez d’abord une organisation avant de gérer les devises.',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    this.editingCurrency = currency || null;
    if (currency) {
      this.currencyForm.patchValue(currency);
    } else {
      this.currencyForm.reset({
        exchange_rate: 1,
        is_default: false,
        is_active: true
      });
    }
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingCurrency = null;
    this.currencyForm.reset();
  }

  selectCommonCurrency(currency: any): void {
    this.currencyForm.patchValue({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol
    });
  }

  onSubmit(): void {
    if (this.currencyForm.valid) {
      this.saving = true;
      const formData = this.currencyForm.value;
      
      // Ensure code is uppercase
      formData.code = formData.code.toUpperCase();
      
      if (this.editingCurrency) {
        // Update existing currency
        this.currencyService.updateCurrency(this.editingCurrency.id!, formData).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (response) => {
            if (response.success) {
              const index = this.currencies.findIndex(c => c.id === this.editingCurrency!.id);
              if (index !== -1) {
                this.currencies[index] = response.data;
              }
              this.saving = false;
              this.closeModal();
              Swal.fire({
                icon: 'success',
                title: 'Succès',
                text: 'Devise mise à jour avec succès!',
                confirmButtonColor: '#28a745'
              });
            }
          },
          error: (error) => {
            this.saving = false;
            let errorMessage = 'Impossible de mettre à jour la devise.';
            if (error.error?.message?.includes('already exists')) {
              errorMessage = 'Ce code de devise existe déjà.';
            }
            Swal.fire({
              icon: 'error',
              title: 'Erreur',
              text: errorMessage,
              confirmButtonColor: '#dc3545'
            });
          }
        });
      } else {
        // Create new currency
        this.currencyService.createCurrency(formData).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (response) => {
            if (response.success) {
              this.currencies.push(response.data);
              this.saving = false;
              this.closeModal();
              Swal.fire({
                icon: 'success',
                title: 'Succès',
                text: 'Devise créée avec succès!',
                confirmButtonColor: '#28a745'
              });
            }
          },
          error: (error) => {
            this.saving = false;
            let errorMessage = 'Impossible de créer la devise.';
            if (error.error?.message?.includes('already exists')) {
              errorMessage = 'Ce code de devise existe déjà.';
            }
            Swal.fire({
              icon: 'error',
              title: 'Erreur',
              text: errorMessage,
              confirmButtonColor: '#dc3545'
            });
          }
        });
      }
    }
  }

  setAsDefault(currency: OrganisationCurrency): void {
    this.currencyService.setAsDefault(currency.id!).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.success) {
          // Update local currencies array
          this.currencies.forEach(c => {
            c.is_default = c.id === currency.id;
          });
          Swal.fire({
            icon: 'success',
            title: 'Succès',
            text: 'Devise définie comme par défaut.',
            confirmButtonColor: '#28a745'
          });
        }
      },
      error: (error) => {
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: 'Impossible de définir la devise comme par défaut.',
          confirmButtonColor: '#dc3545'
        });
      }
    });
  }

  toggleStatus(currency: OrganisationCurrency): void {
    this.currencyService.toggleStatus(currency.id!).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.success) {
          const index = this.currencies.findIndex(c => c.id === currency.id);
          if (index !== -1) {
            this.currencies[index] = response.data;
          }
          const status = response.data.is_active ? 'activée' : 'désactivée';
          Swal.fire({
            icon: 'success',
            title: 'Succès',
            text: `Devise ${status} avec succès.`,
            confirmButtonColor: '#28a745'
          });
        }
      },
      error: (error) => {
        let errorMessage = 'Impossible de changer le statut de la devise.';
        if (error.error?.message?.includes('Cannot deactivate')) {
          errorMessage = 'Impossible de désactiver la devise par défaut.';
        }
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: errorMessage,
          confirmButtonColor: '#dc3545'
        });
      }
    });
  }

  deleteCurrency(currency: OrganisationCurrency): void {
    Swal.fire({
      title: 'Êtes-vous sûr?',
      text: `Voulez-vous vraiment supprimer la devise "${currency.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler'
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.currencyService.deleteCurrency(currency.id!).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (response) => {
            if (response.success) {
              this.currencies = this.currencies.filter(c => c.id !== currency.id);
              Swal.fire({
                icon: 'success',
                title: 'Supprimé!',
                text: 'La devise a été supprimée.',
                confirmButtonColor: '#28a745'
              });
            }
          },
          error: (error) => {
            let errorMessage = 'Impossible de supprimer la devise.';
            if (error.error?.message?.includes('Cannot delete')) {
              errorMessage = 'Impossible de supprimer la seule devise.';
            }
            Swal.fire({
              icon: 'error',
              title: 'Erreur',
              text: errorMessage,
              confirmButtonColor: '#dc3545'
            });
          }
        });
      }
    });
  }

  get f() {
    return this.currencyForm.controls;
  }
  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }

}
