import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IconDirective } from '@coreui/icons-angular';
import { SpinnerModule } from '@coreui/angular';
import Swal from 'sweetalert2';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { PdfService, PrintableVersementReceiptData } from '../../../core/services/pdf.service';
import { PaymentBatchFormComponent } from './payment-batch-form/payment-batch-form.component';

interface PaymentRow {
  id: number;
  receipt_number: string;
  payment_date: string;
  method: string;
  type: string;
  amount: number;
  currency: string;
  target_currency: string | null;
  amount_gnf: number;
  converted_amount: number | null;
  exchange_rate: number | null;
  client: { id: number; name: string } | null;
  reference: string | null;
  description: string | null;
  payment_group_id: string | null;
}

@Component({
  selector: 'app-finance-payments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IconDirective,
    SpinnerModule,
    PaymentBatchFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss',
})
export class FinancePaymentsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  loading = false;
  payments: PaymentRow[] = [];
  page = 1;
  perPage = 15;
  total = 0;
  lastPage = 1;

  filters = {
    search: '',
    date_from: '',
    date_to: '',
    currency: '',
  };

  showBatchForm = false;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private pdf: PdfService,
    private cdr: ChangeDetectorRef,
  ) {}

  get canCreatePayment(): boolean { return this.auth.hasModulePermission('FINANCE', 'create'); }
  get canDeletePayment(): boolean { return this.auth.hasModulePermission('FINANCE', 'delete'); }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.cdr.detectChanges();
    const params: any = {
      page: this.page,
      per_page: this.perPage,
      type: 'CLIENT',
    };
    if (this.filters.search) params.search = this.filters.search;
    if (this.filters.date_from) params.date_from = this.filters.date_from;
    if (this.filters.date_to) params.date_to = this.filters.date_to;
    if (this.filters.currency) params.currency = this.filters.currency;

    this.api.get<any>('payments', { params })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r: any) => {
          const data = r?.data;
          this.payments = data?.data || [];
          this.total = data?.total || 0;
          this.lastPage = data?.last_page || 1;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.payments = [];
          this.loading = false;
          this.cdr.detectChanges();
        },
      });
  }

  openBatchForm(): void { this.showBatchForm = true; }

  async onBatchSaved(batch: any): Promise<void> {
    this.page = 1;
    this.load();
    const result = await Swal.fire({
      title: 'Versement enregistré',
      text: 'Voulez-vous imprimer le reçu maintenant ?',
      icon: 'success',
      showCancelButton: true,
      confirmButtonText: 'Imprimer',
      cancelButtonText: 'Plus tard',
      confirmButtonColor: '#10B981',
    });
    if (result.isConfirmed) {
      await this.printFromBatchResponse(batch, 'print');
    }
  }

  private async printFromBatchResponse(batch: any, mode: 'print' | 'download'): Promise<void> {
    const payments: any[] = batch?.payments || [];
    if (!payments.length) return;
    const first = payments[0];
    const row: PaymentRow = {
      id: first.id,
      receipt_number: first.receipt_number,
      payment_date: first.payment_date,
      method: first.method,
      type: first.type,
      amount: Number(first.amount),
      currency: first.currency,
      target_currency: first.target_currency,
      amount_gnf: Number(first.amount_gnf || first.amount),
      converted_amount: first.converted_amount,
      exchange_rate: first.exchange_rate,
      client: first.client ? { id: first.client.id, name: first.client.name } : null,
      reference: first.reference,
      description: first.description,
      payment_group_id: batch?.payment_group_id || null,
    };
    // Injecte les autres lignes du groupe dans this.payments temporairement pour que printReceipt les retrouve.
    const extras: PaymentRow[] = payments.slice(1).map((p: any) => ({
      id: p.id,
      receipt_number: p.receipt_number,
      payment_date: p.payment_date,
      method: p.method,
      type: p.type,
      amount: Number(p.amount),
      currency: p.currency,
      target_currency: p.target_currency,
      amount_gnf: Number(p.amount_gnf || p.amount),
      converted_amount: p.converted_amount,
      exchange_rate: p.exchange_rate,
      client: p.client ? { id: p.client.id, name: p.client.name } : null,
      reference: p.reference,
      description: p.description,
      payment_group_id: batch?.payment_group_id || null,
    }));
    const before = this.payments;
    this.payments = [row, ...extras, ...before.filter(p => p.id !== row.id && !extras.some(e => e.id === p.id))];
    try {
      await this.printReceipt(row, mode);
    } finally {
      this.payments = before;
    }
  }

  resetFilters(): void {
    this.filters = { search: '', date_from: '', date_to: '', currency: '' };
    this.page = 1;
    this.load();
  }

  applyFilters(): void { this.page = 1; this.load(); }

  goToPage(p: number): void {
    if (p < 1 || p > this.lastPage) return;
    this.page = p;
    this.load();
  }

  fmt(v: number | null | undefined, currency = 'GNF'): string {
    if (v === null || v === undefined) return '—';
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(Number(v) || 0) + ' ' + currency;
  }

  methodLabel(m: string): string {
    const map: Record<string, string> = {
      ESPECES: 'Espèces',
      VIREMENT: 'Virement',
      CHEQUE: 'Chèque',
      ORANGE_MONEY: 'Orange Money',
      WAVE: 'Wave',
      MTN_MONEY: 'MTN Money',
    };
    return map[m] || m;
  }

  trackById(_i: number, p: PaymentRow): number { return p.id; }

  async printReceipt(row: PaymentRow, mode: 'print' | 'download' = 'print'): Promise<void> {
    // Regroupe toutes les lignes du meme payment_group_id pour le batch multi-devises.
    const groupPayments: PaymentRow[] = row.payment_group_id
      ? this.payments.filter(p => p.payment_group_id === row.payment_group_id)
      : [row];

    // Devise principale : la devise unique du batch si aucune conversion, sinon GNF
    const primaryCurrency = this.determinePrimaryCurrency(groupPayments);
    const totalGnf = groupPayments.reduce((s, p) => s + Number(p.amount_gnf || 0), 0);
    const totalPrimary = primaryCurrency === 'GNF'
      ? totalGnf
      : groupPayments.filter(p => p.currency === primaryCurrency).reduce((s, p) => s + Number(p.amount || 0), 0);

    let arrears: PrintableVersementReceiptData['arrears'] = null;
    if (row.client?.id) {
      try {
        if (primaryCurrency === 'GNF') {
          const bal: any = await this.api.get<any>(`clients/${row.client.id}/balance`).toPromise();
          const totalRemaining = Number(bal?.data?.total_remaining || 0);
          arrears = {
            currency: 'GNF',
            previous_balance: totalRemaining + totalPrimary,
            payment_amount: totalPrimary,
            remaining_balance: totalRemaining,
          };
        } else {
          // Compte-devise : impact direct sur le solde de la devise concernée
          const res: any = await this.api.get<any>(`clients/${row.client.id}/currency-accounts`).toPromise();
          const accounts: any[] = res?.data || [];
          const acc = accounts.find(a => String(a.currency).toUpperCase() === primaryCurrency);
          if (acc) {
            const currentBalance = Number(acc.current_balance || 0); // positif = dette
            arrears = {
              currency: primaryCurrency,
              previous_balance: currentBalance + totalPrimary,
              payment_amount: totalPrimary,
              remaining_balance: currentBalance,
            };
          }
        }
      } catch { arrears = null; }
    }

    const tenant: any = this.auth.currentTenant || {};
    const totalsMap = new Map<string, number>();
    for (const p of groupPayments) {
      totalsMap.set(p.currency, (totalsMap.get(p.currency) || 0) + Number(p.amount || 0));
    }

    const data: PrintableVersementReceiptData = {
      receipt_number: row.payment_group_id ? `GRP-${row.payment_group_id.slice(0, 8)}` : row.receipt_number,
      payment_date: row.payment_date,
      method: this.methodLabel(row.method),
      reference: row.reference,
      description: row.description,
      client: {
        id: row.client?.id || 0,
        name: row.client?.name || 'Client',
      },
      entries: groupPayments.map(p => ({
        amount: Number(p.amount || 0),
        currency: p.currency,
        target_currency: p.target_currency,
        converted_amount: p.converted_amount,
        exchange_rate: p.exchange_rate,
        amount_gnf: Number(p.amount_gnf || 0),
      })),
      totals_by_currency: Array.from(totalsMap.entries()).map(([currency, total]) => ({ currency, total })),
      primary_currency: primaryCurrency,
      total_amount: totalPrimary,
      total_gnf: totalGnf,
      arrears,
      organisation: {
        name: tenant?.name || 'MATKOLLA',
        address: tenant?.address || '',
        phone: tenant?.phone || '',
        email: tenant?.email || '',
        logoUrl: tenant?.logo_url || '',
        footer_text: `Reçu de versement — ${row.client?.name || ''}`,
      },
      generated_at: new Date().toLocaleString('fr-FR'),
    };

    if (mode === 'download') {
      await this.pdf.downloadVersementReceiptPdf(data, `recu-versement-${data.receipt_number}.pdf`);
    } else {
      await this.pdf.printVersementReceiptPdf(data);
    }
  }

  private determinePrimaryCurrency(payments: PaymentRow[]): string {
    const hasAnyConversion = payments.some(p => p.target_currency && p.target_currency !== p.currency);
    if (hasAnyConversion) return 'GNF';
    const currencies = new Set(payments.map(p => (p.currency || 'GNF').toUpperCase()));
    if (currencies.size === 1) return Array.from(currencies)[0];
    return 'GNF';
  }
}
