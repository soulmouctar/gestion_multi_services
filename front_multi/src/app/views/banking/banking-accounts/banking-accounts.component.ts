import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  ButtonModule, CardModule, FormModule, BadgeModule,
  ModalModule, SpinnerModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-banking-accounts',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, RouterModule, IconDirective,
    ButtonModule, CardModule, FormModule, BadgeModule, ModalModule, SpinnerModule
  ],
  templateUrl: './banking-accounts.component.html'
})
export class BankingAccountsComponent implements OnInit {

  accounts: any[]  = [];
  loading          = false;
  showModal        = false;
  editMode         = false;
  submitted        = false;
  selectedAccount: any = null;
  form: FormGroup;

  bankNames = ['UBA', 'ECOBANK', 'BSIC', 'BNP', 'SGG', 'BICIGUI', 'ORABANK', 'VISTA BANK', 'AUTRE'];
  accountTypes = [
    { value: 'COURANT',       label: 'Compte Courant' },
    { value: 'EPARGNE',       label: 'Compte Épargne' },
    { value: 'DEPOT_A_TERME', label: 'Dépôt à Terme' }
  ];
  currencies = ['GNF', 'USD', 'EUR'];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      bank_name:       ['UBA',      Validators.required],
      account_number:  ['',         [Validators.required, Validators.maxLength(50)]],
      account_name:    ['',         [Validators.required, Validators.maxLength(200)]],
      account_type:    ['COURANT',  Validators.required],
      currency:        ['GNF',      Validators.required],
      opening_balance: [0,          [Validators.required, Validators.min(0)]],
      description:     ['']
    });
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.apiService.get<any>('banking/accounts').subscribe({
      next: (r) => {
        this.accounts = r.success ? (r.data || []) : [];
        this.loading  = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  openNew(): void {
    this.editMode = false;
    this.submitted = false;
    this.selectedAccount = null;
    this.form.reset({ bank_name: 'UBA', account_number: '', account_name: '', account_type: 'COURANT', currency: 'GNF', opening_balance: 0, description: '' });
    this.showModal = true;
  }

  openEdit(account: any): void {
    this.editMode = true;
    this.submitted = false;
    this.selectedAccount = account;
    this.form.patchValue({
      bank_name:      account.bank_name,
      account_number: account.account_number,
      account_name:   account.account_name,
      account_type:   account.account_type,
      currency:       account.currency,
      opening_balance: account.opening_balance,
      description:    account.description || ''
    });
    this.showModal = true;
  }

  save(): void {
    this.submitted = true;
    if (this.form.invalid) return;

    const obs = this.editMode && this.selectedAccount
      ? this.apiService.put<any>(`banking/accounts/${this.selectedAccount.id}`, this.form.value)
      : this.apiService.post<any>('banking/accounts', this.form.value);

    obs.subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ icon: 'success', title: this.editMode ? 'Compte modifié' : 'Compte créé', timer: 1500, showConfirmButton: false });
          this.showModal = false;
          this.load();
        }
      },
      error: (e) => Swal.fire({ icon: 'error', title: 'Erreur', text: e?.error?.message || 'Erreur' })
    });
  }

  toggleStatus(account: any): void {
    const newStatus = !account.is_active;
    this.apiService.put<any>(`banking/accounts/${account.id}`, { is_active: newStatus }).subscribe({
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
      this.apiService.delete<any>(`banking/accounts/${account.id}`).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Supprimé', timer: 1400, showConfirmButton: false });
          this.load();
        },
        error: (e) => Swal.fire({ icon: 'error', title: 'Erreur', text: e?.error?.message || 'Erreur' })
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
}
