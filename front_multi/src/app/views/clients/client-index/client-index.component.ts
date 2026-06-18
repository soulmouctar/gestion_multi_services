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

type SortField = 'name' | 'total_charged' | 'total_paid' | 'gross_debt_gnf'
               | 'rest_to_pay_gnf' | 'interest_remaining' | 'status';
type SortDir = 'asc' | 'desc';

interface FilteredSummary {
  total_charged: number;
  total_paid: number;
  total_advances_remaining: number;
  total_interest_remaining: number;
  total_debt: number;
  total_rest_to_pay: number;
}

@Component({
  selector: 'app-client-index',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, IconDirective,
    ButtonModule, CardModule, BadgeModule, SpinnerModule, TooltipModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-index.component.html',
  styleUrl: './client-index.component.scss'
})
export class ClientIndexComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private searchTimer?: ReturnType<typeof setTimeout>;

  loading = true;
  error = '';
  lastUpdated: Date | null = null;
  rows: any[] = [];
  filteredRows: any[] = [];
  summary: any = {};
  filteredSummary = this.emptyFilteredSummary();

  filters = {
    search: '',
    client_type: '',
    status: '' as '' | 'DEBITEUR' | 'SOLDE' | 'AVANCE',
  };

  readonly clientTypeOptions = [
    { v: '', l: 'Tous types' },
    { v: 'TEXTILE', l: 'Textile' },
    { v: 'PNEUS', l: 'Pneus' },
    { v: 'COSMETIQUES', l: 'Cosmétiques' },
    { v: 'CONTAINER_PAGNE', l: 'Conteneurs pagne' },
    { v: 'GENERAL', l: 'Général' },
  ];

  sortField: SortField = 'rest_to_pay_gnf';
  sortDir: SortDir = 'desc';

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadOverview();
  }

  loadOverview(): void {
    this.loading = true;
    this.error = '';
    let url = 'clients/financial-overview';
    const qs: string[] = [];
    if (this.filters.search) qs.push(`search=${encodeURIComponent(this.filters.search)}`);
    if (this.filters.client_type) qs.push(`client_type=${this.filters.client_type}`);
    if (qs.length) url += '?' + qs.join('&');

    this.apiService.get<any>(url).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success) {
          this.rows    = r.data.clients || [];
          this.summary = r.data.summary || {};
          this.applyClientSideFilters();
          this.lastUpdated = new Date();
        } else {
          this.error = r.message || 'Impossible de charger la situation financière des clients.';
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Le chargement a échoué. Vérifiez votre connexion puis réessayez.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyClientSideFilters(): void {
    let rows = this.rows.slice();
    if (this.filters.status) {
      rows = rows.filter(r => r.status === this.filters.status);
    }
    rows.sort((a, b) => {
      const dir = this.sortDir === 'asc' ? 1 : -1;
      const va = a[this.sortField];
      const vb = b[this.sortField];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va || '').localeCompare(String(vb || '')) * dir;
    });
    this.filteredRows = rows;
    this.filteredSummary = rows.reduce((total, row) => ({
      total_charged: total.total_charged + this.asNumber(row.total_charged),
      total_paid: total.total_paid + this.asNumber(row.total_paid),
      total_advances_remaining: total.total_advances_remaining + this.asNumber(row.advances_remaining),
      total_interest_remaining: total.total_interest_remaining + this.asNumber(row.interest_remaining),
      total_debt: total.total_debt + this.asNumber(row.gross_debt_gnf),
      total_rest_to_pay: total.total_rest_to_pay + this.asNumber(row.rest_to_pay_gnf),
    }), this.emptyFilteredSummary());
  }

  onSearchInput(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadOverview(), 350);
  }

  sortBy(field: SortField): void {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir   = field === 'name' ? 'asc' : 'desc';
    }
    this.applyClientSideFilters();
  }

  resetFilters(): void {
    clearTimeout(this.searchTimer);
    this.filters = { search: '', client_type: '', status: '' };
    this.loadOverview();
  }

  hasActiveFilters(): boolean {
    return Boolean(this.filters.search || this.filters.client_type || this.filters.status);
  }

  statusColor(s: string): string {
    return s === 'DEBITEUR' ? 'danger' : s === 'AVANCE' ? 'info' : 'success';
  }

  statusLabel(s: string): string {
    return s === 'DEBITEUR' ? 'Débiteur' : s === 'AVANCE' ? 'Avance' : 'Soldé';
  }

  clientTypeLabel(type: string): string {
    return this.clientTypeOptions.find(option => option.v === type)?.l || type || 'Non classé';
  }

  initials(name: string): string {
    return (name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  }

  fmt(v: number | null | undefined): string {
    if (v === null || v === undefined) return '—';
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(Number(v) || 0);
  }

  exportCsv(): void {
    const headers = ['Nom', 'Type', 'Téléphone', 'Total facturé', 'Total payé',
                     'Avances dispo', 'Intérêts dus', 'Dette brute', 'Reste à payer', 'Statut'];
    const lines = [headers.join(';')];
    for (const r of this.filteredRows) {
      lines.push([
        `"${(r.name || '').replace(/"/g, '""')}"`,
        r.client_type || '',
        r.phone1 || '',
        r.total_charged || 0,
        r.total_paid || 0,
        r.advances_remaining || 0,
        r.interest_remaining || 0,
        r.gross_debt_gnf || 0,
        r.rest_to_pay_gnf || 0,
        this.statusLabel(r.status),
      ].join(';'));
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `INDEX_clients_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  print(): void { window.print(); }

  trackById(_i: number, r: any): number { return r?.id; }

  sortIcon(field: SortField): string {
    if (this.sortField !== field) return 'cilSwapVertical';
    return this.sortDir === 'asc' ? 'cilArrowTop' : 'cilArrowBottom';
  }

  private asNumber(value: unknown): number {
    return Number(value) || 0;
  }

  private emptyFilteredSummary(): FilteredSummary {
    return {
      total_charged: 0,
      total_paid: 0,
      total_advances_remaining: 0,
      total_interest_remaining: 0,
      total_debt: 0,
      total_rest_to_pay: 0,
    };
  }
}
