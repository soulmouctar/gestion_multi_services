import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BadgeModule, SpinnerModule } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-rental-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, IconDirective, BadgeModule, SpinnerModule],
  styles: [`
    .dash-header {
      background: linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%);
      border-radius: 16px;
      padding: 28px 32px;
      margin-bottom: 28px;
      position: relative;
      overflow: hidden;
    }
    .dash-header::before {
      content: '';
      position: absolute;
      top: -50px; right: -30px;
      width: 220px; height: 220px;
      background: rgba(255,255,255,.04);
      border-radius: 50%;
    }
    .kpi-card {
      border-radius: 14px;
      padding: 22px 20px;
      border: none;
      background: #fff;
      transition: transform .2s, box-shadow .2s;
    }
    .kpi-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,.1) !important; }
    .kpi-icon {
      width: 50px; height: 50px;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px;
    }
    .kpi-value { font-size: 2rem; font-weight: 800; line-height: 1; }
    .kpi-label { font-size: .72rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    .revenue-card {
      border-radius: 14px;
      padding: 24px;
      border: none;
      color: #fff;
      transition: transform .2s;
    }
    .revenue-card:hover { transform: translateY(-2px); }
    .section-title {
      font-size: .7rem;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: #6c757d;
      margin-bottom: 14px;
    }
    .bar-track { height: 6px; border-radius: 3px; background: #F3F4F6; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 3px; transition: width .6s ease; }
    .ring-wrap {
      position: relative;
      width: 80px; height: 80px;
    }
    .ring-wrap svg { transform: rotate(-90deg); }
    .ring-wrap .ring-value {
      position: absolute;
      inset: 0;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 1rem;
    }
    .urgency-row {
      padding: 12px 14px;
      border-radius: 10px;
      border-left: 3px solid;
      margin-bottom: 8px;
      background: #fff;
    }
    .building-row {
      padding: 12px 16px;
      border-radius: 10px;
      transition: background .15s;
    }
    .building-row:hover { background: #F9FAFB; }
    .late-row {
      padding: 10px 14px;
      border-radius: 10px;
      border-left: 3px solid #EF4444;
      background: #FFF5F5;
      margin-bottom: 6px;
    }
  `],
  template: `
<div class="p-3 p-md-4">

  <!-- Loading -->
  <div *ngIf="loading" class="text-center py-5">
    <c-spinner color="primary" size="sm"></c-spinner>
    <div class="mt-2 text-muted small">Chargement du tableau de bord...</div>
  </div>

  <ng-container *ngIf="!loading && data">

    <!-- ── Header ── -->
    <div class="dash-header text-white">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-3">
        <div>
          <div class="d-flex align-items-center gap-2 mb-1">
            <span style="font-size:1.4rem">🏠</span>
            <span class="small fw-semibold opacity-75">MODULE LOCATION IMMOBILIÈRE</span>
          </div>
          <h3 class="fw-bold mb-1" style="font-size:1.6rem">Tableau de Bord</h3>
          <p class="mb-0 opacity-60 small">Période : <strong class="text-white">{{ period }}</strong></p>
        </div>
        <div class="d-flex gap-4">
          <div class="text-center">
            <div class="fw-bold" style="font-size:1.5rem">{{ data.occupancy?.total_units }}</div>
            <div class="opacity-60" style="font-size:.72rem">Unités</div>
          </div>
          <div style="width:1px;background:rgba(255,255,255,.15)"></div>
          <div class="text-center">
            <div class="fw-bold" style="font-size:1.5rem">{{ data.leases?.active }}</div>
            <div class="opacity-60" style="font-size:.72rem">Baux actifs</div>
          </div>
          <div style="width:1px;background:rgba(255,255,255,.15)"></div>
          <div class="text-center">
            <div class="fw-bold" style="font-size:1.5rem;color:#86EFAC">{{ data.occupancy?.occupancy_rate }}%</div>
            <div class="opacity-60" style="font-size:.72rem">Occupation</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── KPI Row ── -->
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-3">
        <div class="kpi-card shadow-sm">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <div class="kpi-icon" style="background:#EEF2FF;color:#6366F1">🏢</div>
            <span class="badge rounded-pill" style="background:#EEF2FF;color:#6366F1;font-size:.68rem">Total</span>
          </div>
          <div class="kpi-value" style="color:#1e1e2d">{{ data.occupancy?.total_units }}</div>
          <div class="kpi-label mt-1" style="color:#6366F1">Unités au total</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card shadow-sm">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <div class="kpi-icon" style="background:#ECFDF5;color:#10B981">🔑</div>
            <span class="badge rounded-pill" style="background:#ECFDF5;color:#10B981;font-size:.68rem">Louées</span>
          </div>
          <div class="kpi-value" style="color:#10B981">{{ data.occupancy?.occupied }}</div>
          <div class="kpi-label mt-1" style="color:#10B981">Occupées</div>
          <div class="bar-track mt-2">
            <div class="bar-fill" style="background:#10B981" [style.width]="data.occupancy?.occupancy_rate + '%'"></div>
          </div>
          <div class="text-end mt-1" style="font-size:.7rem;color:#10B981">{{ data.occupancy?.occupancy_rate }}%</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card shadow-sm">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <div class="kpi-icon" style="background:#FFFBEB;color:#F59E0B">🔓</div>
            <span class="badge rounded-pill" style="background:#FFFBEB;color:#F59E0B;font-size:.68rem">Libres</span>
          </div>
          <div class="kpi-value" style="color:#F59E0B">{{ data.occupancy?.free }}</div>
          <div class="kpi-label mt-1" style="color:#F59E0B">Unités libres</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="kpi-card shadow-sm">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <div class="kpi-icon" style="background:#F0F9FF;color:#0EA5E9">📄</div>
            <span class="badge rounded-pill" style="background:#F0F9FF;color:#0EA5E9;font-size:.68rem">Actifs</span>
          </div>
          <div class="kpi-value" style="color:#0EA5E9">{{ data.leases?.active }}</div>
          <div class="kpi-label mt-1" style="color:#0EA5E9">Baux actifs</div>
        </div>
      </div>
    </div>

    <!-- ── Revenus Row ── -->
    <div class="row g-3 mb-4">
      <!-- Revenus mois -->
      <div class="col-md-4">
        <div class="revenue-card shadow-sm" style="background:linear-gradient(135deg,#10B981,#059669)">
          <div class="d-flex justify-content-between align-items-start mb-3">
            <div>
              <div class="small fw-semibold opacity-75 mb-1">REVENUS CE MOIS</div>
              <div style="font-size:1.7rem;font-weight:800;line-height:1">{{ fmt(data.revenue?.collected_month) }}</div>
            </div>
            <div style="background:rgba(255,255,255,.15);border-radius:12px;padding:10px;font-size:1.2rem">💵</div>
          </div>
          <div class="small opacity-75 mb-2">Attendu : <strong class="text-white">{{ fmt(data.revenue?.expected_monthly) }}</strong></div>
          <div class="bar-track" style="background:rgba(255,255,255,.25)">
            <div class="bar-fill" style="background:#fff" [style.width]="data.revenue?.collection_rate + '%'"></div>
          </div>
          <div class="mt-1 small opacity-90">{{ data.revenue?.collection_rate }}% collecté</div>
        </div>
      </div>

      <!-- Taux occupation visuel -->
      <div class="col-md-4">
        <div class="shadow-sm rounded-4 bg-white p-4 h-100 d-flex flex-column justify-content-center">
          <div class="section-title text-center mb-3">Taux d'Occupation</div>
          <div class="d-flex align-items-center justify-content-center gap-4">
            <!-- Ring -->
            <div class="ring-wrap">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="32" fill="none" stroke="#F3F4F6" stroke-width="10"/>
                <circle cx="40" cy="40" r="32" fill="none" stroke="#10B981" stroke-width="10"
                  [attr.stroke-dasharray]="ringDash(data.occupancy?.occupancy_rate) + ' 201'"
                  stroke-linecap="round"/>
              </svg>
              <div class="ring-value" style="color:#10B981">{{ data.occupancy?.occupancy_rate }}%</div>
            </div>
            <!-- Legend -->
            <div>
              <div class="d-flex align-items-center gap-2 mb-2">
                <div style="width:10px;height:10px;border-radius:2px;background:#10B981"></div>
                <span class="small text-muted">Occupé ({{ data.occupancy?.occupied }})</span>
              </div>
              <div class="d-flex align-items-center gap-2">
                <div style="width:10px;height:10px;border-radius:2px;background:#F3F4F6"></div>
                <span class="small text-muted">Libre ({{ data.occupancy?.free }})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Dépôts de garantie -->
      <div class="col-md-4">
        <div class="revenue-card shadow-sm" style="background:linear-gradient(135deg,#6366F1,#8B5CF6)">
          <div class="d-flex justify-content-between align-items-start mb-3">
            <div>
              <div class="small fw-semibold opacity-75 mb-1">DÉPÔTS DE GARANTIE</div>
              <div style="font-size:1.7rem;font-weight:800;line-height:1">{{ fmt(data.revenue?.total_deposits) }}</div>
            </div>
            <div style="background:rgba(255,255,255,.15);border-radius:12px;padding:10px;font-size:1.2rem">🏦</div>
          </div>
          <div class="d-flex gap-3 small opacity-75 mt-2">
            <span>En attente : <strong class="text-white">{{ data.leases?.pending }}</strong></span>
            <span>Expirés : <strong class="text-white">{{ data.leases?.expired_count }}</strong></span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Baux expirant bientôt ── -->
    <div class="row g-3 mb-4" *ngIf="data.expiring_soon?.length > 0">
      <div class="col-12">
        <div class="shadow-sm rounded-4 bg-white p-4">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div class="section-title mb-0">⏳ Contrats expirant dans 90 jours</div>
            <span class="badge rounded-pill" style="background:#FEF3C7;color:#D97706;font-size:.78rem">
              {{ data.expiring_soon.length }} contrat(s)
            </span>
          </div>
          <div *ngFor="let l of data.expiring_soon" class="urgency-row"
            [style.border-color]="l.urgency === 'danger' ? '#EF4444' : l.urgency === 'warning' ? '#F59E0B' : '#3B82F6'">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <div class="fw-semibold" style="font-size:.9rem">{{ l.renter_name }}</div>
                <div class="text-muted" style="font-size:.75rem">📞 {{ l.renter_phone }} &bull; Expiration : {{ l.end_date | date:'dd/MM/yyyy' }}</div>
              </div>
              <div class="text-end">
                <div class="fw-bold" style="font-size:.9rem"
                  [style.color]="l.urgency === 'danger' ? '#EF4444' : l.urgency === 'warning' ? '#F59E0B' : '#3B82F6'">
                  {{ l.days_remaining }} jours
                </div>
                <div class="text-muted" style="font-size:.75rem">{{ fmt(l.monthly_rent, l.currency) }}/mois</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Paiements en retard ── -->
    <div class="row g-3 mb-4" *ngIf="data.late_payments?.length > 0">
      <div class="col-12">
        <div class="shadow-sm rounded-4 bg-white p-4">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div class="section-title mb-0">🔴 Paiements en retard / en attente</div>
            <span class="badge rounded-pill" style="background:#FEE2E2;color:#EF4444;font-size:.78rem">
              {{ data.late_payments.length }} paiement(s)
            </span>
          </div>
          <div *ngFor="let p of data.late_payments" class="late-row">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <div class="fw-semibold" style="font-size:.88rem">{{ p.renter_name }}</div>
                <div class="text-muted" style="font-size:.75rem">Période : {{ p.period_month }}</div>
              </div>
              <div class="text-end">
                <div class="fw-bold text-danger" style="font-size:.9rem">{{ fmt(p.amount, p.currency) }}</div>
                <span class="badge" style="font-size:.68rem"
                  [style.background]="p.status === 'LATE' ? '#FEE2E2' : '#FEF3C7'"
                  [style.color]="p.status === 'LATE' ? '#EF4444' : '#D97706'">
                  {{ p.status === 'LATE' ? 'En retard' : 'En attente' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Occupation par bâtiment ── -->
    <div class="row g-3" *ngIf="data.by_building?.length > 0">
      <div class="col-12">
        <div class="shadow-sm rounded-4 bg-white p-4">
          <div class="section-title">🏗️ Occupation par Bâtiment</div>
          <div *ngFor="let b of data.by_building; let i = index" class="building-row">
            <div class="d-flex align-items-center gap-3">
              <!-- Icon numéroté -->
              <div style="width:36px;height:36px;border-radius:10px;background:#EEF2FF;color:#6366F1;
                display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.85rem;flex-shrink:0">
                {{ i + 1 }}
              </div>
              <!-- Nom -->
              <div class="flex-fill" style="min-width:0">
                <div class="fw-semibold" style="font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                  {{ b.building_name }}
                </div>
                <div class="text-muted" style="font-size:.73rem">📍 {{ b.location_name }}</div>
              </div>
              <!-- Stats -->
              <div class="d-flex align-items-center gap-4 flex-shrink-0">
                <div class="text-center">
                  <div class="fw-bold" style="color:#10B981;font-size:.9rem">{{ b.occupied }}/{{ b.total_units }}</div>
                  <div class="text-muted" style="font-size:.68rem">Occupées</div>
                </div>
                <div style="width:80px">
                  <div class="d-flex justify-content-between mb-1">
                    <span style="font-size:.68rem;color:#6366F1;font-weight:700">{{ b.occupancy_rate }}%</span>
                  </div>
                  <div class="bar-track">
                    <div class="bar-fill" style="background:#6366F1" [style.width]="b.occupancy_rate + '%'"></div>
                  </div>
                </div>
                <div class="text-end">
                  <div class="fw-bold" style="color:#10B981;font-size:.88rem">{{ fmt(b.monthly_revenue) }}</div>
                  <div class="text-muted" style="font-size:.68rem">/mois</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </ng-container>
</div>
  `
})
export class RentalDashboardComponent implements OnInit {
  loading = false;
  data: any = null;
  period = '';

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.apiService.get<any>('rental/dashboard').subscribe({
      next: (r) => {
        if (r.success) { this.data = r.data; this.period = r.data.period; }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  fmt(v: number, currency = 'GNF'): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0 }).format(v || 0) + ' ' + currency;
  }

  ringDash(rate: number): number {
    return Math.round((rate || 0) / 100 * 201);
  }
}
