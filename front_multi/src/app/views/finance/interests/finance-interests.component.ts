import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BadgeModule, ButtonModule, SpinnerModule } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

type SortField = 'name' | 'interest_charged' | 'interest_paid' | 'interest_remaining' | 'gross_debt_gnf';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-finance-interests',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IconDirective,
    BadgeModule,
    ButtonModule,
    SpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance-interests.component.html',
  styleUrl: './finance-interests.component.scss',
})
export class FinanceInterestsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private searchTimer?: ReturnType<typeof setTimeout>;

  loading = true;
  error = '';
  lastUpdated: Date | null = null;
  rows: any[] = [];
  filteredRows: any[] = [];
  summary: any = {};

  filters = {
    search: '',
    client_type: '',
    only_with_interest: true,
  };

  calculator = {
    principal: 0,
    rate: 15,
  };

  sortField: SortField = 'interest_remaining';
  sortDir: SortDir = 'desc';

  readonly clientTypeOptions = [
    { v: '', l: 'Tous types' },
    { v: 'TEXTILE', l: 'Textile' },
    { v: 'PNEUS', l: 'Pneus' },
    { v: 'COSMETIQUES', l: 'Cosmétiques' },
    { v: 'MACHINE_A_COUDRE', l: 'Machine à coudre' },
  ];

  constructor(
    private apiService: ApiService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadInterests();
  }

  get calculatedInterest(): number {
    return Math.round((Number(this.calculator.principal) || 0) * (Number(this.calculator.rate) || 0) / 100);
  }

  get filteredSummary(): any {
    return this.filteredRows.reduce((total, row) => ({
      interest_charged: total.interest_charged + this.asNumber(row.interest_charged),
      interest_paid: total.interest_paid + this.asNumber(row.interest_paid),
      interest_remaining: total.interest_remaining + this.asNumber(row.interest_remaining),
      gross_debt_gnf: total.gross_debt_gnf + this.asNumber(row.gross_debt_gnf),
    }), {
      interest_charged: 0,
      interest_paid: 0,
      interest_remaining: 0,
      gross_debt_gnf: 0,
    });
  }

  loadInterests(): void {
    this.loading = true;
    this.error = '';
    let url = 'clients/financial-overview';
    const query: string[] = [];
    if (this.filters.search) query.push(`search=${encodeURIComponent(this.filters.search)}`);
    if (this.filters.client_type) query.push(`client_type=${encodeURIComponent(this.filters.client_type)}`);
    if (query.length) url += '?' + query.join('&');

    this.apiService.get<any>(url)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.rows = response.data?.clients || [];
            this.summary = response.data?.summary || {};
            this.applyFilters();
            this.lastUpdated = new Date();
          } else {
            this.error = response.message || 'Impossible de charger les intérêts.';
          }
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.error = 'Le chargement des intérêts a échoué.';
          this.loading = false;
          this.cdr.detectChanges();
        },
      });
  }

  applyFilters(): void {
    let rows = this.rows.slice();
    if (this.filters.only_with_interest) {
      rows = rows.filter(row => this.asNumber(row.interest_charged) > 0 || this.asNumber(row.interest_remaining) > 0);
    }
    rows.sort((a, b) => {
      const dir = this.sortDir === 'asc' ? 1 : -1;
      if (this.sortField === 'name') {
        return String(a.name || '').localeCompare(String(b.name || '')) * dir;
      }
      return (this.asNumber(a[this.sortField]) - this.asNumber(b[this.sortField])) * dir;
    });
    this.filteredRows = rows;
  }

  onSearchInput(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadInterests(), 350);
  }

  sortBy(field: SortField): void {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = field === 'name' ? 'asc' : 'desc';
    }
    this.applyFilters();
  }

  resetFilters(): void {
    clearTimeout(this.searchTimer);
    this.filters = { search: '', client_type: '', only_with_interest: true };
    this.loadInterests();
  }

  exportCsv(): void {
    const headers = ['Client', 'Type', 'Téléphone', 'Intérêts facturés', 'Intérêts payés', 'Intérêts dus', 'Dette brute GNF'];
    const lines = [headers.join(';')];
    for (const row of this.filteredRows) {
      lines.push([
        `"${String(row.name || '').replace(/"/g, '""')}"`,
        row.client_type || '',
        row.phone1 || '',
        row.interest_charged || 0,
        row.interest_paid || 0,
        row.interest_remaining || 0,
        row.gross_debt_gnf || 0,
      ].join(';'));
    }
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `interets_finance_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  fmt(value: number | null | undefined): string {
    if (value === null || value === undefined) return '0';
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(Number(value) || 0);
  }

  clientTypeLabel(type: string): string {
    return this.clientTypeOptions.find(option => option.v === type)?.l || type || 'Non classé';
  }

  sortIcon(field: SortField): string {
    if (this.sortField !== field) return 'cilSwapVertical';
    return this.sortDir === 'asc' ? 'cilArrowTop' : 'cilArrowBottom';
  }

  trackById(_index: number, row: any): number {
    return row?.id;
  }

  private asNumber(value: unknown): number {
    return Number(value) || 0;
  }
}
