import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ButtonModule, CardModule, FormModule, BadgeModule, SpinnerModule, ProgressModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-expense-statistics',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IconDirective, RouterModule,
    ButtonModule, CardModule, FormModule, BadgeModule, SpinnerModule, ProgressModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expense-statistics.component.html'
})
export class ExpenseStatisticsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);


  loading = false;
  stats: any = null;
  isSuperAdmin = false;
  tenants: any[] = [];
  selectedTenantId: number | null = null;

  // Period selector
  selectedPeriod = 'month';
  dateFrom = '';
  dateTo   = '';

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isSuperAdmin = this.authService.isSuperAdmin;
    this.selectedTenantId = this.authService.selectedManagedTenantId;
    if (this.isSuperAdmin) {
      this.loadTenants();
      return;
    }

    this.setPeriod('month');
  }

  private loadTenants(): void {
    this.apiService.get<any>('tenants?per_page=200').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        const data = r.success ? (r.data?.data || r.data || []) : [];
        this.tenants = data;
        if (this.tenants.length > 0 && !this.selectedTenantId) {
          this.selectedTenantId = this.tenants[0].id;
          this.authService.setSelectedManagedTenantId(this.selectedTenantId);
        }
        this.cdr.detectChanges();
        this.setPeriod('month');
      },
      error: () => this.cdr.detectChanges()
    });
  }

  onTenantChange(): void {
    this.authService.setSelectedManagedTenantId(this.selectedTenantId);
    this.loadStats();
  }

  private tenantQuery(): string {
    return this.isSuperAdmin && this.selectedTenantId
      ? `&tenant_id=${this.selectedTenantId}`
      : '';
  }

  private ensureTenantSelection(): boolean {
    if (this.isSuperAdmin && !this.selectedTenantId) {
      Swal.fire({ icon: 'warning', title: 'Sélectionnez un tenant', text: 'Choisissez d\'abord l\'organisation à gérer.' });
      return false;
    }

    return true;
  }

  setPeriod(period: string): void {
    this.selectedPeriod = period;
    const now = new Date();
    switch (period) {
      case 'week':
        this.dateFrom = new Date(now.getTime() - 7 * 864e5).toISOString().split('T')[0];
        this.dateTo   = now.toISOString().split('T')[0];
        break;
      case 'month':
        this.dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        this.dateTo   = now.toISOString().split('T')[0];
        break;
      case '3months':
        this.dateFrom = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
        this.dateTo   = now.toISOString().split('T')[0];
        break;
      case 'year':
        this.dateFrom = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        this.dateTo   = now.toISOString().split('T')[0];
        break;
    }
    this.loadStats();
  }

  loadStats(): void {
    if (!this.ensureTenantSelection()) return;

    this.loading = true;
    this.apiService.get<any>(`personal-expenses/statistics?date_from=${this.dateFrom}&date_to=${this.dateTo}${this.tenantQuery()}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) this.stats = r.data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; }
    });
  }

  getMaxCategory(): number {
    if (!this.stats?.by_category?.length) return 1;
    return Math.max(...this.stats.by_category.map((c: any) => c.total));
  }

  getCategoryPct(c: any): number {
    const total = this.stats?.summary?.total_amount;
    if (!total) return 0;
    return Math.round((c.total / total) * 100);
  }

  getEvolutionIcon(): string {
    const ev = this.stats?.evolution_percent ?? 0;
    return ev > 0 ? 'cilArrowTop' : ev < 0 ? 'cilArrowBottom' : 'cilMinus';
  }

  getEvolutionColor(): string {
    const ev = this.stats?.evolution_percent ?? 0;
    return ev > 0 ? 'text-danger' : ev < 0 ? 'text-success' : 'text-muted';
  }

  fmt(v: number, currency = 'GNF'): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0 }).format(v || 0) + ' ' + currency;
  }
  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }

}
