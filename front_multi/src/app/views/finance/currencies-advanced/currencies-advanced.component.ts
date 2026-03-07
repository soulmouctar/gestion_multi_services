import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import { AlertService } from '../../../core/services/alert.service';

@Component({
  selector: 'app-currencies-advanced',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './currencies-advanced.component.html'
})
export class CurrenciesAdvancedComponent implements OnInit {
  currencies: any[] = [];
  loading = false;
  actionLoading = false;

  constructor(
    private apiService: ApiService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCurrencies();
  }

  loadCurrencies(): void {
    this.loading = true;
    this.apiService.get<any>('currencies-public').subscribe({
      next: (r) => {
        console.log('Currencies API response:', r);
        if (r.success && r.data) {
          this.currencies = Array.isArray(r.data) ? r.data : (r.data.data || r.data);
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading currencies:', err);
        this.alertService.showError('Erreur', 'Impossible de charger les devises');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  setAsDefault(currency: any): void {
    this.actionLoading = true;
    this.apiService.post<any>(`currencies-public/${currency.id}/set-default`, {}).subscribe({
      next: (r) => {
        if (r.success) {
          this.alertService.showSuccess('Succès', `${currency.name} définie comme devise par défaut`);
          this.loadCurrencies();
        }
        this.actionLoading = false;
      },
      error: (err) => {
        console.error('Error setting default currency:', err);
        this.alertService.showError('Erreur', err?.error?.message || 'Erreur lors de la mise à jour');
        this.actionLoading = false;
      }
    });
  }

  toggleStatus(currency: any): void {
    // Prevent disabling default currency
    if (currency.is_default && currency.is_active) {
      this.alertService.showWarning(
        'Action impossible',
        'Impossible de désactiver la devise par défaut. Veuillez d\'abord définir une autre devise comme devise par défaut.'
      );
      return;
    }

    this.actionLoading = true;
    this.apiService.post<any>(`currencies-public/${currency.id}/toggle-status`, {}).subscribe({
      next: (r) => {
        if (r.success) {
          const newStatus = currency.is_active ? 'désactivée' : 'activée';
          this.alertService.showSuccess('Succès', `${currency.name} ${newStatus} avec succès`);
          this.loadCurrencies();
        }
        this.actionLoading = false;
      },
      error: (err) => {
        this.alertService.showError('Erreur', err?.error?.message || 'Erreur lors du changement de statut');
        this.actionLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getCurrencyStatusColor(currency: any): string {
    return currency.is_active ? 'success' : 'secondary';
  }

  getCurrencyStatusText(currency: any): string {
    return currency.is_active ? 'Active' : 'Inactive';
  }

  refreshData(): void {
    this.loadCurrencies();
  }
}
