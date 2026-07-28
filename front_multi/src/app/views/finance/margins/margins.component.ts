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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IconDirective } from '@coreui/icons-angular';
import { SpinnerModule } from '@coreui/angular';
import { ApiService } from '../../../core/services/api.service';

interface MarginSummary {
  from: string | null;
  to: string | null;
  total_revenue_gnf: number;
  total_cost_gnf: number;
  total_margin_gnf: number;
  margin_pct: number | null;
  invoices: { count: number; revenue: number; cost: number; margin: number; margin_pct: number | null };
  containers: { count: number; revenue: number; cost: number; margin: number; margin_pct: number | null };
}

interface InvoiceMarginRow {
  id: number;
  invoice_number: string;
  date: string;
  client_name: string | null;
  currency: string;
  revenue: number;
  cost: number;
  revenue_gnf: number;
  cost_gnf: number;
  margin_gnf: number;
  margin_pct: number | null;
}

interface ContainerMarginRow {
  arrival_id: number;
  container_number: string;
  arrival_date: string;
  product_category: string | null;
  supplier_name: string | null;
  currency: string;
  quantity_sold: number;
  revenue: number;
  cost: number;
  revenue_gnf: number;
  cost_gnf: number;
  margin_gnf: number;
  margin_pct: number | null;
}

@Component({
  selector: 'app-finance-margins',
  standalone: true,
  imports: [CommonModule, FormsModule, IconDirective, SpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './margins.component.html',
  styleUrl: './margins.component.scss',
})
export class FinanceMarginsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  filters = { from: '', to: '' };
  loading = false;
  loaded = false;
  activeTab: 'invoices' | 'containers' = 'invoices';

  summary: MarginSummary | null = null;
  invoices: InvoiceMarginRow[] = [];
  containers: ContainerMarginRow[] = [];

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Période par défaut : mois en cours (utilisateur peut modifier avant "Calculer").
    const now = new Date();
    this.filters.from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    this.filters.to = now.toISOString().split('T')[0];
  }

  compute(): void {
    if (!this.filters.from || !this.filters.to) return;
    this.loading = true;
    this.cdr.detectChanges();
    const params = { from: this.filters.from, to: this.filters.to };
    this.api.get<any>('finance/margins', { params })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r: any) => {
          if (r?.success && r.data) {
            this.summary = r.data.summary;
            this.invoices = r.data.invoices || [];
            this.containers = r.data.containers || [];
            this.loaded = true;
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

  fmt(v: number | null | undefined): string {
    if (v == null) return '—';
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v) + ' GNF';
  }
  fmtNative(v: number, currency: string): string {
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0) + ' ' + currency;
  }
  pct(v: number | null | undefined): string {
    if (v == null) return '—';
    return `${v.toFixed(1)} %`;
  }

  marginColor(v: number): string {
    if (v > 0) return '#10B981';
    if (v < 0) return '#EF4444';
    return '#6B7280';
  }

  trackInvoice(_i: number, r: InvoiceMarginRow): number { return r.id; }
  trackContainer(_i: number, r: ContainerMarginRow): number { return r.arrival_id; }

  exportCsv(): void {
    if (!this.loaded) return;
    const headers = ['Type', 'Date', 'N°', 'Client / Fournisseur', 'Devise', 'CA (natif)', 'Coût (natif)', 'CA GNF', 'Coût GNF', 'Marge GNF', 'Marge %'];
    const lines = [headers.join(';')];
    for (const i of this.invoices) {
      lines.push([
        'Facture', i.date, i.invoice_number, `"${(i.client_name || '').replace(/"/g, '""')}"`,
        i.currency, String(i.revenue), String(i.cost),
        String(i.revenue_gnf), String(i.cost_gnf), String(i.margin_gnf),
        i.margin_pct != null ? String(i.margin_pct) : '',
      ].join(';'));
    }
    for (const c of this.containers) {
      lines.push([
        'Conteneur', c.arrival_date, c.container_number, `"${(c.supplier_name || '').replace(/"/g, '""')}"`,
        c.currency, String(c.revenue), String(c.cost),
        String(c.revenue_gnf), String(c.cost_gnf), String(c.margin_gnf),
        c.margin_pct != null ? String(c.margin_pct) : '',
      ].join(';'));
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marges_${this.filters.from}_${this.filters.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
