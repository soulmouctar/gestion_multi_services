import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SpinnerModule, AlertModule } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

interface CurrencyBucket {
  total_debit: number;
  total_credit: number;
  final_balance: number;
  total_debit_gnf: number;
  total_credit_gnf: number;
  final_balance_gnf: number;
}

interface SupplierRow {
  id: number;
  name: string;
  category: string | null;
  phone1: string | null;
  email: string | null;
  total_debt_gnf: number;
  total_paid_gnf: number;
  balance_gnf_equivalent: number;
  by_currency: Record<string, CurrencyBucket>;
  currencies: string[];
  settle_pct: number;
  is_fully_settled: boolean;
}

type PeriodKey = 'all' | 'year' | 'month' | 'custom';

@Component({
  selector: 'app-supplier-index',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SpinnerModule, AlertModule, IconDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './supplier-index.component.html',
  styleUrl: './supplier-index.component.scss'
})
export class SupplierIndexComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  loading = true;
  error: string | null = null;

  rows: SupplierRow[] = [];
  filtered: SupplierRow[] = [];
  totals: any = null;

  search = '';
  period: PeriodKey = 'all';
  from = '';
  to = '';

  /** Devises de consolidation : tout est ramene a l'une des deux. */
  readonly pivots = ['GNF', 'USD'] as const;
  pivot: 'GNF' | 'USD' = 'GNF';

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    const params: string[] = [];
    if (this.period === 'year' || this.period === 'month') {
      params.push(`period=${this.period}`);
    } else if (this.period === 'custom') {
      if (this.from) params.push(`from=${this.from}`);
      if (this.to) params.push(`to=${this.to}`);
    }
    const qs = params.length ? `?${params.join('&')}` : '';

    this.api.get<any>(`suppliers/balance-summary${qs}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r: any) => {
          this.rows = r?.data?.suppliers ?? [];
          this.totals = r?.data?.totals ?? null;
          this.applySearch();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (e: any) => {
          this.error = e?.error?.message || 'Impossible de charger les comptes fournisseurs';
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  onPeriodChange(p: PeriodKey): void {
    this.period = p;
    if (p !== 'custom') this.load();
    else this.cdr.markForCheck();
  }

  applyCustom(): void {
    if (this.from || this.to) this.load();
  }

  applySearch(): void {
    const q = this.search.trim().toLowerCase();
    this.filtered = !q
      ? [...this.rows]
      : this.rows.filter(r =>
          (r.name || '').toLowerCase().includes(q) ||
          (r.category || '').toLowerCase().includes(q) ||
          (r.phone1 || '').toLowerCase().includes(q));
    this.cdr.markForCheck();
  }

  /** Montant d'une devise pour une ligne, exprime dans la devise pivot choisie. */
  bucket(row: SupplierRow, currency: string): CurrencyBucket | null {
    return row.by_currency?.[currency] ?? null;
  }

  /** Solde consolide de la ligne, dans la devise pivot. */
  balance(row: SupplierRow): number {
    if (this.pivot === 'GNF') return Number(row.balance_gnf_equivalent || 0);
    const usd = row.by_currency?.['USD'];
    return Number(usd?.final_balance || 0);
  }

  totalBalance(): number {
    return this.filtered.reduce((s, r) => s + this.balance(r), 0);
  }

  totalDebt(): number {
    return this.filtered.reduce((s, r) => s + Number(r.total_debt_gnf || 0), 0);
  }

  totalPaid(): number {
    return this.filtered.reduce((s, r) => s + Number(r.total_paid_gnf || 0), 0);
  }

  fmt(v: number | null | undefined): string {
    return new Intl.NumberFormat('fr-FR').format(Math.round(Number(v || 0)));
  }

  /** Nous devons (positif) ou avons paye d'avance (negatif). */
  state(row: SupplierRow): 'du' | 'avance' | 'solde' {
    const b = this.balance(row);
    if (b > 0) return 'du';
    if (b < 0) return 'avance';
    return 'solde';
  }

  trackRow(_i: number, r: SupplierRow) { return r.id; }
}
