import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  ButtonModule, CardModule, BadgeModule, ProgressModule, SpinnerModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-banking-statistics',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, IconDirective,
    ButtonModule, CardModule, BadgeModule, ProgressModule, SpinnerModule
  ],
  templateUrl: './banking-statistics.component.html'
})
export class BankingStatisticsComponent implements OnInit {

  loading     = true;
  stats: any  = null;
  accounts: any[] = [];
  period      = 'month';

  filters = {
    date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    date_to:   new Date().toISOString().split('T')[0],
    account_id: ''
  };

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadAccounts();
    this.loadStats();
  }

  loadAccounts(): void {
    this.apiService.get<any>('banking/accounts').subscribe({
      next: (r) => { this.accounts = r.success ? (r.data || []) : []; }
    });
  }

  setPeriod(p: string): void {
    this.period = p;
    const now = new Date();
    switch (p) {
      case 'week':
        const dow  = now.getDay() || 7;
        const mon  = new Date(now); mon.setDate(now.getDate() - dow + 1);
        this.filters.date_from = mon.toISOString().split('T')[0];
        break;
      case 'month':
        this.filters.date_from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        break;
      case '3months':
        const t3 = new Date(now); t3.setMonth(now.getMonth() - 2); t3.setDate(1);
        this.filters.date_from = t3.toISOString().split('T')[0];
        break;
      case 'year':
        this.filters.date_from = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        break;
    }
    this.filters.date_to = now.toISOString().split('T')[0];
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    const params: any = { ...this.filters };
    if (!params.account_id) delete params.account_id;
    this.apiService.get<any>('banking/statistics', { params }).subscribe({
      next: (r) => {
        this.stats   = r.success ? r.data : null;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  txTypeLabel(type: string): string {
    const map: Record<string, string> = {
      'DEPOT': 'Dépôts', 'RETRAIT': 'Retraits',
      'REMISE_CHEQUE': 'Remises chèque', 'VIREMENT_ENTRANT': 'Virements entrants', 'VIREMENT_SORTANT': 'Virements sortants'
    };
    return map[type] || type;
  }

  txTypeColor(type: string): string {
    const map: Record<string, string> = {
      'DEPOT': 'success', 'RETRAIT': 'danger',
      'REMISE_CHEQUE': 'info', 'VIREMENT_ENTRANT': 'primary', 'VIREMENT_SORTANT': 'warning'
    };
    return map[type] || 'secondary';
  }

  isCredit(type: string): boolean {
    return ['DEPOT', 'REMISE_CHEQUE', 'VIREMENT_ENTRANT'].includes(type);
  }

  maxByType(): number {
    if (!this.stats?.by_type?.length) return 1;
    return Math.max(...this.stats.by_type.map((t: any) => t.total));
  }

  fmt(v: number, currency = 'GNF'): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0 }).format(v || 0) + ' ' + currency;
  }

  netFlow(): number {
    return (this.stats?.summary?.total_credits || 0) - (this.stats?.summary?.total_debits || 0);
  }
}
