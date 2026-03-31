import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-daily-payments',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './daily-payments.component.html'
})
export class DailyPaymentsComponent implements OnInit {
  payments: any[] = [];
  assignments: any[] = [];
  drivers: any[] = [];
  taxis: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  currentPage = 1; totalPages = 1; totalItems = 0; itemsPerPage = 15;
  showFormModal = false; editMode = false; submitted = false;
  paymentForm: FormGroup;
  selectedItem: any = null;
  deleteModalOpen = false; itemToDelete: any = null;
  Math = Math;

  // Statistics
  statistics: any = null;
  loadingStats = false;

  // Filters
  filterForm: FormGroup;

  constructor(private fb: FormBuilder, private apiService: ApiService, private cdr: ChangeDetectorRef) {
    this.paymentForm = this.fb.group({
      taxi_assignment_id: [null, Validators.required],
      payment_date: [this.getTodayDate(), Validators.required],
      expected_amount: [0, [Validators.required, Validators.min(0)]],
      paid_amount: [0, [Validators.required, Validators.min(0)]],
      status: ['UNPAID'],
      notes: ['']
    });

    this.filterForm = this.fb.group({
      driver_id: [''],
      taxi_id: [''],
      status: [''],
      date_from: [this.getMonthStartDate()],
      date_to: [this.getTodayDate()]
    });
  }

  ngOnInit(): void {
    this.loadData();
    this.loadAssignments();
    this.loadDrivers();
    this.loadTaxis();
    this.loadStatistics();
  }

  getTodayDate(): string {
    return new Date().toISOString().substring(0, 10);
  }

  getMonthStartDate(): string {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().substring(0, 10);
  }

  loadAssignments(): void {
    this.apiService.get<any>('taxi-assignments?per_page=200').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.assignments = r.data.data || r.data || [];
        }
      }
    });
  }

  loadDrivers(): void {
    this.apiService.get<any>('drivers?per_page=200').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.drivers = r.data.data || r.data || [];
        }
      }
    });
  }

  loadTaxis(): void {
    this.apiService.get<any>('taxis-public?per_page=200').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.taxis = r.data.data || r.data || [];
        }
      }
    });
  }

  loadData(): void {
    this.loading = true; this.error = null;
    let url = `daily-payments?page=${this.currentPage}&tenant_id=1`;
    
    const filters = this.filterForm.value;
    if (filters.driver_id) url += `&driver_id=${filters.driver_id}`;
    if (filters.taxi_id) url += `&taxi_id=${filters.taxi_id}`;
    if (filters.status) url += `&status=${filters.status}`;
    if (filters.date_from) url += `&date_from=${filters.date_from}`;
    if (filters.date_to) url += `&date_to=${filters.date_to}`;

    this.apiService.get<any>(url).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          const p = r.data;
          this.payments = p.data || [];
          this.currentPage = p.current_page || 1;
          this.totalPages = p.last_page || 1;
          this.totalItems = p.total || 0;
          this.itemsPerPage = p.per_page || 15;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Erreur lors du chargement';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadStatistics(): void {
    this.loadingStats = true;
    const filters = this.filterForm.value;
    let url = `daily-payments/statistics?tenant_id=1`;
    if (filters.date_from) url += `&date_from=${filters.date_from}`;
    if (filters.date_to) url += `&date_to=${filters.date_to}`;

    this.apiService.get<any>(url).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.statistics = r.data;
        }
        this.loadingStats = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingStats = false;
      }
    });
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadData();
    this.loadStatistics();
  }

  resetFilters(): void {
    this.filterForm.reset({
      driver_id: '',
      taxi_id: '',
      status: '',
      date_from: this.getMonthStartDate(),
      date_to: this.getTodayDate()
    });
    this.applyFilters();
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadData();
  }

  openCreateModal(): void {
    this.editMode = false;
    this.submitted = false;
    this.selectedItem = null;
    this.paymentForm.reset({
      taxi_assignment_id: null,
      payment_date: this.getTodayDate(),
      expected_amount: 0,
      paid_amount: 0,
      status: 'UNPAID',
      notes: ''
    });
    this.showFormModal = true;
  }

  onAssignmentChange(event: any): void {
    const assignmentId = event?.target?.value || event;
    if (!assignmentId) {
      this.paymentForm.patchValue({ expected_amount: 0 });
      return;
    }
    
    const assignment = this.assignments.find(a => a.id == assignmentId);
    if (assignment && assignment.driver) {
      const dailyRate = assignment.driver.daily_rate || 0;
      this.paymentForm.patchValue({ expected_amount: dailyRate });
    } else if (assignment && assignment.driver_id) {
      const driver = this.drivers.find(d => d.id === assignment.driver_id);
      if (driver) {
        this.paymentForm.patchValue({ expected_amount: driver.daily_rate || 0 });
      }
    }
  }

  openEditModal(item: any): void {
    this.editMode = true;
    this.submitted = false;
    this.selectedItem = item;
    this.paymentForm.patchValue({
      taxi_assignment_id: item.taxi_assignment_id,
      payment_date: item.payment_date ? item.payment_date.substring(0, 10) : '',
      expected_amount: item.expected_amount,
      paid_amount: item.paid_amount,
      status: item.status,
      notes: item.notes || ''
    });
    this.showFormModal = true;
  }

  save(): void {
    this.submitted = true;
    if (this.paymentForm.invalid) return;

    const data = { ...this.paymentForm.value, tenant_id: 1 };
    const obs = this.editMode && this.selectedItem
      ? this.apiService.put<any>(`daily-payments/${this.selectedItem.id}`, data)
      : this.apiService.post<any>('daily-payments', data);

    obs.subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = this.editMode ? 'Versement mis à jour' : 'Versement enregistré';
          this.showFormModal = false;
          this.loadData();
          this.loadStatistics();
          this.clearMessages();
        }
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur lors de l\'enregistrement';
      }
    });
  }

  confirmDelete(item: any): void {
    this.itemToDelete = item;
    this.deleteModalOpen = true;
  }

  deleteItem(): void {
    if (!this.itemToDelete) return;
    this.apiService.delete<any>(`daily-payments/${this.itemToDelete.id}`).subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = 'Versement supprimé';
          this.deleteModalOpen = false;
          this.itemToDelete = null;
          this.loadData();
          this.loadStatistics();
          this.clearMessages();
        }
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur';
        this.deleteModalOpen = false;
      }
    });
  }

  getAssignmentLabel(id: number): string {
    const a = this.assignments.find(x => x.id === id);
    if (!a) return `ID: ${id}`;
    return `${a.driver?.name || 'Chauffeur'} - ${a.taxi?.plate_number || 'Taxi'}`;
  }

  getDriverName(id: number): string {
    const d = this.drivers.find(x => x.id === id);
    return d ? d.name : `ID: ${id}`;
  }

  getTaxiPlate(id: number): string {
    const t = this.taxis.find(x => x.id === id);
    return t ? t.plate_number : `ID: ${id}`;
  }

  getStatusClass(status: string): string {
    const m: {[k: string]: string} = {
      'PAID': 'success',
      'PARTIAL': 'warning',
      'UNPAID': 'danger',
      'EXCUSED': 'info'
    };
    return m[status] || 'secondary';
  }

  getStatusLabel(status: string): string {
    const m: {[k: string]: string} = {
      'PAID': 'Payé',
      'PARTIAL': 'Partiel',
      'UNPAID': 'Non payé',
      'EXCUSED': 'Excusé'
    };
    return m[status] || status;
  }

  getPages(): number[] {
    const p: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) p.push(i);
    return p;
  }

  private clearMessages(): void {
    setTimeout(() => {
      this.successMessage = null;
      this.error = null;
      this.cdr.detectChanges();
    }, 3000);
  }
}
