import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import {
  ButtonModule, CardModule, BadgeModule, SpinnerModule, TooltipModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import { PdfService } from '../../../core/services/pdf.service';
import { AuthService } from '../../../core/services/auth.service';
import { PaymentBatchFormComponent } from '../../finance/payments/payment-batch-form/payment-batch-form.component';
import { PrintableLedgerData, PrintableVersementReceiptData } from '../../../core/services/pdf.service';
import Swal from 'sweetalert2';

interface CurrencyCell {
  debit: number;
  credit: number;
  balance: number;
}

interface LedgerRow {
  date: string;
  type: string;
  type_label: string;
  designation: string;
  quantity: number | null;
  currency: string;
  debit: number;
  credit: number;
  balance: number;
  debit_gnf: number;
  credit_gnf: number;
  balance_gnf: number;
  debit_usd: number;
  credit_usd: number;
  balance_usd: number;
  by_currency?: Record<string, CurrencyCell>;
  reference: string | null;
  meta_id: number;
  // Preuve de conversion multi-devises (payments)
  exchange_rate?: number | null;
  target_currency?: string | null;
  converted_amount?: number | null;
  native_amount?: number | null;
  native_currency?: string | null;
  amount_gnf?: number | null;
  payment_method?: string | null;
}

interface MonthGroup {
  key: string;
  label: string;
  rows: LedgerRow[];
  totals_by_currency: Record<string, { debit: number; credit: number }>;
}

type LedgerTypeTotals = Record<string, { ventes: number; paiements: number; retours: number; interets: number; avances: number }>;

@Component({
  selector: 'app-client-ledger',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, IconDirective,
    ButtonModule, CardModule, BadgeModule, SpinnerModule, TooltipModule,
    PaymentBatchFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-ledger.component.html',
  styleUrl: './client-ledger.component.scss',
})
export class ClientLedgerComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  clientId!: number;
  loading   = true;
  client: any = null;
  summary: any = {
    total_debit_gnf: 0, total_credit_gnf: 0, final_balance_gnf: 0,
    total_debit_usd: 0, total_credit_usd: 0, final_balance_usd: 0,
    has_usd: false, rows_count: 0,
    total_debit: 0, total_credit: 0, final_balance: 0,
    currencies: ['GNF'] as string[],
    by_currency: {} as Record<string, { total_debit: number; total_credit: number; final_balance: number }>,
  };
  rows: LedgerRow[] = [];
  filteredRows: LedgerRow[] = [];
  monthGroups: MonthGroup[] = [];

  searchText = '';
  groupByMonth = true;

  get showUsdColumns(): boolean { return !!this.summary?.has_usd; }
  get balanceStatusGnf(): 'debt' | 'credit' | 'zero' {
    const v = Number(this.summary.final_balance_gnf || 0);
    if (v > 0) return 'debt';
    if (v < 0) return 'credit';
    return 'zero';
  }
  get balanceGnfAbs(): number { return Math.abs(Number(this.summary.final_balance_gnf || 0)); }
  get balanceUsdAbs(): number { return Math.abs(Number(this.summary.final_balance_usd || 0)); }

  // Devises effectivement mouvementées, GNF toujours en premier.
  get ledgerCurrencies(): string[] {
    const list: string[] = Array.isArray(this.summary?.currencies) && this.summary.currencies.length
      ? [...this.summary.currencies]
      : ['GNF'];
    list.sort((a, b) => a === 'GNF' ? -1 : b === 'GNF' ? 1 : a.localeCompare(b));
    return list;
  }
  // Devises non-GNF pour la bannière de solde
  get secondaryCurrencies(): string[] {
    return this.ledgerCurrencies.filter(c => c !== 'GNF');
  }
  balanceStatusFor(currency: string): 'debt' | 'credit' | 'zero' {
    const v = Number(this.summary?.by_currency?.[currency]?.final_balance ?? 0);
    if (v > 0) return 'debt';
    if (v < 0) return 'credit';
    return 'zero';
  }
  balanceFor(currency: string): number {
    return Number(this.summary?.by_currency?.[currency]?.final_balance ?? 0);
  }
  totalDebitFor(currency: string): number {
    return Number(this.summary?.by_currency?.[currency]?.total_debit ?? 0);
  }
  totalCreditFor(currency: string): number {
    return Number(this.summary?.by_currency?.[currency]?.total_credit ?? 0);
  }
  cellFor(row: LedgerRow, currency: string): CurrencyCell {
    return row.by_currency?.[currency] ?? { debit: 0, credit: 0, balance: 0 };
  }
  trackByCurrency(_i: number, c: string): string { return c; }
  get totalsByType(): LedgerTypeTotals {
    const totals: LedgerTypeTotals = {};
    for (const c of this.ledgerCurrencies) {
      totals[c] = { ventes: 0, paiements: 0, retours: 0, interets: 0, avances: 0 };
    }
    for (const r of this.filteredRows) {
      const cur = String(r.currency || 'GNF').toUpperCase();
      totals[cur] ??= { ventes: 0, paiements: 0, retours: 0, interets: 0, avances: 0 };
      const cell = this.cellFor(r, cur);
      if (r.type === 'invoice' || r.type === 'container_sale') totals[cur].ventes += Number(cell.debit || 0);
      else if (r.type === 'payment' || r.type === 'container_payment') totals[cur].paiements += Number(cell.credit || 0);
      else if (r.type === 'return') totals[cur].retours += Number(cell.credit || 0);
      else if (r.type === 'interest') totals[cur].interets += Number(cell.debit || 0);
      else if (r.type === 'advance') totals[cur].avances += Number(cell.credit || 0);
    }
    return totals;
  }

  totalByType(kind: keyof LedgerTypeTotals[string]): number {
    return this.ledgerCurrencies.reduce((sum, c) => sum + Number(this.totalsByType[c]?.[kind] || 0), 0);
  }

  formatTotalsByType(kind: keyof LedgerTypeTotals[string]): string {
    const parts = this.ledgerCurrencies
      .map(c => ({ currency: c, value: Number(this.totalsByType[c]?.[kind] || 0) }))
      .filter(x => x.value > 0)
      .map(x => this.fmt(x.value, x.currency));
    return parts.length ? parts.join(' + ') : this.fmt(0, this.ledgerCurrencies[0] || 'GNF');
  }

  filters = {
    from: '',
    to:   new Date().toISOString().split('T')[0],
    type: '' as '' | 'invoice' | 'payment' | 'return' | 'advance' | 'interest',
  };

  readonly typeOptions = [
    { v: '',         l: 'Toutes opérations' },
    { v: 'invoice',  l: 'Ventes uniquement' },
    { v: 'payment',  l: 'Paiements uniquement' },
    { v: 'return',   l: 'Retours uniquement' },
    { v: 'advance',  l: 'Avances uniquement' },
    { v: 'interest', l: 'Intérêts (SALL)' },
  ];

  showPaymentModal = false;

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef,
    private pdfService: PdfService,
    private authService: AuthService,
  ) {}

  downloadPdf(): void {
    void this.pdfService.downloadProfessionalLedgerPdf(
      this.buildPrintableLedgerData(),
      `compte_${(this.client?.name || 'client').replace(/\s+/g, '_')}.pdf`
    );
  }

  private buildPrintableLedgerData(): PrintableLedgerData {
    const tenant = this.authService.currentTenant as any;
    return {
      client: {
        id: this.client?.id,
        name: this.client?.name || 'Client',
        client_type: this.client?.client_type,
        phone1: this.client?.phone1,
        email: this.client?.email,
        address: this.client?.address,
      },
      summary: this.buildSummaryFromRows(this.filteredRows),
      rows: this.filteredRows.map(r => ({
        date: r.date,
        type: r.type, type_label: r.type_label,
        designation: r.designation,
        quantity: r.quantity, currency: r.currency,
        debit_gnf: r.debit_gnf, credit_gnf: r.credit_gnf, balance_gnf: r.balance_gnf,
        debit_usd: r.debit_usd, credit_usd: r.credit_usd, balance_usd: r.balance_usd,
        by_currency: r.by_currency,
        reference: r.reference,
        exchange_rate: r.exchange_rate ?? null,
        target_currency: r.target_currency ?? null,
        converted_amount: r.converted_amount ?? null,
        native_amount: r.native_amount ?? null,
        native_currency: r.native_currency ?? null,
      })),
      period: this.filters,
      organisation: {
        name: tenant?.name || 'MATKOLLA',
        address: tenant?.address || '',
        phone: tenant?.phone || '',
        email: tenant?.email || '',
        logoUrl: tenant?.logo_url || '',
        footerText: `Compte client — ${this.client?.name || ''}`,
      },
    };
  }

  private buildSummaryFromRows(rows: LedgerRow[]): any {
    const currencies = this.ledgerCurrencies;
    const byCurrency: Record<string, { total_debit: number; total_credit: number; final_balance: number }> = {};
    for (const c of currencies) {
      byCurrency[c] = { total_debit: 0, total_credit: 0, final_balance: 0 };
    }
    for (const row of rows) {
      for (const c of currencies) {
        const cell = this.cellFor(row, c);
        byCurrency[c].total_debit += Number(cell.debit || 0);
        byCurrency[c].total_credit += Number(cell.credit || 0);
      }
    }
    for (const c of currencies) {
      byCurrency[c].total_debit = this.round2(byCurrency[c].total_debit);
      byCurrency[c].total_credit = this.round2(byCurrency[c].total_credit);
      byCurrency[c].final_balance = this.round2(byCurrency[c].total_debit - byCurrency[c].total_credit);
    }
    const gnf = byCurrency['GNF'] || { total_debit: 0, total_credit: 0, final_balance: 0 };
    const usd = byCurrency['USD'] || { total_debit: 0, total_credit: 0, final_balance: 0 };
    return {
      ...this.summary,
      total_debit: gnf.total_debit,
      total_credit: gnf.total_credit,
      final_balance: gnf.final_balance,
      total_debit_gnf: gnf.total_debit,
      total_credit_gnf: gnf.total_credit,
      final_balance_gnf: gnf.final_balance,
      total_debit_usd: usd.total_debit,
      total_credit_usd: usd.total_credit,
      final_balance_usd: usd.final_balance,
      has_usd: currencies.includes('USD'),
      rows_count: rows.length,
      currencies,
      by_currency: byCurrency,
    };
  }

  private round2(value: number): number {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  ngOnInit(): void {
    this.clientId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadLedger();
  }

  loadLedger(): void {
    this.loading = true;
    const params: any = {};
    if (this.filters.from) params.from = this.filters.from;
    if (this.filters.to)   params.to   = this.filters.to;
    if (this.filters.type) params.type = this.filters.type;

    this.apiService.get<any>(`clients/${this.clientId}/ledger`, { params })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          if (r.success) {
            this.client  = r.data.client;
            this.summary = r.data.summary;
            this.rows    = r.data.rows || [];
            this.applyLocalFilter();
          }
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading = false; this.cdr.detectChanges(); }
      });
  }

  applyLocalFilter(): void {
    const q = this.searchText.trim().toLowerCase();
    this.filteredRows = q
      ? this.rows.filter(r =>
          (r.designation || '').toLowerCase().includes(q) ||
          (r.type_label || '').toLowerCase().includes(q) ||
          (r.reference || '').toLowerCase().includes(q)
        )
      : [...this.rows];
    this.buildMonthGroups();
  }

  buildMonthGroups(): void {
    if (!this.groupByMonth) {
      this.monthGroups = [];
      return;
    }
    const map = new Map<string, MonthGroup>();
    const currencies = this.ledgerCurrencies;
    for (const r of this.filteredRows) {
      const d = new Date(r.date);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      let g = map.get(key);
      if (!g) {
        const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        const totals: Record<string, { debit: number; credit: number }> = {};
        for (const c of currencies) totals[c] = { debit: 0, credit: 0 };
        g = { key, label: label.charAt(0).toUpperCase() + label.slice(1), rows: [], totals_by_currency: totals };
        map.set(key, g);
      }
      g.rows.push(r);
      for (const c of currencies) {
        const cell = r.by_currency?.[c];
        if (cell) {
          g.totals_by_currency[c].debit  += Number(cell.debit  || 0);
          g.totals_by_currency[c].credit += Number(cell.credit || 0);
        }
      }
    }
    this.monthGroups = Array.from(map.values());
  }

  setPeriod(p: 'all' | 'month' | '3months' | 'year'): void {
    const now = new Date();
    switch (p) {
      case 'all':
        this.filters.from = '';
        break;
      case 'month':
        this.filters.from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        break;
      case '3months':
        const t = new Date(now); t.setMonth(now.getMonth() - 2); t.setDate(1);
        this.filters.from = t.toISOString().split('T')[0];
        break;
      case 'year':
        this.filters.from = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        break;
    }
    this.filters.to = now.toISOString().split('T')[0];
    this.loadLedger();
  }

  resetFilters(): void {
    this.filters = { from: '', to: new Date().toISOString().split('T')[0], type: '' };
    this.searchText = '';
    this.loadLedger();
  }

  toggleGrouping(): void {
    this.groupByMonth = !this.groupByMonth;
    this.buildMonthGroups();
  }

  typeBadgeColor(type: string): string {
    const map: Record<string, string> = {
      invoice: 'primary', container_sale: 'primary',
      payment: 'success', container_payment: 'success',
      advance: 'info', return: 'warning', interest: 'danger',
    };
    return map[type] || 'secondary';
  }

  typeIcon(type: string): string {
    const map: Record<string, string> = {
      invoice: 'cilCart', container_sale: 'cilTruck',
      payment: 'cilMoney', container_payment: 'cilMoney',
      advance: 'cilWallet', return: 'cilActionUndo', interest: 'cilChartLine',
    };
    return map[type] || 'cilCircle';
  }

  openPaymentModal(): void { this.showPaymentModal = true; }

  async onPaymentSaved(batch: any): Promise<void> {
    this.loadLedger();
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
      await this.printBatchReceipt(batch);
    }
  }

  private async printBatchReceipt(batch: any): Promise<void> {
    const payments: any[] = batch?.payments || [];
    if (!payments.length) return;
    const first = payments[0];
    const totalGnf = payments.reduce((s, p) => s + Number(p.amount_gnf || p.amount || 0), 0);
    const totalsMap = new Map<string, number>();
    for (const p of payments) {
      totalsMap.set(p.currency, (totalsMap.get(p.currency) || 0) + Number(p.amount || 0));
    }

    // Devise principale : mono-devise sans conversion → devise native, sinon GNF
    const hasAnyConversion = payments.some((p: any) => p.target_currency && p.target_currency !== p.currency);
    const currencies = new Set(payments.map((p: any) => String(p.currency || 'GNF').toUpperCase()));
    const primaryCurrency = (!hasAnyConversion && currencies.size === 1) ? Array.from(currencies)[0] : 'GNF';
    const totalPrimary = primaryCurrency === 'GNF'
      ? totalGnf
      : payments.filter((p: any) => p.currency === primaryCurrency).reduce((s, p) => s + Number(p.amount || 0), 0);

    let arrears: PrintableVersementReceiptData['arrears'] = null;
    if (primaryCurrency === 'GNF') {
      const totalRemaining = Math.max(0, Number(this.summary.final_balance_gnf || 0));
      arrears = {
        currency: 'GNF',
        previous_balance: totalRemaining + totalPrimary,
        payment_amount: totalPrimary,
        remaining_balance: totalRemaining,
      };
    } else if (this.client?.id) {
      try {
        const res: any = await this.apiService.get<any>(`clients/${this.client.id}/currency-accounts`).toPromise();
        const accounts: any[] = res?.data || [];
        const acc = accounts.find(a => String(a.currency).toUpperCase() === primaryCurrency);
        if (acc) {
          const currentBalance = Number(acc.current_balance || 0);
          arrears = {
            currency: primaryCurrency,
            previous_balance: currentBalance + totalPrimary,
            payment_amount: totalPrimary,
            remaining_balance: currentBalance,
          };
        }
      } catch { arrears = null; }
    }

    const tenant: any = this.authService.currentTenant || {};
    const data: PrintableVersementReceiptData = {
      receipt_number: batch?.payment_group_id ? `GRP-${String(batch.payment_group_id).slice(0, 8)}` : first.receipt_number,
      payment_date: first.payment_date,
      method: first.method,
      reference: first.reference || null,
      description: first.description || null,
      client: {
        id: this.client?.id,
        name: this.client?.name || 'Client',
        phone: this.client?.phone1,
        address: this.client?.address,
      },
      entries: payments.map((p: any) => ({
        amount: Number(p.amount || 0),
        currency: p.currency,
        target_currency: p.target_currency,
        converted_amount: p.converted_amount,
        exchange_rate: p.exchange_rate,
        amount_gnf: Number(p.amount_gnf || p.amount || 0),
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
        footer_text: `Reçu de versement — ${this.client?.name || ''}`,
      },
      generated_at: new Date().toLocaleString('fr-FR'),
    };
    await this.pdfService.printVersementReceiptPdf(data);
  }

  fmt(v: number | null | undefined, currency = 'GNF'): string {
    if (v === null || v === undefined) return '—';
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(Number(v) || 0) + ' ' + currency;
  }

  fmtNum(v: number | null | undefined): string {
    if (v === null || v === undefined || !v) return '—';
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(Number(v) || 0);
  }

  exportCsv(): void {
    const currencies = this.ledgerCurrencies;
    const headers = ['Date', 'Type', 'Désignation', 'Qté'];
    for (const c of currencies) headers.push(`Débit ${c}`, `Crédit ${c}`, `Solde ${c}`);
    headers.push('Réf.');
    const lines = [headers.join(';')];
    for (const r of this.filteredRows) {
      const cols = [
        r.date,
        `"${r.type_label}"`,
        `"${(r.designation || '').replace(/"/g, '""')}"`,
        r.quantity !== null ? String(r.quantity) : '',
      ];
      for (const c of currencies) {
        const cell = this.cellFor(r, c);
        cols.push(String(cell.debit || 0), String(cell.credit || 0), String(cell.balance || 0));
      }
      cols.push(`"${r.reference || ''}"`);
      lines.push(cols.join(';'));
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `compte_client_${this.client?.name?.replace(/\s+/g, '_') || this.clientId}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  print(): void {
    void this.pdfService.printProfessionalLedgerPdf(this.buildPrintableLedgerData());
  }

  trackByRow(_i: number, r: LedgerRow): string {
    return `${r.type}_${r.meta_id}_${r.date}`;
  }
  trackByGroup(_i: number, g: MonthGroup): string { return g.key; }
}
