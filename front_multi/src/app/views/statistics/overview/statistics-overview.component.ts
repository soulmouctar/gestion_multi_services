import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, catchError, of } from 'rxjs';
import { CardModule, ButtonModule, BadgeModule, ProgressModule, SpinnerModule } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-statistics-overview',
  standalone: true,
  imports: [CommonModule, RouterModule, IconDirective, CardModule, ButtonModule, BadgeModule, ProgressModule, SpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './statistics-overview.component.html'
})
export class StatisticsOverviewComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  loading = true;

  // Finance & paiements
  payments:  any = null;
  cashflow:  any = null;
  invoices:  any = null;

  // Clients & fournisseurs
  clientStats:    any = null;

  // Produits
  productStats:   any = null;

  // Conteneurs
  containerStats: any = null;

  // Location
  rentalOccupancy: any = null;
  rentalRevenue:   any = null;
  rentalLeases:    any = null;

  // Taxi
  taxiFleet:    any = null;
  taxiDrivers:  any = null;
  taxiToday:    any = null;
  taxiMonth:    any = null;
  taxiSummary:  any = null;

  // Dépenses personnelles
  expenseSummary:    any = null;
  expenseByCategory: any[] = [];
  expenseEvolution   = 0;

  // Conducteurs
  driverStats: any = null;

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading = true;
    forkJoin({
      finance:    this.apiService.get<any>('finance/dashboard').pipe(catchError(() => of({ success: false }))),
      products:   this.apiService.get<any>('products/statistics').pipe(catchError(() => of({ success: false }))),
      clients:    this.apiService.get<any>('clients/statistics').pipe(catchError(() => of({ success: false }))),
      containers: this.apiService.get<any>('containers/statistics/general').pipe(catchError(() => of({ success: false }))),
      rental:     this.apiService.get<any>('rental/dashboard').pipe(catchError(() => of({ success: false }))),
      taxi:       this.apiService.get<any>('taxi/dashboard').pipe(catchError(() => of({ success: false }))),
      expenses:   this.apiService.get<any>('personal-expenses/statistics').pipe(catchError(() => of({ success: false }))),
      drivers:    this.apiService.get<any>('drivers/statistics').pipe(catchError(() => of({ success: false }))),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r: any) => {
        // Finance
        if (r.finance.success && r.finance.data) {
          const d = r.finance.data;
          this.payments = d.payments  || null;
          this.cashflow = d.cashflow  || null;
          this.invoices = d.invoices  || null;
        }

        // Produits
        if (r.products.success && r.products.data) {
          this.productStats = r.products.data;
        }

        // Clients
        if (r.clients.success && r.clients.data) {
          this.clientStats = r.clients.data;
        }

        // Conteneurs
        if (r.containers.success && r.containers.data) {
          this.containerStats = r.containers.data;
        }

        // Location
        if (r.rental.success && r.rental.data) {
          const d = r.rental.data;
          this.rentalOccupancy = d.occupancy || null;
          this.rentalRevenue   = d.revenue   || null;
          this.rentalLeases    = d.leases    || null;
        }

        // Taxi
        if (r.taxi.success && r.taxi.data) {
          const d = r.taxi.data;
          this.taxiFleet   = d.fleet   || null;
          this.taxiDrivers = d.drivers || null;
          this.taxiToday   = d.today   || null;
          this.taxiMonth   = d.month   || null;
          this.taxiSummary = d.summary || null;
        }

        // Dépenses personnelles
        if (r.expenses.success && r.expenses.data) {
          const d = r.expenses.data;
          this.expenseSummary    = d.summary     || null;
          this.expenseByCategory = d.by_category || [];
          this.expenseEvolution  = d.evolution_percent ?? 0;
        }

        // Conducteurs
        if (r.drivers.success && r.drivers.data) {
          this.driverStats = r.drivers.data;
        }

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  // ── Taux ──────────────────────────────────────────────────
  get rentalCollectionRate(): number {
    const expected = this.rentalRevenue?.expected_monthly ?? 0;
    const collected = this.rentalRevenue?.collected_month ?? 0;
    if (!expected) return 0;
    return Math.min(100, Math.round((collected / expected) * 100));
  }

  get taxiCollectionRate(): number {
    const expected = this.taxiSummary?.total_expected ?? 0;
    const paid     = this.taxiSummary?.total_paid     ?? 0;
    if (!expected) return 0;
    return Math.min(100, Math.round((paid / expected) * 100));
  }

  get occupancyRate(): number {
    return Math.round(this.rentalOccupancy?.occupancy_rate ?? 0);
  }

  // ── Utilitaires ───────────────────────────────────────────
  fmt(v: number | null | undefined, currency = 'GNF'): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0 }).format(v || 0) + ' ' + currency;
  }

  progressClass(rate: number): string {
    if (rate >= 80) return 'bg-success';
    if (rate >= 50) return 'bg-warning';
    return 'bg-danger';
  }

  trackById(_index: number, item: any): any { return item?.id ?? _index; }
}
