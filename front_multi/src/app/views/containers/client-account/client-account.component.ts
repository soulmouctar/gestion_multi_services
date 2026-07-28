import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ButtonModule, CardModule, BadgeModule, AlertModule, SpinnerModule,
  TableModule, ProgressModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { PdfService } from '../../../core/services/pdf.service';

@Component({
  selector: 'app-client-account',
  standalone: true,
  imports: [
    CommonModule, IconDirective,
    ButtonModule, CardModule, BadgeModule, AlertModule, SpinnerModule,
    TableModule, ProgressModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-account.component.html',
  styles: [`
    :host { display: block; }

    .chip {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18);
      padding: 5px 10px; border-radius: 999px; font-size: 0.75rem; color: rgba(255,255,255,0.9);
      backdrop-filter: blur(4px);
    }

    .btn-hero-ghost, .btn-hero-primary {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 9px 16px; border-radius: 10px; font-size: 0.82rem; font-weight: 600;
      cursor: pointer; transition: all .18s ease; border: none;
    }
    .btn-hero-ghost {
      background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.25);
    }
    .btn-hero-ghost:hover { background: rgba(255,255,255,0.16); }
    .btn-hero-primary {
      background: #fff; color: #0f172a; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .btn-hero-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,0,0,0.2); }
    .btn-hero-ghost svg, .btn-hero-primary svg { width: 14px; height: 14px; }

    .kpi-card {
      background: #fff; border-radius: 14px; padding: 16px 18px;
      display: flex; align-items: center; gap: 14px; height: 100%;
      border: 1px solid #eef1f6;
      transition: transform .18s ease, box-shadow .18s ease;
    }
    .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 12px 24px -12px rgba(15,23,42,0.15); }
    .kpi-icon {
      width: 44px; height: 44px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .kpi-icon svg { width: 20px; height: 20px; }
    .kpi-body { min-width: 0; }
    .kpi-label {
      font-size: 0.68rem; text-transform: uppercase; letter-spacing: .06em;
      color: #64748b; font-weight: 600; margin-bottom: 2px;
    }
    .kpi-value {
      font-size: 1rem; font-weight: 700; line-height: 1.2;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .kpi-sub { font-size: 0.68rem; color: #94a3b8; margin-top: 2px; }

    .balance-banner {
      display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
      border-radius: 16px; padding: 22px 26px; color: #fff;
      box-shadow: 0 10px 30px -14px rgba(15,23,42,0.35);
    }
    .balance-icon {
      width: 52px; height: 52px; border-radius: 14px;
      background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.22);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .balance-icon svg { width: 24px; height: 24px; }
    .balance-label {
      font-size: 0.72rem; text-transform: uppercase; letter-spacing: .08em;
      color: rgba(255,255,255,0.75); margin-bottom: 4px;
    }
    .balance-value { font-size: 1.75rem; font-weight: 800; line-height: 1.1; }
    .balance-pill {
      background: rgba(255,255,255,0.2); padding: 7px 14px; border-radius: 999px;
      font-size: 0.78rem; font-weight: 600; backdrop-filter: blur(4px);
    }

    .section-card {
      background: #fff; border-radius: 14px; border: 1px solid #eef1f6; overflow: hidden;
    }
    .section-header {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 16px 20px; border-bottom: 1px solid #f1f5f9; background: #fafbfd;
    }
    .section-title { display: flex; align-items: center; gap: 12px; }
    .section-badge {
      width: 36px; height: 36px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
    }
    .section-badge svg { width: 16px; height: 16px; }
    .count-chip {
      padding: 4px 12px; border-radius: 999px; font-size: 0.72rem; font-weight: 700;
    }

    .modern-table { font-size: 0.85rem; }
    .modern-table thead th {
      background: #fafbfd; color: #64748b; font-weight: 600;
      font-size: 0.7rem; text-transform: uppercase; letter-spacing: .04em;
      padding: 12px 14px; border: none; border-bottom: 1px solid #eef1f6;
    }
    .modern-table tbody td {
      padding: 12px 14px; border: none; border-bottom: 1px solid #f5f6fa; vertical-align: middle;
    }
    .modern-table tbody tr:last-child td { border-bottom: none; }
    .modern-table tbody tr:hover td { background: #fafbfd; }
    .cell-muted { color: #94a3b8; font-size: 0.8rem; }
    .ref-code {
      background: #f1f5f9; color: #475569; padding: 3px 8px;
      border-radius: 6px; font-size: 0.75rem; font-family: 'SF Mono', Menlo, monospace;
    }
    .tag {
      display: inline-block; padding: 4px 10px; border-radius: 999px;
      font-size: 0.7rem; font-weight: 600;
    }
    .status-pill {
      display: inline-block; padding: 4px 10px; border-radius: 999px;
      font-size: 0.7rem; font-weight: 600;
    }

    .progress-track { height: 6px; background: #eef1f6; border-radius: 999px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 999px; transition: width .3s ease; }
    .progress-label { font-size: 0.68rem; color: #94a3b8; margin-top: 4px; font-weight: 600; }

    .empty-row {
      text-align: center; padding: 32px 12px !important;
      color: #94a3b8; font-size: 0.85rem;
    }
    .empty-row svg { display: block; margin: 0 auto 8px; }

    @media print {
      :host .client-account-page { background: #fff !important; padding: 0 !important; }
      .btn-hero-ghost, .btn-hero-primary { display: none !important; }
      .hero-card, .section-card, .kpi-card, .balance-banner { box-shadow: none !important; }
      .section-card, .kpi-card, .balance-banner { break-inside: avoid; }
    }
  `]
})
export class ClientAccountComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  clientId: number | null = null;
  client: any = null;
  clientStats: any = null;
  sales: any[] = [];
  payments: any[] = [];
  advances: any[] = [];
  loading = false;
  error: string | null = null;

  // Exchange rates
  exchangeRates: { [key: string]: number } = {
    'GNF': 1,
    'USD': 8600,
    'EUR': 9300
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService,
    private pdfService: PdfService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.clientId = +params['id'];
      if (this.clientId) {
        this.loadClientData();
      }
    });
  }

  loadClientData(): void {
    this.loading = true;
    this.error = null;

    // Load client info
    this.apiService.get<any>(`clients/${this.clientId}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.client = r.data;
        }
        this.loadClientStats();
      },
      error: () => {
        this.error = 'Erreur lors du chargement du client';
        this.loading = false;
      }
    });
  }

  loadClientStats(): void {
    this.apiService.get<any>(`container-sales/client-stats/${this.clientId}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.clientStats = r.data;
        }
        this.loadSales();
      },
      error: () => {
        this.error = 'Erreur lors du chargement des statistiques';
        this.loading = false;
      }
    });
  }

  loadSales(): void {
    this.apiService.get<any>(`container-sales?client_id=${this.clientId}&per_page=100`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.sales = r.data.data || r.data || [];
        }
        this.loadPayments();
      },
      error: () => {
        this.sales = [];
        this.loadPayments();
      }
    });
  }

  loadPayments(): void {
    this.apiService.get<any>(`container-sale-payments?client_id=${this.clientId}&per_page=100`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.payments = r.data.data || r.data || [];
        }
        this.loadAdvances();
      },
      error: () => {
        this.payments = [];
        this.loadAdvances();
      }
    });
  }

  loadAdvances(): void {
    this.apiService.get<any>(`client-advances?client_id=${this.clientId}&per_page=100`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.advances = r.data.data || r.data || [];
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.advances = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/containers/payments']);
  }

  printPage(): void {
    const tenant = this.authService.currentTenant as any;
    void this.pdfService.printContainerClientAccountPdf({
      client: this.client,
      stats: this.clientStats,
      sales: this.sales,
      payments: this.payments,
      advances: this.advances,
      organisation: {
        name: tenant?.name || 'MATKOLLA',
        address: tenant?.address || '',
        phone: tenant?.phone || '',
        email: tenant?.email || '',
        logoUrl: tenant?.logo_url || '',
        footerText: `Compte client conteneur — ${this.client?.name || ''}`,
      },
    });
  }

  getInitials(name?: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p.charAt(0).toUpperCase()).join('');
  }

  getAvatarColor(name?: string): string {
    const palette = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6'];
    if (!name) return palette[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }

  formatAmount(amount: number, currency: string = 'GNF'): string {
    return new Intl.NumberFormat('fr-GN', { style: 'decimal', minimumFractionDigits: 0 }).format(amount || 0) + ' ' + currency;
  }

  convertToGNF(amount: number, fromCurrency: string): number {
    if (fromCurrency === 'GNF') return amount;
    const rate = this.exchangeRates[fromCurrency] || 1;
    return amount * rate;
  }

  formatAmountWithConversion(amount: number, currency: string): string {
    if (currency === 'GNF') {
      return this.formatAmount(amount, currency);
    }
    const gnfAmount = this.convertToGNF(amount, currency);
    return `${this.formatAmount(amount, currency)} (≈ ${this.formatAmount(gnfAmount, 'GNF')})`;
  }

  resolveStoredGnf(amount: number, currency: string, storedGnf?: number | null, exchangeRate?: number | null): number {
    if (storedGnf !== null && storedGnf !== undefined && Number(storedGnf) > 0) {
      return Number(storedGnf);
    }
    if (currency === 'GNF') {
      return amount || 0;
    }
    if (exchangeRate && Number(exchangeRate) > 0) {
      return Number(amount || 0) * Number(exchangeRate);
    }
    return this.convertToGNF(amount || 0, currency || 'GNF');
  }

  getConversionLabel(amount: number, currency: string, storedGnf?: number | null, exchangeRate?: number | null): string {
    const code = currency || 'GNF';
    if (code === 'GNF') {
      return 'Montant saisi en GNF';
    }
    const gnfAmount = this.resolveStoredGnf(amount, code, storedGnf, exchangeRate);
    const rate = exchangeRate && Number(exchangeRate) > 0 ? Number(exchangeRate) : this.exchangeRates[code] || 1;
    return `Taux du jour: ${rate} | Équiv. GNF: ${this.formatAmount(gnfAmount, 'GNF')}`;
  }

  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'EN_COURS': 'warning',
      'PAYE_PARTIEL': 'info',
      'PAYE_TOTAL': 'success',
      'ANNULE': 'danger',
      'DISPONIBLE': 'success',
      'UTILISE_PARTIEL': 'info',
      'UTILISE_TOTAL': 'secondary'
    };
    return colors[status] || 'secondary';
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'EN_COURS': 'En cours',
      'PAYE_PARTIEL': 'Payé partiel',
      'PAYE_TOTAL': 'Payé total',
      'ANNULE': 'Annulé',
      'DISPONIBLE': 'Disponible',
      'UTILISE_PARTIEL': 'Utilisé partiel',
      'UTILISE_TOTAL': 'Utilisé total'
    };
    return labels[status] || status;
  }

  getPaymentProgress(sale: any): number {
    if (!sale.sale_price || sale.sale_price === 0) return 0;
    const amountPaidGNF = this.resolveStoredGnf(sale.amount_paid || 0, sale.currency || 'GNF', sale.amount_paid_gnf, sale.exchange_rate);
    const salePriceGNF = this.resolveStoredGnf(sale.sale_price, sale.currency || 'GNF', sale.sale_price_gnf, sale.exchange_rate);
    return Math.round((amountPaidGNF / salePriceGNF) * 100);
  }
  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }

}
