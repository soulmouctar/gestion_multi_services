import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CardModule, BadgeModule, SpinnerModule, ButtonModule, FormModule, ModalModule } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import Swal from 'sweetalert2';

interface DocStatus { label: string; color: string; icon: string; }

@Component({
  selector: 'app-taxi-documents',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IconDirective, CardModule, BadgeModule, SpinnerModule, ButtonModule, FormModule, ModalModule],
  styles: [`
    .doc-header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      border-radius: 16px; padding: 24px 28px; margin-bottom: 24px;
      position: relative; overflow: hidden;
    }
    .doc-header::before {
      content:''; position:absolute; top:-40px; right:-40px;
      width:180px; height:180px; background:rgba(255,255,255,.04); border-radius:50%;
    }
    .stat-pill {
      background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.15);
      border-radius: 10px; padding: 8px 16px; text-align:center;
    }
    .vehicle-card {
      background: #fff; border-radius: 14px; border: 1px solid #f0f0f0;
      padding: 20px; transition: all .2s; box-shadow: 0 2px 8px rgba(0,0,0,.04);
    }
    .vehicle-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.09); }
    .vehicle-card.has-expired { border-left: 4px solid #ef4444; }
    .vehicle-card.has-critical { border-left: 4px solid #f59e0b; }
    .vehicle-card.all-ok { border-left: 4px solid #10b981; }
    .doc-block {
      background: #f8fafc; border-radius: 10px; padding: 10px 12px;
      border: 1px solid #f0f0f0; flex: 1;
    }
    .doc-block.expired { background:#fef2f2; border-color:#fecaca; }
    .doc-block.danger  { background:#fef2f2; border-color:#fecaca; }
    .doc-block.warning { background:#fffbeb; border-color:#fde68a; }
    .doc-block.info    { background:#eff6ff; border-color:#bfdbfe; }
    .doc-block.ok      { background:#f0fdf4; border-color:#bbf7d0; }
    .doc-title { font-size:.62rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#9ca3af; margin-bottom:3px; }
    .doc-date  { font-size:.82rem; font-weight:700; }
    .legend-item { display:flex; align-items:center; gap:6px; font-size:.75rem; color:#6b7280; }
    .legend-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
  `],
  template: `
<div class="p-3 p-md-4">

  <!-- Header -->
  <div class="doc-header text-white mb-4">
    <div class="d-flex justify-content-between align-items-start flex-wrap gap-3">
      <div style="position:relative;z-index:1">
        <div class="d-flex align-items-center gap-2 mb-1">
          <span style="font-size:1.3rem">📄</span>
          <span style="font-size:.68rem;font-weight:700;letter-spacing:.1em;opacity:.7">GESTION DOCUMENTAIRE</span>
        </div>
        <h3 class="fw-bold mb-1" style="font-size:1.4rem">Documents &amp; Assurances</h3>
        <p class="mb-0 opacity-60" style="font-size:.82rem">Suivi des validités pour toute la flotte</p>
      </div>
      <div class="d-flex gap-2" style="position:relative;z-index:1">
        <div class="stat-pill text-white">
          <div class="fw-bold" style="font-size:1.3rem;color:#f87171">{{ summary.expired }}</div>
          <div style="font-size:.65rem;opacity:.8">Expiré(s)</div>
        </div>
        <div class="stat-pill text-white">
          <div class="fw-bold" style="font-size:1.3rem;color:#fbbf24">{{ (summary.danger || 0) + (summary.warning || 0) }}</div>
          <div style="font-size:.65rem;opacity:.8">Critique(s)</div>
        </div>
        <div class="stat-pill text-white">
          <div class="fw-bold" style="font-size:1.3rem;color:#34d399">{{ summary.ok }}</div>
          <div style="font-size:.65rem;opacity:.8">OK</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Légende -->
  <div class="d-flex flex-wrap gap-3 mb-4 p-3 rounded-3" style="background:#fff;border:1px solid #f0f0f0">
    <div class="legend-item"><div class="legend-dot" style="background:#ef4444"></div>Expiré</div>
    <div class="legend-item"><div class="legend-dot" style="background:#ef4444;opacity:.7"></div>≤ 15 jours</div>
    <div class="legend-item"><div class="legend-dot" style="background:#f59e0b"></div>≤ 30 jours</div>
    <div class="legend-item"><div class="legend-dot" style="background:#3b82f6"></div>≤ 60 jours</div>
    <div class="legend-item"><div class="legend-dot" style="background:#10b981"></div>Valide (&gt; 60 j)</div>
    <div class="legend-item"><div class="legend-dot" style="background:#d1d5db"></div>Non renseigné</div>
  </div>

  <!-- Loading -->
  <div *ngIf="loading" class="text-center py-5">
    <c-spinner color="primary"></c-spinner>
    <div class="mt-2 text-muted small">Chargement...</div>
  </div>

  <!-- Empty -->
  <div *ngIf="!loading && vehicles.length === 0" class="text-center py-5 text-muted">
    <div style="font-size:3rem">📄</div>
    <p class="mt-2">Aucun véhicule enregistré.</p>
  </div>

  <!-- Cards -->
  <div class="row g-3" *ngIf="!loading && vehicles.length > 0">
    <div class="col-12 col-xl-6" *ngFor="let v of vehicles">
      <div class="vehicle-card"
        [class.has-expired]="hasExpired(v)"
        [class.has-critical]="!hasExpired(v) && hasCritical(v)"
        [class.all-ok]="!hasExpired(v) && !hasCritical(v)">

        <!-- Vehicle header -->
        <div class="d-flex justify-content-between align-items-start mb-3">
          <div class="d-flex align-items-center gap-3">
            <div class="rounded-3 d-flex align-items-center justify-content-center"
              style="width:44px;height:44px;font-size:1.3rem;flex-shrink:0"
              [style.background]="hasExpired(v) ? '#fef2f2' : hasCritical(v) ? '#fffbeb' : '#f0fdf4'">
              🚕
            </div>
            <div>
              <div class="fw-bold" style="font-size:1rem;color:#1a1a2e;letter-spacing:.03em">
                {{ v.plate_number }}
              </div>
              <div class="text-muted" style="font-size:.75rem">
                {{ v.brand || '' }} {{ v.vehicle_model || '' }}
                <span *ngIf="!v.brand && !v.vehicle_model">—</span>
                <span *ngIf="v.year" class="ms-1">· {{ v.year }}</span>
                <span *ngIf="v.color" class="ms-1">· {{ v.color }}</span>
              </div>
            </div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="badge rounded-pill px-3"
              [style.background]="v.status === 'ACTIVE' ? '#ECFDF5' : v.status === 'MAINTENANCE' ? '#FFFBEB' : '#F9FAFB'"
              [style.color]="v.status === 'ACTIVE' ? '#10B981' : v.status === 'MAINTENANCE' ? '#F59E0B' : '#6B7280'"
              style="font-size:.7rem;font-weight:700">
              {{ fleetLabel(v.status) }}
            </span>
            <button class="btn btn-sm rounded-3 d-flex align-items-center gap-1"
              style="background:#EEF2FF;color:#6366F1;border:none;font-size:.75rem;font-weight:600;padding:6px 12px"
              (click)="openEdit(v)">
              <svg cIcon name="cilPencil" size="sm"></svg> Modifier
            </button>
          </div>
        </div>

        <!-- Document blocks -->
        <div class="d-flex gap-2 flex-wrap">
          <!-- Assurance -->
          <div class="doc-block" [class]="'doc-block ' + v.insurance_expiry_status">
            <div class="doc-title">🛡️ Assurance</div>
            <div class="doc-date" [style.color]="docColor2(v.insurance_expiry_status)">
              {{ v.insurance_expiry ? (v.insurance_expiry | date:'dd/MM/yyyy') : '—' }}
            </div>
            <div class="mt-1">
              <span class="badge rounded-pill"
                [style.background]="docBg(v.insurance_expiry_status)"
                [style.color]="docColor2(v.insurance_expiry_status)"
                style="font-size:.6rem;font-weight:700">
                {{ docLabel(v.insurance_expiry_status) }}
              </span>
            </div>
          </div>
          <!-- Visite technique -->
          <div class="doc-block" [class]="'doc-block ' + v.technical_inspection_expiry_status">
            <div class="doc-title">🔧 Visite tech.</div>
            <div class="doc-date" [style.color]="docColor2(v.technical_inspection_expiry_status)">
              {{ v.technical_inspection_expiry ? (v.technical_inspection_expiry | date:'dd/MM/yyyy') : '—' }}
            </div>
            <div class="mt-1">
              <span class="badge rounded-pill"
                [style.background]="docBg(v.technical_inspection_expiry_status)"
                [style.color]="docColor2(v.technical_inspection_expiry_status)"
                style="font-size:.6rem;font-weight:700">
                {{ docLabel(v.technical_inspection_expiry_status) }}
              </span>
            </div>
          </div>
          <!-- Permis circulation -->
          <div class="doc-block" [class]="'doc-block ' + v.circulation_permit_expiry_status">
            <div class="doc-title">📋 Permis circ.</div>
            <div class="doc-date" [style.color]="docColor2(v.circulation_permit_expiry_status)">
              {{ v.circulation_permit_expiry ? (v.circulation_permit_expiry | date:'dd/MM/yyyy') : '—' }}
            </div>
            <div class="mt-1">
              <span class="badge rounded-pill"
                [style.background]="docBg(v.circulation_permit_expiry_status)"
                [style.color]="docColor2(v.circulation_permit_expiry_status)"
                style="font-size:.6rem;font-weight:700">
                {{ docLabel(v.circulation_permit_expiry_status) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Mileage & notes -->
        <div class="d-flex gap-3 mt-3 pt-3" style="border-top:1px solid #f0f0f0">
          <div *ngIf="v.mileage" class="text-muted" style="font-size:.75rem">
            🛣️ <strong>{{ v.mileage | number }}</strong> km
          </div>
          <div *ngIf="v.notes" class="text-muted text-truncate" style="font-size:.75rem;max-width:300px">
            📝 {{ v.notes }}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Modal mise à jour documents -->
<c-modal [visible]="showModal" (visibleChange)="showModal = $event" backdrop="static">
  <c-modal-header>
    <h5 cModalTitle class="fw-bold">📄 Documents — {{ selectedVehicle?.plate_number }}</h5>
    <button type="button" class="btn-close" (click)="showModal = false"></button>
  </c-modal-header>
  <c-modal-body *ngIf="form">
    <form [formGroup]="form">
      <div class="row g-3">
        <div class="col-12">
          <label class="form-label fw-semibold small">🛡️ Expiration assurance</label>
          <input type="date" class="form-control" formControlName="insurance_expiry" style="border-radius:8px">
        </div>
        <div class="col-12">
          <label class="form-label fw-semibold small">🔧 Expiration visite technique</label>
          <input type="date" class="form-control" formControlName="technical_inspection_expiry" style="border-radius:8px">
        </div>
        <div class="col-12">
          <label class="form-label fw-semibold small">📋 Expiration permis de circulation</label>
          <input type="date" class="form-control" formControlName="circulation_permit_expiry" style="border-radius:8px">
        </div>
        <div class="col-md-6">
          <label class="form-label fw-semibold small">Statut du véhicule</label>
          <select class="form-select" formControlName="status" style="border-radius:8px">
            <option value="ACTIVE">🟢 Actif</option>
            <option value="MAINTENANCE">🟡 En maintenance</option>
            <option value="INACTIVE">⚫ Inactif</option>
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label fw-semibold small">Kilométrage (km)</label>
          <input type="number" class="form-control" formControlName="mileage"
            placeholder="ex: 85000" style="border-radius:8px">
        </div>
        <div class="col-12">
          <label class="form-label fw-semibold small">Notes / Observations</label>
          <textarea class="form-control" formControlName="notes" rows="2"
            placeholder="Remarques sur l'état du véhicule..." style="border-radius:8px"></textarea>
        </div>
      </div>
    </form>
  </c-modal-body>
  <c-modal-footer>
    <button class="btn btn-secondary" variant="outline" (click)="showModal = false">Annuler</button>
    <button class="btn btn-primary" (click)="save()" [disabled]="saving"
      style="background:linear-gradient(135deg,#1a1a2e,#0f3460);border:none;border-radius:8px;font-weight:600">
      <span *ngIf="saving" class="spinner-border spinner-border-sm me-1"></span>
      Enregistrer
    </button>
  </c-modal-footer>
</c-modal>
  `
})
export class TaxiDocumentsComponent implements OnInit {
  vehicles: any[] = [];
  loading = false;
  saving = false;
  showModal = false;
  selectedVehicle: any = null;
  form!: FormGroup;
  summary = { expired: 0, danger: 0, warning: 0, info: 0, ok: 0, missing: 0 };

  constructor(private apiService: ApiService, private fb: FormBuilder, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.apiService.get<any>('taxi/documents').subscribe({
      next: (r) => {
        if (r.success) {
          this.vehicles = r.data.vehicles || [];
          this.summary  = r.data.summary  || this.summary;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  openEdit(v: any): void {
    this.selectedVehicle = v;
    this.form = this.fb.group({
      insurance_expiry:             [v.insurance_expiry || ''],
      technical_inspection_expiry:  [v.technical_inspection_expiry || ''],
      circulation_permit_expiry:    [v.circulation_permit_expiry || ''],
      status:                       [v.status || 'ACTIVE'],
      mileage:                      [v.mileage || null],
      notes:                        [v.notes || ''],
    });
    this.showModal = true;
  }

  save(): void {
    this.saving = true;
    this.apiService.put<any>(`taxis/${this.selectedVehicle.id}`, this.form.value).subscribe({
      next: (r) => {
        this.saving = false;
        if (r.success) {
          Swal.fire({ icon: 'success', title: 'Documents mis à jour', timer: 1500, showConfirmButton: false });
          this.showModal = false;
          this.load();
        } else {
          Swal.fire({ icon: 'error', title: 'Erreur', text: r.message || 'Erreur serveur' });
        }
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.saving = false;
        Swal.fire({ icon: 'error', title: 'Erreur', text: e?.error?.message || 'Erreur serveur' });
        this.cdr.detectChanges();
      }
    });
  }

  hasExpired(v: any): boolean {
    return ['insurance_expiry_status','technical_inspection_expiry_status','circulation_permit_expiry_status']
      .some(f => v[f] === 'expired');
  }
  hasCritical(v: any): boolean {
    return ['insurance_expiry_status','technical_inspection_expiry_status','circulation_permit_expiry_status']
      .some(f => v[f] === 'danger' || v[f] === 'warning');
  }

  docColor(status: string): string {
    const map: any = { expired: 'danger', danger: 'danger', warning: 'warning', info: 'info', ok: 'success', missing: 'secondary' };
    return map[status] || 'secondary';
  }
  docColor2(status: string): string {
    const map: any = { expired: '#ef4444', danger: '#ef4444', warning: '#d97706', info: '#3b82f6', ok: '#10b981', missing: '#9ca3af' };
    return map[status] || '#9ca3af';
  }
  docBg(status: string): string {
    const map: any = { expired: '#fef2f2', danger: '#fef2f2', warning: '#fffbeb', info: '#eff6ff', ok: '#f0fdf4', missing: '#f9fafb' };
    return map[status] || '#f9fafb';
  }
  docLabel(status: string): string {
    const map: any = { expired: 'EXPIRÉ', danger: '≤ 15 jours', warning: '≤ 30 jours', info: '≤ 60 jours', ok: 'Valide', missing: 'Non renseigné' };
    return map[status] || status;
  }
  docTextClass(status: string): string {
    const map: any = { expired: 'text-danger fw-bold', danger: 'text-danger', warning: 'text-warning', info: 'text-info', ok: 'text-success', missing: 'text-muted' };
    return map[status] || '';
  }
  fleetColor(status: string): string {
    const map: any = { ACTIVE: 'success', MAINTENANCE: 'warning', INACTIVE: 'secondary' };
    return map[status] || 'secondary';
  }
  fleetLabel(status: string): string {
    const map: any = { ACTIVE: 'Actif', MAINTENANCE: 'Maintenance', INACTIVE: 'Inactif' };
    return map[status] || status;
  }
}
