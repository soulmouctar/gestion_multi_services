import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SpinnerModule } from '@coreui/angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-taxi-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, SpinnerModule],
  styles: [`
    .dash-header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      border-radius: 18px;
      padding: 30px 32px;
      margin-bottom: 24px;
      position: relative;
      overflow: hidden;
    }
    .dash-header::before {
      content: '';
      position: absolute;
      top: -50px; right: -50px;
      width: 220px; height: 220px;
      background: rgba(255,255,255,0.04);
      border-radius: 50%;
    }
    .dash-header::after {
      content: '';
      position: absolute;
      bottom: -70px; left: 40%;
      width: 300px; height: 300px;
      background: rgba(255,255,255,0.03);
      border-radius: 50%;
    }
    .quick-link {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      padding: 10px 18px;
      color: rgba(255,255,255,0.85);
      font-size: .8rem;
      font-weight: 600;
      text-decoration: none;
      transition: all .2s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .quick-link:hover {
      background: rgba(255,255,255,0.16);
      color: #fff;
      transform: translateY(-1px);
    }
    .kpi-card {
      border-radius: 12px;
      padding: 14px 16px;
      border: none;
      background: #fff;
      transition: transform .2s, box-shadow .2s;
      position: relative;
      overflow: hidden;
    }
    .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.08) !important; }
    .kpi-icon {
      width: 36px; height: 36px;
      border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
    }
    .kpi-value { font-size: 1.45rem; font-weight: 800; line-height: 1; }
    .kpi-label { font-size: .65rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    .revenue-card {
      border-radius: 14px;
      padding: 18px 20px;
      border: none;
      transition: transform .2s;
    }
    .revenue-card:hover { transform: translateY(-2px); }
    .section-title {
      font-size: .68rem;
      font-weight: 700;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: #9ca3af;
      margin-bottom: 16px;
    }
    .rank-badge {
      width: 28px; height: 28px;
      border-radius: 8px;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: .75rem; font-weight: 800;
    }
    .driver-row, .vehicle-row {
      padding: 10px 14px;
      border-radius: 10px;
      transition: background .15s;
    }
    .driver-row:hover, .vehicle-row:hover { background: #f8fafc; }
    .avatar-circle {
      width: 36px; height: 36px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: .82rem;
    }
    .bar-track {
      height: 5px; border-radius: 3px;
      background: #f0f2f5; overflow: hidden;
    }
    .bar-fill { height: 100%; border-radius: 3px; transition: width .6s ease; }
    .alert-dot {
      width: 8px; height: 8px; border-radius: 50%;
      display: inline-block; margin-right: 6px; flex-shrink: 0;
    }
    .doc-alert-card {
      background: #fffbf0;
      border: 1px solid #fde68a;
      border-radius: 12px;
      padding: 14px 16px;
    }
    .empty-state {
      text-align: center;
      padding: 48px 20px;
      color: #9ca3af;
    }
  `],
  template: `
<div class="p-3 p-md-4">

  <!-- Loading -->
  <div *ngIf="loading" class="empty-state">
    <c-spinner color="primary"></c-spinner>
    <div class="mt-3 small">Chargement du tableau de bord...</div>
  </div>

  <!-- Error state -->
  <div *ngIf="!loading && !data" class="empty-state">
    <div style="font-size:3rem">🚕</div>
    <p class="mt-2">Impossible de charger le tableau de bord</p>
    <button class="btn btn-outline-primary btn-sm mt-2" (click)="load()">Réessayer</button>
  </div>

  <ng-container *ngIf="!loading && data">

    <!-- ── Header Banner ── -->
    <div class="dash-header text-white mb-4">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-3">
        <div style="position:relative;z-index:1">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span style="font-size:1.5rem">🚕</span>
            <span class="fw-semibold" style="font-size:.72rem;letter-spacing:.1em;opacity:.7">MODULE TAXI & TRANSPORT</span>
          </div>
          <h2 class="fw-bold mb-1" style="font-size:1.7rem">Tableau de Bord</h2>
          <p class="mb-3 opacity-60" style="font-size:.83rem">
            Vue d'ensemble de votre flotte — <strong class="text-white">{{ period }}</strong>
          </p>
          <!-- Quick nav links -->
          <div class="d-flex flex-wrap gap-2">
            <a routerLink="../vehicles" class="quick-link">🚗 Véhicules</a>
            <a routerLink="../drivers" class="quick-link">👤 Conducteurs</a>
            <a routerLink="../daily-payments" class="quick-link">💰 Versements</a>
            <a routerLink="../vehicle-expenses" class="quick-link">🔧 Dépenses</a>
            <a routerLink="../documents" class="quick-link">📄 Documents</a>
          </div>
        </div>
        <!-- Header KPIs -->
        <div class="d-flex gap-3 text-center" style="position:relative;z-index:1">
          <div class="px-3">
            <div class="fw-bold" style="font-size:2rem;line-height:1">{{ data.fleet?.total ?? 0 }}</div>
            <div class="opacity-60" style="font-size:.7rem">Véhicules</div>
          </div>
          <div style="width:1px;background:rgba(255,255,255,.15)"></div>
          <div class="px-3">
            <div class="fw-bold" style="font-size:2rem;line-height:1">{{ data.drivers?.total ?? 0 }}</div>
            <div class="opacity-60" style="font-size:.7rem">Conducteurs</div>
          </div>
          <div style="width:1px;background:rgba(255,255,255,.15)"></div>
          <div class="px-3">
            <div class="fw-bold" [style.color]="(data.month?.net ?? 0) >= 0 ? '#34d399' : '#f87171'"
              style="font-size:1.5rem;line-height:1">
              {{ fmt(data.month?.net) }}
            </div>
            <div class="opacity-60" style="font-size:.7rem">Bénéfice mois</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── KPI Row ── -->
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-3">
        <div class="kpi-card shadow-sm">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <div class="kpi-icon" style="background:#EEF2FF;color:#6366F1">🚗</div>
            <span class="badge rounded-pill px-2" style="background:#EEF2FF;color:#6366F1;font-size:.62rem">Total</span>
          </div>
          <div class="kpi-value" style="color:#1e1e2d">{{ data.fleet?.total ?? 0 }}</div>
          <div class="kpi-label mt-1" style="color:#6366F1">Véhicules</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card shadow-sm">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <div class="kpi-icon" style="background:#ECFDF5;color:#10B981">✅</div>
            <span class="badge rounded-pill px-2" style="background:#ECFDF5;color:#10B981;font-size:.62rem">Service</span>
          </div>
          <div class="kpi-value" style="color:#10B981">{{ data.fleet?.active ?? 0 }}</div>
          <div class="kpi-label mt-1" style="color:#10B981">Actifs</div>
          <div class="bar-track mt-2">
            <div class="bar-fill" style="background:#10B981" [style.width]="fleetActiveRate() + '%'"></div>
          </div>
          <div class="mt-1" style="font-size:.62rem;color:#10B981">{{ fleetActiveRate() }}% de la flotte</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card shadow-sm">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <div class="kpi-icon" style="background:#FFFBEB;color:#F59E0B">🔧</div>
            <span class="badge rounded-pill px-2" style="background:#FFFBEB;color:#F59E0B;font-size:.62rem">Maint.</span>
          </div>
          <div class="kpi-value" style="color:#F59E0B">{{ data.fleet?.maintenance ?? 0 }}</div>
          <div class="kpi-label mt-1" style="color:#F59E0B">Maintenance</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card shadow-sm">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <div class="kpi-icon" style="background:#F0FDF4;color:#22C55E">👤</div>
            <span class="badge rounded-pill px-2" style="background:#F0FDF4;color:#22C55E;font-size:.62rem">Actifs</span>
          </div>
          <div class="kpi-value" style="color:#22C55E">{{ data.drivers?.active ?? 0 }}</div>
          <div class="kpi-label mt-1" style="color:#22C55E">Conducteurs</div>
        </div>
      </div>
    </div>

    <!-- ── Revenus 3 cards ── -->
    <div class="row g-3 mb-4">
      <div class="col-md-4">
        <div class="revenue-card shadow-sm" style="background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <div style="font-size:.65rem;font-weight:700;letter-spacing:.08em;opacity:.8">AUJOURD'HUI</div>
              <div style="font-size:1.4rem;font-weight:800;line-height:1.1">{{ fmt(data.today?.collected) }}</div>
            </div>
            <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px;font-size:1.1rem">🕐</div>
          </div>
          <div style="font-size:.76rem;opacity:.8">
            <strong class="text-white">{{ data.today?.payment_count ?? 0 }}</strong> versement(s)
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="revenue-card shadow-sm" style="background:linear-gradient(135deg,#0EA5E9,#06B6D4);color:#fff">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <div style="font-size:.65rem;font-weight:700;letter-spacing:.08em;opacity:.8">CE MOIS</div>
              <div style="font-size:1.4rem;font-weight:800;line-height:1.1">{{ fmt(data.month?.collected) }}</div>
            </div>
            <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px;font-size:1.1rem">💰</div>
          </div>
          <div style="font-size:.76rem;opacity:.8">
            Dépenses : <strong class="text-white">{{ fmt(data.month?.expenses) }}</strong>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="revenue-card shadow-sm"
          [style.background]="(data.month?.net ?? 0) >= 0 ? 'linear-gradient(135deg,#10B981,#059669)' : 'linear-gradient(135deg,#EF4444,#DC2626)'"
          style="color:#fff">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <div style="font-size:.65rem;font-weight:700;letter-spacing:.08em;opacity:.8">BÉNÉFICE NET</div>
              <div style="font-size:1.4rem;font-weight:800;line-height:1.1">{{ fmt(data.month?.net) }}</div>
            </div>
            <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px;font-size:1.1rem">
              {{ (data.month?.net ?? 0) >= 0 ? '📈' : '📉' }}
            </div>
          </div>
          <div style="font-size:.76rem;opacity:.8">Recettes − Dépenses du mois</div>
        </div>
      </div>
    </div>

    <!-- ── Évolution mensuelle ── -->
    <div class="row g-3 mb-4" *ngIf="data.monthly_revenue?.length > 0">
      <div class="col-12">
        <div class="shadow-sm rounded-4 bg-white p-4">
          <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
              <div class="section-title mb-0">Évolution des recettes</div>
              <div class="text-muted" style="font-size:.8rem">12 derniers mois</div>
            </div>
            <span class="badge rounded-pill px-3 py-2" style="background:#F0FDF4;color:#10B981;font-size:.78rem">
              {{ fmt(monthlyTotal()) }} collecté
            </span>
          </div>
          <div class="d-flex align-items-end gap-1" style="height:90px">
            <ng-container *ngFor="let m of data.monthly_revenue">
              <div class="flex-fill d-flex flex-column align-items-center gap-1">
                <div class="rounded-top w-100"
                  [style.height]="barHeight(m.collected) + 'px'"
                  [style.background]="m.month === period ? '#6366F1' : '#E0E7FF'"
                  [title]="m.month + ': ' + fmt(m.collected)">
                </div>
                <div class="text-muted" style="font-size:.58rem;white-space:nowrap">{{ m.month | slice:5 }}</div>
              </div>
            </ng-container>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Alertes documents ── -->
    <div class="row g-3 mb-4" *ngIf="data.document_alerts?.length > 0">
      <div class="col-12">
        <div class="shadow-sm rounded-4 bg-white p-4">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div>
              <div class="section-title mb-0">Alertes Documents</div>
            </div>
            <span class="badge rounded-pill px-3 py-2" style="background:#FEF3C7;color:#D97706;font-size:.78rem">
              ⚠️ {{ data.document_alerts.length }} véhicule(s)
            </span>
          </div>
          <div class="row g-2">
            <div class="col-md-6 col-lg-4" *ngFor="let v of data.document_alerts">
              <div class="doc-alert-card">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <span class="fw-bold" style="font-size:.9rem">🚕 {{ v.plate_number }}</span>
                  <span class="text-muted small">{{ v.brand }} {{ v.vehicle_model }}</span>
                </div>
                <div *ngFor="let a of v.alerts" class="d-flex align-items-center mb-1">
                  <span class="alert-dot" [style.background]="dotColor(a.urgency)"></span>
                  <span style="font-size:.74rem">
                    {{ docFieldLabel(a.field) }} :
                    <strong [style.color]="dotColor(a.urgency)">
                      {{ a.days < 0 ? 'EXPIRÉ' : a.days + 'j restants' }}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Top conducteurs + Performance véhicules ── -->
    <div class="row g-3">
      <!-- Top conducteurs -->
      <div class="col-md-6" *ngIf="data.top_drivers?.length > 0">
        <div class="shadow-sm rounded-4 bg-white p-4 h-100">
          <div class="section-title">🏆 Top Conducteurs — {{ period }}</div>
          <div *ngFor="let d of data.top_drivers; let i = index"
            class="driver-row d-flex align-items-center gap-3 mb-1">
            <div class="rank-badge"
              [style.background]="i===0 ? '#FEF3C7' : i===1 ? '#F3F4F6' : '#FFF7ED'"
              [style.color]="i===0 ? '#D97706' : i===1 ? '#6B7280' : '#EA580C'">
              {{ i + 1 }}
            </div>
            <div class="avatar-circle" [style.background]="avatarBg(i)" style="color:#fff;flex-shrink:0">
              {{ d.name.charAt(0).toUpperCase() }}
            </div>
            <div class="flex-fill">
              <div class="fw-semibold" style="font-size:.87rem">{{ d.name }}</div>
              <div class="text-muted" style="font-size:.73rem">{{ d.payment_count }} versement(s)</div>
            </div>
            <div class="fw-bold" style="color:#10B981;font-size:.9rem">{{ fmt(d.total_collected) }}</div>
          </div>
        </div>
      </div>

      <!-- Performance véhicules -->
      <div [class]="data.top_drivers?.length > 0 ? 'col-md-6' : 'col-12'">
        <div class="shadow-sm rounded-4 bg-white p-4 h-100">
          <div class="section-title">🚗 Performance Véhicules — {{ period }}</div>
          <div *ngIf="data.vehicle_performance?.length > 0">
            <div *ngFor="let v of data.vehicle_performance"
              class="vehicle-row d-flex align-items-center gap-3 mb-1">
              <div style="width:8px;height:8px;border-radius:50%;flex-shrink:0"
                [style.background]="v.status === 'ACTIVE' ? '#10B981' : v.status === 'MAINTENANCE' ? '#F59E0B' : '#9CA3AF'">
              </div>
              <div class="flex-fill">
                <div class="fw-semibold" style="font-size:.87rem">{{ v.plate_number }}</div>
                <div class="text-muted" style="font-size:.73rem" *ngIf="v.brand">
                  {{ v.brand }} {{ v.vehicle_model }}
                </div>
                <div class="bar-track mt-1" style="max-width:160px">
                  <div class="bar-fill"
                    [style.background]="v.monthly_collected > 0 ? '#6366F1' : '#E5E7EB'"
                    [style.width]="vehicleBarWidth(v.monthly_collected) + '%'">
                  </div>
                </div>
              </div>
              <div class="text-end">
                <div class="fw-bold" [style.color]="v.monthly_collected > 0 ? '#10B981' : '#9CA3AF'"
                  style="font-size:.88rem">
                  {{ fmt(v.monthly_collected) }}
                </div>
                <div class="text-muted" style="font-size:.7rem">{{ v.payment_days }} j payés</div>
              </div>
            </div>
          </div>
          <div *ngIf="!data.vehicle_performance?.length" class="text-center text-muted py-4 small">
            Aucune donnée ce mois
          </div>
        </div>
      </div>
    </div>

  </ng-container>
</div>
  `
})
export class TaxiDashboardComponent implements OnInit {
  loading = false;
  data: any = null;
  period = '';

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.data = null;
    this.apiService.get<any>('taxi/dashboard').subscribe({
      next: (r) => {
        if (r.success) { this.data = r.data; this.period = r.data?.period || ''; }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  fmt(v: number | null | undefined): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0 }).format(v || 0) + ' GNF';
  }

  fleetActiveRate(): number {
    const total = this.data?.fleet?.total || 0;
    const active = this.data?.fleet?.active || 0;
    return total > 0 ? Math.round(active / total * 100) : 0;
  }

  monthlyTotal(): number {
    return (this.data?.monthly_revenue || []).reduce((s: number, m: any) => s + parseFloat(m.collected || 0), 0);
  }

  barHeight(val: number): number {
    const max = Math.max(...(this.data?.monthly_revenue || []).map((m: any) => parseFloat(m.collected || 0)), 1);
    return Math.max(4, Math.round(val / max * 74));
  }

  vehicleBarWidth(val: number): number {
    const max = Math.max(...(this.data?.vehicle_performance || []).map((v: any) => parseFloat(v.monthly_collected || 0)), 1);
    return Math.max(4, Math.round(val / max * 100));
  }

  dotColor(urgency: string): string {
    const m: any = { expired: '#EF4444', danger: '#EF4444', warning: '#F59E0B', info: '#3B82F6' };
    return m[urgency] || '#9CA3AF';
  }

  docFieldLabel(field: string): string {
    const m: any = {
      insurance_expiry: 'Assurance',
      technical_inspection_expiry: 'Visite tech.',
      circulation_permit_expiry: 'Permis circ.'
    };
    return m[field] || field;
  }

  avatarBg(i: number): string {
    const colors = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];
    return colors[i % colors.length];
  }
}
