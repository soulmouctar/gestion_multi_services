import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CardModule, BadgeModule, SpinnerModule, ButtonModule, FormModule } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-rental-tenants',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconDirective, CardModule, BadgeModule, SpinnerModule, ButtonModule, FormModule],
  template: `
<div class="p-3 p-md-4">

  <!-- Header -->
  <div class="rounded-4 text-white mb-4 px-4 py-4"
    style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:16px">
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <span style="font-size:1.2rem">👥</span>
          <span class="small fw-semibold opacity-75 text-uppercase" style="letter-spacing:.06em">Module Location</span>
        </div>
        <h4 class="fw-bold mb-1" style="font-size:1.5rem">Registre des Locataires</h4>
        <p class="mb-0 opacity-60 small">
          <span class="badge rounded-pill" style="background:rgba(255,255,255,.15);color:#fff;font-size:.75rem">
            {{ tenants.length }} locataire(s)
          </span>
        </p>
      </div>
    </div>
  </div>

  <!-- Filtres -->
  <div class="bg-white shadow-sm rounded-4 p-3 mb-3">
    <div class="row g-2 align-items-end">
      <div class="col-md-5">
        <label class="form-label small fw-semibold text-muted mb-1">Recherche</label>
        <div class="input-group">
          <span class="input-group-text" style="border-radius:8px 0 0 8px;background:#f8fafc">
            <svg cIcon name="cilMagnifyingGlass" size="sm"></svg>
          </span>
          <input type="text" class="form-control" style="border-radius:0 8px 8px 0"
            placeholder="Nom, téléphone ou email..."
            [(ngModel)]="search" (ngModelChange)="applyFilters()">
        </div>
      </div>
      <div class="col-md-3">
        <label class="form-label small fw-semibold text-muted mb-1">Statut</label>
        <select class="form-select" style="border-radius:8px"
          [(ngModel)]="statusFilter" (ngModelChange)="applyFilters()">
          <option value="">Tous les statuts</option>
          <option value="active">Avec bail actif</option>
          <option value="inactive">Sans bail actif</option>
        </select>
      </div>
      <div class="col-auto">
        <button class="btn btn-outline-secondary" style="border-radius:8px;font-size:.85rem" (click)="resetFilters()">
          Réinitialiser
        </button>
      </div>
    </div>
  </div>

  <!-- Loading -->
  <div *ngIf="loading" class="text-center py-5">
    <c-spinner color="primary" size="sm"></c-spinner>
    <div class="mt-2 text-muted small">Chargement des locataires...</div>
  </div>

  <!-- Table Card -->
  <div *ngIf="!loading" class="bg-white shadow-sm rounded-4 overflow-hidden">
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead style="background:#f8fafc">
          <tr>
            <th class="ps-4 py-3 text-muted fw-semibold" style="font-size:.78rem;letter-spacing:.05em;text-transform:uppercase">Locataire</th>
            <th class="py-3 text-muted fw-semibold" style="font-size:.78rem;letter-spacing:.05em;text-transform:uppercase">Téléphone</th>
            <th class="py-3 text-muted fw-semibold" style="font-size:.78rem;letter-spacing:.05em;text-transform:uppercase">Email</th>
            <th class="py-3 text-muted fw-semibold text-center" style="font-size:.78rem;letter-spacing:.05em;text-transform:uppercase">Contrats</th>
            <th class="py-3 text-muted fw-semibold text-center" style="font-size:.78rem;letter-spacing:.05em;text-transform:uppercase">Actifs</th>
            <th class="py-3 text-muted fw-semibold" style="font-size:.78rem;letter-spacing:.05em;text-transform:uppercase">Loyer/mois</th>
            <th class="py-3 text-muted fw-semibold" style="font-size:.78rem;letter-spacing:.05em;text-transform:uppercase">Dépôts</th>
            <th class="py-3 text-muted fw-semibold" style="font-size:.78rem;letter-spacing:.05em;text-transform:uppercase">Depuis</th>
            <th class="py-3 text-muted fw-semibold text-center pe-4" style="font-size:.78rem;letter-spacing:.05em;text-transform:uppercase">Statut</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let t of tenants">
            <td class="ps-4 py-3">
              <div class="d-flex align-items-center gap-2">
                <div style="width:36px;height:36px;border-radius:50%;background:#EEF2FF;color:#6366F1;
                  display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.82rem;flex-shrink:0">
                  {{ (t.renter_name || '?').charAt(0).toUpperCase() }}
                </div>
                <span class="fw-semibold" style="font-size:.9rem">{{ t.renter_name }}</span>
              </div>
            </td>
            <td class="py-3">
              <span class="text-muted" style="font-size:.85rem">{{ t.renter_phone || '—' }}</span>
            </td>
            <td class="py-3">
              <span class="text-muted" style="font-size:.82rem">{{ t.renter_email || '—' }}</span>
            </td>
            <td class="py-3 text-center">
              <span class="badge rounded-pill"
                style="background:#F3F4F6;color:#374151;font-size:.78rem;font-weight:700;padding:4px 10px">
                {{ t.total_leases }}
              </span>
            </td>
            <td class="py-3 text-center">
              <span class="badge rounded-pill fw-bold"
                [style.background]="t.active_leases > 0 ? '#ECFDF5' : '#F3F4F6'"
                [style.color]="t.active_leases > 0 ? '#10B981' : '#6B7280'"
                style="font-size:.78rem;padding:4px 10px">
                {{ t.active_leases }}
              </span>
            </td>
            <td class="py-3">
              <span class="fw-semibold" style="color:#10B981;font-size:.88rem">{{ fmt(t.current_monthly_rent) }}</span>
            </td>
            <td class="py-3">
              <span style="color:#0EA5E9;font-size:.88rem">{{ fmt(t.total_deposits) }}</span>
            </td>
            <td class="py-3">
              <span class="text-muted" style="font-size:.82rem">{{ t.latest_start | date:'dd/MM/yyyy' }}</span>
            </td>
            <td class="py-3 text-center pe-4">
              <span class="badge rounded-pill"
                [style.background]="t.active_leases > 0 ? '#ECFDF5' : '#F3F4F6'"
                [style.color]="t.active_leases > 0 ? '#10B981' : '#6B7280'"
                style="font-size:.75rem;font-weight:600;padding:5px 12px">
                {{ t.active_leases > 0 ? 'Actif' : 'Inactif' }}
              </span>
            </td>
          </tr>
          <tr *ngIf="tenants.length === 0">
            <td colspan="9" class="text-center py-5">
              <div style="font-size:2rem" class="mb-2">👥</div>
              <div class="text-muted fw-semibold">Aucun locataire trouvé</div>
              <div class="text-muted small mt-1">Modifiez vos critères de recherche ou ajoutez des locataires via les baux.</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

</div>
  `
})
export class RentalTenantsComponent implements OnInit {
  tenants: any[] = [];
  loading = false;
  search = '';
  statusFilter = '';

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    const params: any = {};
    if (this.search)       params.search = this.search;
    if (this.statusFilter) params.status = this.statusFilter;

    this.apiService.get<any>('rental/tenants', { params }).subscribe({
      next: (r) => {
        this.tenants = r.success ? (r.data || []) : [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  applyFilters(): void { this.load(); }

  resetFilters(): void {
    this.search = '';
    this.statusFilter = '';
    this.load();
  }

  fmt(v: number, currency = 'GNF'): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0 }).format(v || 0) + ' ' + currency;
  }
}
