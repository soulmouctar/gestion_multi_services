import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  ButtonModule, CardModule, BadgeModule, SpinnerModule, TooltipModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

interface SaleItem {
  id: number;
  product_id: number | null;
  product_name: string;
  sku: string | null;
  supplier: string | null;
  sale_type: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  discount: number;
  is_sample: boolean;
  line_total: number;
  line_cost: number;
  margin: number;
  margin_pct: number | null;
}
interface SaleRow {
  id: number;
  invoice_number: string;
  date: string;
  client: { id: number; name: string; phone1?: string; client_type?: string } | null;
  currency: string;
  exchange_rate: number;
  status: string;
  total_amount: number;
  total_amount_gnf: number;
  paid_amount: number;
  items_subtotal: number;
  previous_balance: number;
  samples_count: number;
  revenue: number;
  cost: number;
  margin: number;
  margin_pct: number | null;
  items: SaleItem[];
}
interface Summary {
  invoices_count: number;
  items_count: number;
  samples_count: number;
  total_revenue_gnf: number;
  total_cost_gnf: number;
  total_margin_gnf: number;
  margin_pct: number | null;
  total_revenue_native: number;
  total_cost_native: number;
}

@Component({
  selector: 'app-sales-summary',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, IconDirective,
    ButtonModule, CardModule, BadgeModule, SpinnerModule, TooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-summary.component.html',
  styleUrl: './sales-summary.component.scss',
})
export class SalesSummaryComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  loading = true;
  error = '';

  invoices: SaleRow[] = [];
  summary: Summary = {
    invoices_count: 0, items_count: 0, samples_count: 0,
    total_revenue_gnf: 0, total_cost_gnf: 0, total_margin_gnf: 0,
    margin_pct: null, total_revenue_native: 0, total_cost_native: 0,
  };
  pagination = { current_page: 1, per_page: 25, total: 0, last_page: 1 };

  clients: { id: number; name: string }[] = [];

  filters = {
    from: '',
    to: new Date().toISOString().split('T')[0],
    client_id: '' as '' | number,
    currency: '',
    status: '',
    search: '',
  };

  expanded: Record<number, boolean> = {};
  searchTimer?: ReturnType<typeof setTimeout>;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadClients();
    this.loadSummary();
  }

  loadClients(): void {
    this.api.get<any>('clients?per_page=300')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.clients = (r.data?.data || r.data || []).map((c: any) => ({ id: c.id, name: c.name }));
          this.cdr.detectChanges();
        },
        error: () => {},
      });
  }

  loadSummary(page = 1): void {
    this.loading = true;
    this.error = '';
    const params: any = { per_page: this.pagination.per_page, page };
    if (this.filters.from)     params.from = this.filters.from;
    if (this.filters.to)       params.to = this.filters.to;
    if (this.filters.client_id) params.client_id = this.filters.client_id;
    if (this.filters.currency) params.currency = this.filters.currency;
    if (this.filters.status)   params.status = this.filters.status;
    if (this.filters.search)   params.search = this.filters.search;

    this.api.get<any>('invoices/sales-summary', { params })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          if (r.success) {
            this.summary = r.data.summary;
            this.invoices = r.data.invoices || [];
            this.pagination = r.data.pagination || this.pagination;
          } else {
            this.error = r.message || 'Erreur de chargement';
          }
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (e) => {
          this.error = e?.error?.message || 'Erreur de chargement';
          this.loading = false;
          this.cdr.detectChanges();
        },
      });
  }

  setPeriod(p: 'all' | 'month' | '3months' | 'year'): void {
    const now = new Date();
    switch (p) {
      case 'all':     this.filters.from = ''; break;
      case 'month':   this.filters.from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]; break;
      case '3months':
        const t = new Date(now); t.setMonth(now.getMonth() - 2); t.setDate(1);
        this.filters.from = t.toISOString().split('T')[0]; break;
      case 'year':    this.filters.from = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]; break;
    }
    this.filters.to = now.toISOString().split('T')[0];
    this.loadSummary(1);
  }

  onSearchChange(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadSummary(1), 350);
  }

  reset(): void {
    this.filters = { from: '', to: new Date().toISOString().split('T')[0], client_id: '', currency: '', status: '', search: '' };
    this.loadSummary(1);
  }

  toggleExpand(id: number): void { this.expanded[id] = !this.expanded[id]; }
  isExpanded(id: number): boolean { return !!this.expanded[id]; }

  goPage(p: number): void {
    if (p < 1 || p > this.pagination.last_page || p === this.pagination.current_page) return;
    this.loadSummary(p);
  }

  fmt(v: number | null | undefined, currency = 'GNF'): string {
    if (v === null || v === undefined) return '—';
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(Number(v) || 0) + ' ' + currency;
  }
  fmtNum(v: number | null | undefined): string {
    if (v === null || v === undefined) return '—';
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(Number(v) || 0);
  }
  fmtPct(v: number | null | undefined): string {
    if (v === null || v === undefined) return '—';
    return (Number(v) > 0 ? '+' : '') + Number(v).toFixed(1) + ' %';
  }

  statusBadge(s: string): { color: string; label: string } {
    switch (s) {
      case 'PAYE':    return { color: 'success', label: 'Payée' };
      case 'PARTIEL': return { color: 'warning', label: 'Partielle' };
      case 'IMPAYE':  return { color: 'danger',  label: 'Impayée' };
      default: return { color: 'secondary', label: s };
    }
  }
  marginClass(pct: number | null): string {
    if (pct === null) return 'm-zero';
    if (pct <= 0)  return 'm-bad';
    if (pct < 10)  return 'm-low';
    if (pct < 25)  return 'm-mid';
    return 'm-good';
  }

  exportCsv(): void {
    const headers = ['Date', 'N° Facture', 'Client', 'Statut', 'Devise',
                     'CA', 'Coût', 'Marge', 'Marge %', 'Articles'];
    const lines = [headers.join(';')];
    for (const inv of this.invoices) {
      lines.push([
        inv.date,
        inv.invoice_number,
        `"${inv.client?.name || '—'}"`,
        inv.status,
        inv.currency,
        String(inv.revenue),
        String(inv.cost),
        String(inv.margin),
        inv.margin_pct === null ? '' : String(inv.margin_pct),
        String(inv.items.length),
      ].join(';'));
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `synthese_ventes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  print(): void { window.print(); }

  trackInv(_i: number, r: SaleRow): number { return r.id; }
  trackItem(_i: number, it: SaleItem): number { return it.id; }
}
