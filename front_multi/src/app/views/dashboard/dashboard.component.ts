import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SpinnerModule, AlertModule } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../core/services/api.service';

interface Debtor {
  client_id: number;
  name: string;
  phone: string | null;
  client_type: string | null;
  due_gnf: number;
}

interface Movement {
  kind: 'payment' | 'invoice';
  label: string;
  amount_gnf: number;
  date: string;
  method?: string;
  status?: string;
}

interface BusinessDashboard {
  receivables: {
    total_gnf: number;
    from_invoices_gnf: number;
    from_containers_gnf: number;
    client_credit_gnf: number;
    debtor_count: number;
  };
  cash: { today_gnf: number; month_gnf: number };
  alerts: {
    overdue_invoices: number;
    overdue_amount_gnf: number;
    low_stock_products: number;
    out_of_stock_products: number;
    vehicle_docs_expiring: number;
    leases_ending: number;
  };
  modules: {
    containers_pending: number;
    taxi_collected_today_gnf: number;
    housing_occupied: number;
    housing_free: number;
  };
  top_debtors: Debtor[];
  cash_trend: { month: string; total_gnf: number }[];
  recent: Movement[];
  generated_at: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, SpinnerModule, AlertModule, IconDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  loading = true;
  error: string | null = null;
  data: BusinessDashboard | null = null;

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.apiService.get<BusinessDashboard>('dashboard/business')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r: any) => {
          this.data = r?.data ?? null;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (e: any) => {
          // On affiche l'erreur : un tableau de bord vide sans explication
          // laisserait croire qu'il n'y a simplement rien a montrer.
          this.error = e?.error?.message || e?.message || 'Impossible de charger le tableau de bord';
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  /** Montant compact : 1 250 000 → « 1,25 M ». Les grands nombres sont illisibles bruts. */
  short(v: number | null | undefined): string {
    const n = Number(v || 0);
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace('.', ',') + ' Md';
    if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2).replace('.', ',') + ' M';
    if (abs >= 1_000) return Math.round(n / 1_000) + ' k';
    return String(Math.round(n));
  }

  full(v: number | null | undefined): string {
    return new Intl.NumberFormat('fr-FR').format(Math.round(Number(v || 0)));
  }

  /** Hauteur relative d'une barre du graphique, en pourcentage. */
  barHeight(v: number): number {
    const max = Math.max(...(this.data?.cash_trend ?? []).map(m => m.total_gnf), 1);
    return Math.max(2, Math.round((Number(v || 0) / max) * 100));
  }

  get hasAlerts(): boolean {
    const a = this.data?.alerts;
    if (!a) return false;
    return a.overdue_invoices > 0 || a.low_stock_products > 0 || a.out_of_stock_products > 0
      || a.vehicle_docs_expiring > 0 || a.leases_ending > 0;
  }

  trackDebtor(_i: number, d: Debtor) { return d.client_id; }
  trackMovement(_i: number, m: Movement) { return m.kind + m.label + m.date; }
  trackMonth(_i: number, m: { month: string }) { return m.month; }
}
