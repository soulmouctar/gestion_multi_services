import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  CardModule, ButtonModule, BadgeModule, SpinnerModule,
  TableModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

type PaymentMethodKey = 'ESPECES' | 'ORANGE_MONEY' | 'WAVE' | 'MTN_MONEY' | 'VIREMENT' | 'CHEQUE';

@Component({
  selector: 'app-finance-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterModule, IconDirective,
    CardModule, ButtonModule, BadgeModule, SpinnerModule,
    TableModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance-dashboard.component.html'
})
export class FinanceDashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  loading = true;

  paymentMethodOptions: Array<{ key: PaymentMethodKey; label: string; color: string }> = [
    { key: 'ESPECES', label: 'Espèces', color: '#10B981' },
    { key: 'ORANGE_MONEY', label: 'Orange Money', color: '#F97316' },
    { key: 'WAVE', label: 'Wave', color: '#3B82F6' },
    { key: 'MTN_MONEY', label: 'MTN Money', color: '#EAB308' },
    { key: 'VIREMENT', label: 'Virement', color: '#8B5CF6' },
    { key: 'CHEQUE', label: 'Chèque', color: '#6B7280' }
  ];

  payments = {
    total_payments:  0,
    total_amount:    0,
    monthly_amount:  0,
    average_payment: 0,
    by_type:   { CLIENT: 0, SUPPLIER: 0, DEPOT: 0, RETRAIT: 0 },
    by_method: { ESPECES: 0, ORANGE_MONEY: 0, WAVE: 0, MTN_MONEY: 0, VIREMENT: 0, CHEQUE: 0 },
  };

  invoices = {
    total: 0, paye: 0, partiel: 0, impaye: 0, total_remaining: 0
  };

  cashflow = {
    income_total: 0,
    supplier_out_total: 0,
    bank_withdrawals: 0,
    expense_total: 0,
    outgoing_total: 0,
    net_cashflow: 0,
  };

  currenciesCount  = 0;
  recentPayments: any[] = [];
  recentInvoices:  any[] = [];
  recentExpenses: any[] = [];
  supplierRelations: any[] = [];
  recentSupplierPayments: any[] = [];

  constructor(
    private apiService: ApiService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.apiService.get<any>('finance/dashboard')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          if (r.success && r.data) {
            const d = r.data;
            this.payments        = d.payments        ?? this.payments;
            this.invoices        = d.invoices         ?? this.invoices;
            this.cashflow        = d.cashflow         ?? this.cashflow;
            this.currenciesCount = d.currencies_count ?? 0;
            this.recentPayments  = d.recent_payments  ?? [];
            this.recentInvoices  = d.recent_invoices  ?? [];
            this.recentExpenses  = d.recent_expenses  ?? [];
            this.supplierRelations = d.supplier_relations ?? [];
            this.recentSupplierPayments = d.recent_supplier_payments ?? [];
          }
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.loading = false;
          this.cdr.detectChanges();
        },
      });
  }

  paymentMethodAmount(key: PaymentMethodKey): number {
    return this.payments.by_method[key] || 0;
  }

  trackById(_: number, item: any): any { return item?.id ?? _; }
}
