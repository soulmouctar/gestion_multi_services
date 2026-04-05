import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule, ProgressModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-daily-payments',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, ProgressModule
  ],
  templateUrl: './daily-payments.component.html'
})
export class DailyPaymentsComponent implements OnInit {

  payments: any[]    = [];
  assignments: any[] = [];
  drivers: any[]     = [];
  taxis: any[]       = [];

  loading = false;
  loadingStats = false;

  currentPage = 1; totalPages = 1; totalItems = 0;
  showFormModal = false; editMode = false; submitted = false;
  paymentForm: FormGroup;
  filterForm: FormGroup;
  selectedItem: any = null;

  statistics: any = null;
  activeStatsTab = 'summary'; // 'summary' | 'drivers' | 'daily'

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {
    this.paymentForm = this.fb.group({
      taxi_assignment_id: [null, Validators.required],
      payment_date:       [this.today(), Validators.required],
      expected_amount:    [0,    [Validators.required, Validators.min(0)]],
      paid_amount:        [0,    [Validators.required, Validators.min(0)]],
      status:             [''],
      notes:              ['']
    });

    this.filterForm = this.fb.group({
      driver_id: [''],
      taxi_id:   [''],
      status:    [''],
      date_from: [this.monthStart()],
      date_to:   [this.today()]
    });
  }

  ngOnInit(): void {
    this.loadAssignments();
    this.loadDrivers();
    this.loadTaxis();
    this.loadData();
    this.loadStatistics();
  }

  // ===== LOAD HELPERS =====

  loadAssignments(): void {
    this.apiService.get<any>('taxi-assignments?per_page=200').subscribe({
      next: (r) => { this.assignments = r.success ? (r.data?.data || r.data || []) : []; }
    });
  }

  loadDrivers(): void {
    this.apiService.get<any>('drivers?per_page=200').subscribe({
      next: (r) => { this.drivers = r.success ? (r.data?.data || r.data || []) : []; }
    });
  }

  loadTaxis(): void {
    this.apiService.get<any>('taxis?per_page=200').subscribe({
      next: (r) => { this.taxis = r.success ? (r.data?.data || r.data || []) : []; }
    });
  }

  // ===== DATA =====

  loadData(): void {
    this.loading = true;
    const f = this.filterForm.value;
    let url = `daily-payments?page=${this.currentPage}&per_page=15`;
    if (f.driver_id) url += `&driver_id=${f.driver_id}`;
    if (f.taxi_id)   url += `&taxi_id=${f.taxi_id}`;
    if (f.status)    url += `&status=${f.status}`;
    if (f.date_from) url += `&date_from=${f.date_from}`;
    if (f.date_to)   url += `&date_to=${f.date_to}`;

    this.apiService.get<any>(url).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.payments   = r.data.data || [];
          this.currentPage = r.data.current_page || 1;
          this.totalPages  = r.data.last_page || 1;
          this.totalItems  = r.data.total || 0;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  loadStatistics(): void {
    this.loadingStats = true;
    const f = this.filterForm.value;
    let url = `daily-payments/statistics?date_from=${f.date_from || this.monthStart()}&date_to=${f.date_to || this.today()}`;
    if (f.driver_id) url += `&driver_id=${f.driver_id}`;
    if (f.taxi_id)   url += `&taxi_id=${f.taxi_id}`;

    this.apiService.get<any>(url).subscribe({
      next: (r) => {
        if (r.success && r.data) this.statistics = r.data;
        this.loadingStats = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingStats = false; }
    });
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadData();
    this.loadStatistics();
  }

  resetFilters(): void {
    this.filterForm.reset({ driver_id: '', taxi_id: '', status: '', date_from: this.monthStart(), date_to: this.today() });
    this.applyFilters();
  }

  onPageChange(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
    this.loadData();
  }

  // ===== CRUD =====

  openCreateModal(): void {
    this.editMode  = false;
    this.submitted = false;
    this.selectedItem = null;
    this.paymentForm.reset({ taxi_assignment_id: null, payment_date: this.today(), expected_amount: 0, paid_amount: 0, status: '', notes: '' });
    this.showFormModal = true;
  }

  openEditModal(item: any): void {
    this.editMode  = true;
    this.submitted = false;
    this.selectedItem = item;
    this.paymentForm.patchValue({
      taxi_assignment_id: item.taxi_assignment_id,
      payment_date:       item.payment_date?.substring(0, 10) || '',
      expected_amount:    item.expected_amount,
      paid_amount:        item.paid_amount,
      status:             item.status,
      notes:              item.notes || ''
    });
    this.showFormModal = true;
  }

  onAssignmentChange(event: any): void {
    const id = event?.target?.value;
    if (!id) { this.paymentForm.patchValue({ expected_amount: 0 }); return; }
    const a = this.assignments.find(x => x.id == id);
    const rate = a?.driver?.daily_rate || this.drivers.find(d => d.id === a?.driver_id)?.daily_rate || 0;
    this.paymentForm.patchValue({ expected_amount: rate });
  }

  save(): void {
    this.submitted = true;
    if (this.paymentForm.invalid) return;

    const data = this.paymentForm.value;
    const obs = this.editMode && this.selectedItem
      ? this.apiService.put<any>(`daily-payments/${this.selectedItem.id}`, data)
      : this.apiService.post<any>('daily-payments', data);

    obs.subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ icon: 'success', title: this.editMode ? 'Versement modifié' : 'Versement enregistré', timer: 1800, showConfirmButton: false });
          this.showFormModal = false;
          this.loadData();
          this.loadStatistics();
        }
      },
      error: (err) => Swal.fire({ icon: 'error', title: 'Erreur', text: err?.error?.message || 'Erreur' })
    });
  }

  deleteItem(item: any): void {
    Swal.fire({
      title: 'Supprimer ce versement ?',
      text: `${item.payment_date?.substring(0, 10)} — ${this.fmt(item.paid_amount)} GNF`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#d33', cancelButtonColor: '#6c757d',
      confirmButtonText: 'Supprimer', cancelButtonText: 'Annuler'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.apiService.delete<any>(`daily-payments/${item.id}`).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', timer: 1500, showConfirmButton: false, title: 'Supprimé' });
          this.loadData();
          this.loadStatistics();
        },
        error: () => Swal.fire({ icon: 'error', title: 'Impossible de supprimer' })
      });
    });
  }

  // ===== HELPERS =====

  getAssignmentLabel(id: number): string {
    const a = this.assignments.find(x => x.id === id);
    if (!a) return `#${id}`;
    return `${a.driver?.name || '?'} — ${a.taxi?.plate_number || '?'}`;
  }

  getStatusColor(s: string): string {
    return { PAID: 'success', PARTIAL: 'warning', UNPAID: 'danger', EXCUSED: 'info' }[s] || 'secondary';
  }

  getStatusLabel(s: string): string {
    return { PAID: 'Payé', PARTIAL: 'Partiel', UNPAID: 'Non payé', EXCUSED: 'Excusé' }[s] || s;
  }

  getCollectionRate(): number {
    const s = this.statistics?.summary;
    if (!s?.total_expected || s.total_expected <= 0) return 0;
    return Math.min(100, Math.round((s.total_paid / s.total_expected) * 100));
  }

  getDriverRate(d: any): number {
    if (!d.total_expected || d.total_expected <= 0) return 0;
    return Math.min(100, Math.round((d.total_paid / d.total_expected) * 100));
  }

  fmt(v: number): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0 }).format(v || 0);
  }

  getPages(): number[] { return Array.from({ length: this.totalPages }, (_, i) => i + 1); }

  private today(): string      { return new Date().toISOString().split('T')[0]; }
  private monthStart(): string { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; }
}
