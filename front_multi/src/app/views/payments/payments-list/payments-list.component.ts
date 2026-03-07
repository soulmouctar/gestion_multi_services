import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';

import {
  ButtonModule,
  ButtonGroupModule,
  CardModule,
  FormModule,
  BadgeModule,
  ModalModule,
  AlertModule,
  SpinnerModule,
  DropdownModule,
  RowComponent,
  ColComponent,
  ContainerComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

import { PaymentService, Payment, PaymentFilters } from '../../../core/services/payment.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-payments-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    IconDirective,
    ButtonModule,
    ButtonGroupModule,
    CardModule,
    FormModule,
    BadgeModule,
    ModalModule,
    AlertModule,
    SpinnerModule,
    DropdownModule,
    RowComponent,
    ColComponent,
    ContainerComponent
  ],
  templateUrl: './payments-list.component.html',
  styleUrls: ['./payments-list.component.scss']
})
export class PaymentsListComponent implements OnInit {
  payments: Payment[] = [];
  loading = false;
  error: string | null = null;
  
  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  itemsPerPage = 10;
  
  // Filters
  filterForm: FormGroup;
  filters: PaymentFilters = {};
  
  // Selection
  selectedPayments: Set<number> = new Set();
  selectAll = false;

  // Math object for template
  Math = Math;

  constructor(
    private paymentService: PaymentService,
    private authService: AuthService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.filterForm = this.fb.group({
      search: [''],
      type: [''],
      method: [''],
      status: [''],
      date_from: [''],
      date_to: ['']
    });
  }

  ngOnInit(): void {
    this.loadPayments();
    this.setupFilterSubscription();
  }

  private setupFilterSubscription(): void {
    this.filterForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  loadPayments(): void {
    this.loading = true;
    this.error = null;

    const params = {
      page: this.currentPage,
      per_page: this.itemsPerPage,
      ...this.filters
    };

    this.paymentService.getPayments(params).subscribe({
      next: (response) => {
        if (response.data) {
          this.payments = response.data.data || [];
          this.totalItems = response.data.total || 0;
          this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        }
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des paiements';
        this.loading = false;
        console.error('Error loading payments:', error);
      }
    });
  }

  applyFilters(): void {
    this.filters = { ...this.filterForm.value };
    this.currentPage = 1;
    this.loadPayments();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadPayments();
  }

  getPaymentTypeLabel(type: string): string {
    const types: { [key: string]: string } = {
      'INCOME': 'Recette',
      'EXPENSE': 'Dépense'
    };
    return types[type] || type;
  }

  getPaymentMethodLabel(method: string): string {
    const methods: { [key: string]: string } = {
      'ORANGE_MONEY': 'Orange Money',
      'VIREMENT': 'Virement',
      'CHEQUE': 'Chèque',
      'ESPECES': 'Espèces'
    };
    return methods[method] || method;
  }

  getPaymentTypeClass(type: string): string {
    return type === 'INCOME' ? 'success' : 'danger';
  }

  toggleSelectAll(): void {
    if (this.selectAll) {
      this.selectedPayments.clear();
    } else {
      this.payments.forEach(payment => this.selectedPayments.add(payment.id));
    }
    this.selectAll = !this.selectAll;
  }

  togglePaymentSelection(paymentId: number): void {
    if (this.selectedPayments.has(paymentId)) {
      this.selectedPayments.delete(paymentId);
    } else {
      this.selectedPayments.add(paymentId);
    }
    this.selectAll = this.selectedPayments.size === this.payments.length;
  }

  isPaymentSelected(paymentId: number): boolean {
    return this.selectedPayments.has(paymentId);
  }

  deleteSelectedPayments(): void {
    if (this.selectedPayments.size === 0) return;

    if (confirm(`Êtes-vous sûr de vouloir supprimer ${this.selectedPayments.size} paiement(s) ?`)) {
      const ids = Array.from(this.selectedPayments);
      
      this.paymentService.bulkDelete(ids).subscribe({
        next: () => {
          this.selectedPayments.clear();
          this.selectAll = false;
          this.loadPayments();
        },
        error: (error) => {
          this.error = 'Erreur lors de la suppression des paiements';
          console.error('Error deleting payments:', error);
        }
      });
    }
  }

  exportPayments(): void {
    this.paymentService.exportPayments('excel').subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `paiements_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        this.error = 'Erreur lors de l\'export des paiements';
        console.error('Error exporting payments:', error);
      }
    });
  }

  trackByPaymentId(index: number, payment: Payment): number {
    return payment.id;
  }

  getPages(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }
}
