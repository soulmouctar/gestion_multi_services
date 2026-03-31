import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-payments-advanced',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './payments-advanced.component.html'
})
export class PaymentsAdvancedComponent implements OnInit {
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  
  // Statistics
  paymentStats: any = null;
  statsLoading = false;
  
  // Date Range Filter
  dateRangeForm: FormGroup;
  dateRangePayments: any[] = [];
  dateRangeLoading = false;
  
  // Bulk Delete
  selectedPayments: Set<number> = new Set();
  showBulkDeleteModal = false;
  bulkDeleteLoading = false;
  
  // Export
  exportLoading = false;
  exportForm: FormGroup;

  constructor(private fb: FormBuilder, private apiService: ApiService, private cdr: ChangeDetectorRef) {
    this.dateRangeForm = this.fb.group({
      start_date: ['', Validators.required],
      end_date: ['', Validators.required],
      payment_method: [''],
      status: ['']
    });
    
    this.exportForm = this.fb.group({
      format: ['excel'],
      start_date: [''],
      end_date: [''],
      payment_method: [''],
      status: ['']
    });
  }

  ngOnInit(): void {
    this.loadPaymentStatistics();
    this.setDefaultDateRange();
  }

  setDefaultDateRange(): void {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    this.dateRangeForm.patchValue({
      start_date: firstDay.toISOString().split('T')[0],
      end_date: lastDay.toISOString().split('T')[0]
    });
    
    this.exportForm.patchValue({
      start_date: firstDay.toISOString().split('T')[0],
      end_date: lastDay.toISOString().split('T')[0]
    });
  }

  // Payment Statistics
  loadPaymentStatistics(): void {
    this.statsLoading = true;
    this.apiService.get<any>('payments-public/statistics').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.paymentStats = r.data;
        }
        this.statsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.statsLoading = false;
        console.error('Erreur lors du chargement des statistiques');
      }
    });
  }

  // Date Range Filter
  loadPaymentsByDateRange(): void {
    if (this.dateRangeForm.invalid) return;
    
    this.dateRangeLoading = true;
    const params = new URLSearchParams();
    
    Object.keys(this.dateRangeForm.value).forEach(key => {
      const value = this.dateRangeForm.get(key)?.value;
      if (value) {
        params.append(key, value);
      }
    });
    
    this.apiService.get<any>(`payments-public?${params.toString()}`).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.dateRangePayments = r.data;
        }
        this.dateRangeLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.dateRangeLoading = false;
        this.error = 'Erreur lors du chargement des paiements';
        this.cdr.detectChanges();
      }
    });
  }

  // Bulk Selection
  togglePaymentSelection(paymentId: number): void {
    if (this.selectedPayments.has(paymentId)) {
      this.selectedPayments.delete(paymentId);
    } else {
      this.selectedPayments.add(paymentId);
    }
  }

  selectAllPayments(): void {
    if (this.selectedPayments.size === this.dateRangePayments.length) {
      this.selectedPayments.clear();
    } else {
      this.selectedPayments.clear();
      this.dateRangePayments.forEach(p => this.selectedPayments.add(p.id));
    }
  }

  // Bulk Delete
  openBulkDeleteModal(): void {
    if (this.selectedPayments.size === 0) {
      this.error = 'Veuillez sélectionner au moins un paiement';
      this.clearMessages();
      return;
    }
    this.showBulkDeleteModal = true;
  }

  confirmBulkDelete(): void {
    this.bulkDeleteLoading = true;
    const paymentIds = Array.from(this.selectedPayments);
    
    this.apiService.post<any>('payments-public/bulk-delete', { payment_ids: paymentIds }).subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = `${paymentIds.length} paiement(s) supprimé(s)`;
          this.selectedPayments.clear();
          this.showBulkDeleteModal = false;
          this.loadPaymentsByDateRange();
          this.loadPaymentStatistics();
          this.clearMessages();
        }
        this.bulkDeleteLoading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur lors de la suppression';
        this.bulkDeleteLoading = false;
        this.showBulkDeleteModal = false;
      }
    });
  }

  // Export
  exportPayments(): void {
    if (this.exportForm.invalid) return;
    
    this.exportLoading = true;
    const params = new URLSearchParams();
    
    Object.keys(this.exportForm.value).forEach(key => {
      const value = this.exportForm.get(key)?.value;
      if (value) {
        params.append(key, value);
      }
    });
    
    this.apiService.get<any>(`payments-public?${params.toString()}`).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          // Create download link
          const blob = new Blob([r.data], { 
            type: this.exportForm.get('format')?.value === 'excel' 
              ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              : 'text/csv'
          });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `payments_export.${this.exportForm.get('format')?.value === 'excel' ? 'xlsx' : 'csv'}`;
          link.click();
          window.URL.revokeObjectURL(url);
          
          this.successMessage = 'Export terminé avec succès';
          this.clearMessages();
        }
        this.exportLoading = false;
      },
      error: () => {
        this.exportLoading = false;
        this.error = 'Erreur lors de l\'export';
        this.clearMessages();
      }
    });
  }

  getPaymentMethodColor(method: string): string {
    switch (method) {
      case 'ORANGE_MONEY': return 'warning';
      case 'VIREMENT': return 'info';
      case 'CHEQUE': return 'secondary';
      case 'ESPECES': return 'success';
      default: return 'primary';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'PENDING': return 'warning';
      case 'FAILED': return 'danger';
      case 'CANCELLED': return 'secondary';
      default: return 'primary';
    }
  }

  refreshData(): void {
    this.loadPaymentStatistics();
    if (this.dateRangePayments.length > 0) {
      this.loadPaymentsByDateRange();
    }
  }

  private clearMessages(): void {
    setTimeout(() => {
      this.successMessage = null;
      this.error = null;
      this.cdr.detectChanges();
    }, 3000);
  }
}
