import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ButtonModule, CardModule, BadgeModule, AlertModule, SpinnerModule,
  RowComponent, ColComponent, ContainerComponent, TableModule, ProgressModule
} from '@coreui/angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-client-account',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule, CardModule, BadgeModule, AlertModule, SpinnerModule,
    RowComponent, ColComponent, ContainerComponent, TableModule, ProgressModule
  ],
  templateUrl: './client-account.component.html'
})
export class ClientAccountComponent implements OnInit {
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
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
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
    this.apiService.get<any>(`clients/${this.clientId}`).subscribe({
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
    this.apiService.get<any>(`container-sales/client-stats/${this.clientId}`).subscribe({
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
    this.apiService.get<any>(`container-sales?client_id=${this.clientId}&per_page=100`).subscribe({
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
    this.apiService.get<any>(`container-sale-payments?client_id=${this.clientId}&per_page=100`).subscribe({
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
    this.apiService.get<any>(`client-advances?client_id=${this.clientId}&per_page=100`).subscribe({
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
    const amountPaidGNF = this.convertToGNF(sale.amount_paid || 0, sale.currency || 'GNF');
    const salePriceGNF = this.convertToGNF(sale.sale_price, sale.currency || 'GNF');
    return Math.round((amountPaidGNF / salePriceGNF) * 100);
  }
}
