import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  ButtonModule, CardModule, FormModule, BadgeModule,
  ModalModule, SpinnerModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import Swal from 'sweetalert2';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-banking-accounts',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, RouterModule, IconDirective,
    ButtonModule, CardModule, FormModule, BadgeModule, ModalModule, SpinnerModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './banking-accounts.component.html'
})
export class BankingAccountsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  accounts: any[]  = [];
  loading          = false;
  showModal        = false;
  editMode         = false;
  submitted        = false;
  selectedAccount: any = null;
  form: FormGroup;
  selectedLogoFile: File | null = null;
  logoPreview: string | null = null;

  // Super Admin tenant selector
  isSuperAdmin     = false;
  tenants: any[]   = [];
  selectedTenantId: number | null = null;

  bankNames = ['UBA', 'ECOBANK', 'BSIC', 'BNP', 'SGG', 'BICIGUI', 'ORABANK', 'VISTA BANK', 'AUTRE'];
  accountTypes = [
    { value: 'COURANT',       label: 'Compte Courant' },
    { value: 'EPARGNE',       label: 'Compte Épargne' },
    { value: 'DEPOT_A_TERME', label: 'Dépôt à Terme' }
  ];
  currencies = ['GNF', 'USD', 'EUR'];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private apiService: ApiService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      bank_name:       ['UBA',      Validators.required],
      account_number:  ['',         [Validators.required, Validators.maxLength(50)]],
      account_name:    ['',         [Validators.required, Validators.maxLength(200)]],
      account_type:    ['COURANT',  Validators.required],
      currency:        ['GNF',      Validators.required],
      opening_balance: [0,          [Validators.required, Validators.min(0)]],
      description:     [''],
      brand_color:     ['#d62b1f', Validators.required]
    });
  }

  ngOnInit(): void {
    this.isSuperAdmin = this.authService.isSuperAdmin;
    this.selectedTenantId = this.authService.selectedManagedTenantId;
    if (this.isSuperAdmin) {
      this.loadTenants();
    } else {
      this.load();
    }
  }

  private loadTenants(): void {
    this.apiService.get<any>('tenants?per_page=200').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        const data = r.success ? (r.data?.data || r.data || []) : [];
        this.tenants = data;
        if (this.tenants.length > 0 && !this.selectedTenantId) {
          this.selectedTenantId = this.tenants[0].id;
          this.authService.setSelectedManagedTenantId(this.selectedTenantId);
        }
        this.cdr.detectChanges();
        this.load();
      },
      error: () => { this.cdr.detectChanges(); }
    });
  }

  onTenantChange(): void {
    this.authService.setSelectedManagedTenantId(this.selectedTenantId);
    this.load();
  }

  private tenantParam(): string {
    return this.isSuperAdmin && this.selectedTenantId
      ? `?tenant_id=${this.selectedTenantId}`
      : '';
  }

  load(): void {
    if (this.isSuperAdmin && !this.selectedTenantId) return;
    this.loading = true;
    this.apiService.get<any>(`banking/accounts${this.tenantParam()}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.accounts = r.success ? (r.data || []) : [];
        this.loading  = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  openNew(): void {
    if (this.isSuperAdmin && !this.selectedTenantId) {
      Swal.fire({ icon: 'warning', title: 'Sélectionnez un tenant', text: 'Choisissez d\'abord l\'organisation à gérer.' });
      return;
    }
    this.editMode = false;
    this.submitted = false;
    this.selectedAccount = null;
    this.selectedLogoFile = null;
    this.logoPreview = null;
    this.form.reset({
      bank_name: 'UBA',
      account_number: '',
      account_name: '',
      account_type: 'COURANT',
      currency: 'GNF',
      opening_balance: 0,
      description: '',
      brand_color: '#d62b1f'
    });
    this.showModal = true;
  }

  openEdit(account: any): void {
    this.editMode = true;
    this.submitted = false;
    this.selectedAccount = account;
    this.selectedLogoFile = null;
    this.logoPreview = account.logo_url || null;
    this.form.patchValue({
      bank_name:      account.bank_name,
      account_number: account.account_number,
      account_name:   account.account_name,
      account_type:   account.account_type,
      currency:       account.currency,
      opening_balance: account.opening_balance,
      description:    account.description || '',
      brand_color:    account.brand_color || this.bankColor(account.bank_name)
    });
    this.showModal = true;
  }

  save(): void {
    this.submitted = true;
    if (this.form.invalid) return;

    const formData = new FormData();
    Object.entries(this.form.value).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        formData.append(key, String(value));
      }
    });
    if (this.isSuperAdmin && this.selectedTenantId) {
      formData.append('tenant_id', String(this.selectedTenantId));
    }
    if (this.selectedLogoFile) {
      formData.append('logo', this.selectedLogoFile);
    }
    if (this.editMode && !this.logoPreview && this.selectedAccount?.logo_url) {
      formData.append('remove_logo', '1');
    }

    const request$ = this.editMode && this.selectedAccount
      ? this.http.post<any>(`${environment.apiUrl}/banking/accounts/${this.selectedAccount.id}?_method=PUT`, formData)
      : this.http.post<any>(`${environment.apiUrl}/banking/accounts`, formData);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ icon: 'success', title: this.editMode ? 'Compte modifié' : 'Compte créé', timer: 1500, showConfirmButton: false });
          this.showModal = false;
          this.load();
        }
      },
      error: (e) => Swal.fire({ icon: 'error', title: 'Erreur', text: e?.message || 'Erreur' })
    });
  }

  onLogoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] || null;
    this.selectedLogoFile = file;
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.logoPreview = String(reader.result || '');
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  clearLogo(): void {
    this.selectedLogoFile = null;
    this.logoPreview = null;
    this.cdr.detectChanges();
  }

  toggleStatus(account: any): void {
    const newStatus = !account.is_active;
    this.apiService.put<any>(`banking/accounts/${account.id}`, { is_active: newStatus }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { if (r.success) this.load(); },
      error: () => Swal.fire({ icon: 'error', title: 'Erreur lors de la mise à jour' })
    });
  }

  delete(account: any): void {
    Swal.fire({
      title: `Supprimer le compte "${account.account_name}" ?`,
      text: 'Toutes les transactions associées seront supprimées.',
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#d33', cancelButtonColor: '#6c757d',
      confirmButtonText: 'Supprimer', cancelButtonText: 'Annuler'
    }).then(res => {
      if (!res.isConfirmed) return;
      this.apiService.delete<any>(`banking/accounts/${account.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Supprimé', timer: 1400, showConfirmButton: false });
          this.load();
        },
        error: (e) => Swal.fire({ icon: 'error', title: 'Erreur', text: e?.message || 'Erreur' })
      });
    });
  }

  fmt(v: number, currency = 'GNF'): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0 }).format(v || 0) + ' ' + currency;
  }

  accountTypeLabel(type: string): string {
    return this.accountTypes.find(t => t.value === type)?.label || type;
  }

  bankColor(name: string): string {
    const colors: Record<string, string> = {
      'UBA': '#d62b1f', 'ECOBANK': '#002366', 'BSIC': '#1a5276',
      'BNP': '#006632', 'SGG': '#c0392b', 'BICIGUI': '#f39c12',
      'ORABANK': '#e67e22', 'VISTA BANK': '#8e44ad'
    };
    return colors[name] || '#6c757d';
  }

  accountBrandColor(account: any): string {
    return account?.brand_color || this.bankColor(account?.bank_name);
  }

  get selectedTenantName(): string {
    return this.tenants.find(t => t.id === this.selectedTenantId)?.name || '';
  }

  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }
}
