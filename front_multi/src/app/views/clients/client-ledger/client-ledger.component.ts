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
  reference: string | null;
  meta_id: number;
}

interface MonthGroup {
  key: string;
  label: string;
  rows: LedgerRow[];
  debit_gnf: number;
  credit_gnf: number;
  debit_usd: number;
  credit_usd: number;
}

@Component({
  selector: 'app-client-ledger',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, IconDirective,
    ButtonModule, CardModule, BadgeModule, SpinnerModule, TooltipModule
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
  get totalsByType(): { ventes: number; paiements: number; retours: number; interets: number; avances: number } {
    let ventes = 0, paiements = 0, retours = 0, interets = 0, avances = 0;
    for (const r of this.rows) {
      const isUsd = (r.currency || 'GNF').toUpperCase() === 'USD';
      const amount = isUsd ? (r.debit_usd + r.credit_usd) : (r.debit_gnf + r.credit_gnf);
      if (r.type === 'invoice' || r.type === 'container_sale') ventes += amount;
      else if (r.type === 'payment' || r.type === 'container_payment') paiements += amount;
      else if (r.type === 'return') retours += amount;
      else if (r.type === 'interest') interets += amount;
      else if (r.type === 'advance') avances += amount;
    }
    return { ventes, paiements, retours, interets, avances };
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

  showInterestModal = false;
  interestForm = {
    amount: 0,
    interest_rate: 15,
    principal_amount: 0,
    charge_date: new Date().toISOString().split('T')[0],
    notes: 'Intérêts SALL',
    currency: 'GNF',
  };
  savingInterest = false;

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

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
    for (const r of this.filteredRows) {
      const d = new Date(r.date);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      let g = map.get(key);
      if (!g) {
        const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        g = { key, label: label.charAt(0).toUpperCase() + label.slice(1), rows: [], debit_gnf: 0, credit_gnf: 0, debit_usd: 0, credit_usd: 0 };
        map.set(key, g);
      }
      g.rows.push(r);
      g.debit_gnf  += r.debit_gnf  || 0;
      g.credit_gnf += r.credit_gnf || 0;
      g.debit_usd  += r.debit_usd  || 0;
      g.credit_usd += r.credit_usd || 0;
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

  openInterestModal(): void {
    this.interestForm = {
      amount: 0,
      interest_rate: 15,
      principal_amount: Math.max(0, Number(this.summary.final_balance_gnf) || 0),
      charge_date: new Date().toISOString().split('T')[0],
      notes: 'Intérêts SALL',
      currency: 'GNF',
    };
    this.showInterestModal = true;
  }

  computeInterestAmount(): void {
    const principal = Number(this.interestForm.principal_amount) || 0;
    const rate = Number(this.interestForm.interest_rate) || 0;
    this.interestForm.amount = Math.round(principal * rate / 100);
  }

  saveInterest(): void {
    if (!this.interestForm.amount || this.interestForm.amount <= 0) return;
    this.savingInterest = true;
    const payload = {
      client_id: this.clientId,
      principal_amount: this.interestForm.principal_amount,
      interest_rate: this.interestForm.interest_rate,
      amount: this.interestForm.amount,
      currency: this.interestForm.currency,
      charge_date: this.interestForm.charge_date,
      notes: this.interestForm.notes,
    };
    this.apiService.post<any>('client-interest-charges', payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.savingInterest = false;
          if (r.success) {
            this.showInterestModal = false;
            this.loadLedger();
          }
          this.cdr.detectChanges();
        },
        error: () => { this.savingInterest = false; this.cdr.detectChanges(); }
      });
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
    const usd = this.showUsdColumns;
    const headers = usd
      ? ['Date', 'Type', 'Désignation', 'Qté',
         'Débit GNF', 'Crédit GNF', 'Solde GNF',
         'Débit USD', 'Crédit USD', 'Solde USD', 'Réf.']
      : ['Date', 'Type', 'Désignation', 'Qté', 'Débit', 'Crédit', 'Solde', 'Réf.'];
    const lines = [headers.join(';')];
    for (const r of this.filteredRows) {
      const cols = usd
        ? [r.date, `"${r.type_label}"`, `"${(r.designation || '').replace(/"/g, '""')}"`,
           r.quantity !== null ? String(r.quantity) : '',
           String(r.debit_gnf || 0), String(r.credit_gnf || 0), String(r.balance_gnf || 0),
           String(r.debit_usd || 0), String(r.credit_usd || 0), String(r.balance_usd || 0),
           `"${r.reference || ''}"`]
        : [r.date, `"${r.type_label}"`, `"${(r.designation || '').replace(/"/g, '""')}"`,
           r.quantity !== null ? String(r.quantity) : '',
           String(r.debit || 0), String(r.credit || 0), String(r.balance || 0),
           `"${r.reference || ''}"`];
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

  print(): void { window.print(); }

  trackByRow(_i: number, r: LedgerRow): string {
    return `${r.type}_${r.meta_id}_${r.date}`;
  }
  trackByGroup(_i: number, g: MonthGroup): string { return g.key; }
}
