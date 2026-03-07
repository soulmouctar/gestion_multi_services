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
  selector: 'app-vehicle-expenses',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './vehicle-expenses.component.html'
})
export class VehicleExpensesComponent implements OnInit {
  expenses: any[] = [];
  taxis: any[] = [];
  drivers: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  currentPage = 1; totalPages = 1; totalItems = 0; itemsPerPage = 15;
  showFormModal = false; editMode = false; submitted = false;
  expenseForm: FormGroup;
  selectedItem: any = null;
  deleteModalOpen = false; itemToDelete: any = null;
  Math = Math;

  // Statistics
  statistics: any = null;
  loadingStats = false;

  // Filters
  filterForm: FormGroup;

  // Expense types
  expenseTypes = [
    { value: 'CARBURANT', label: 'Carburant' },
    { value: 'ENTRETIEN', label: 'Entretien' },
    { value: 'REPARATION', label: 'Réparation' },
    { value: 'ASSURANCE', label: 'Assurance' },
    { value: 'VISITE_TECHNIQUE', label: 'Visite technique' },
    { value: 'AMENDE', label: 'Amende' },
    { value: 'LAVAGE', label: 'Lavage' },
    { value: 'AUTRE', label: 'Autre' }
  ];

  constructor(private fb: FormBuilder, private apiService: ApiService, private cdr: ChangeDetectorRef) {
    this.expenseForm = this.fb.group({
      taxi_id: [null, Validators.required],
      driver_id: [null],
      expense_date: [this.getTodayDate(), Validators.required],
      expense_type: ['CARBURANT', Validators.required],
      amount: [0, [Validators.required, Validators.min(0)]],
      description: [''],
      receipt_number: [''],
      notes: ['']
    });

    this.filterForm = this.fb.group({
      taxi_id: [''],
      driver_id: [''],
      expense_type: [''],
      date_from: [''],
      date_to: ['']
    });
  }

  ngOnInit(): void {
    this.loadData();
    this.loadTaxis();
    this.loadDrivers();
    this.loadStatistics();
  }

  getTodayDate(): string {
    return new Date().toISOString().substring(0, 10);
  }

  getMonthStartDate(): string {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().substring(0, 10);
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

  loadDrivers(): void {
    this.apiService.get<any>('drivers?per_page=200').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.drivers = r.data.data || r.data || [];
        }
      }
    });
  }

  loadData(): void {
    this.loading = true; this.error = null;
    let url = `vehicle-expenses?page=${this.currentPage}&tenant_id=1`;
    
    const filters = this.filterForm.value;
    if (filters.taxi_id) url += `&taxi_id=${filters.taxi_id}`;
    if (filters.driver_id) url += `&driver_id=${filters.driver_id}`;
    if (filters.expense_type) url += `&expense_type=${filters.expense_type}`;
    if (filters.date_from) url += `&date_from=${filters.date_from}`;
    if (filters.date_to) url += `&date_to=${filters.date_to}`;

    this.apiService.get<any>(url).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          const p = r.data;
          this.expenses = p.data || [];
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
    let url = `vehicle-expenses/statistics?tenant_id=1`;
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
      taxi_id: '',
      driver_id: '',
      expense_type: '',
      date_from: '',
      date_to: ''
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
    this.expenseForm.reset({
      taxi_id: null,
      driver_id: null,
      expense_date: this.getTodayDate(),
      expense_type: 'CARBURANT',
      amount: 0,
      description: '',
      receipt_number: '',
      notes: ''
    });
    this.showFormModal = true;
  }

  openEditModal(item: any): void {
    this.editMode = true;
    this.submitted = false;
    this.selectedItem = item;
    this.expenseForm.patchValue({
      taxi_id: item.taxi_id,
      driver_id: item.driver_id,
      expense_date: item.expense_date ? item.expense_date.substring(0, 10) : '',
      expense_type: item.expense_type,
      amount: item.amount,
      description: item.description || '',
      receipt_number: item.receipt_number || '',
      notes: item.notes || ''
    });
    this.showFormModal = true;
  }

  save(): void {
    this.submitted = true;
    if (this.expenseForm.invalid) return;

    const data = { ...this.expenseForm.value, tenant_id: 1 };
    const obs = this.editMode && this.selectedItem
      ? this.apiService.put<any>(`vehicle-expenses/${this.selectedItem.id}`, data)
      : this.apiService.post<any>('vehicle-expenses', data);

    obs.subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = this.editMode ? 'Dépense mise à jour' : 'Dépense enregistrée';
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
    this.apiService.delete<any>(`vehicle-expenses/${this.itemToDelete.id}`).subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = 'Dépense supprimée';
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

  getTaxiPlate(id: number): string {
    const t = this.taxis.find(x => x.id === id);
    return t ? t.plate_number : `ID: ${id}`;
  }

  getDriverName(id: number): string {
    const d = this.drivers.find(x => x.id === id);
    return d ? d.name : '-';
  }

  getExpenseTypeLabel(type: string): string {
    const t = this.expenseTypes.find(x => x.value === type);
    return t ? t.label : type;
  }

  getExpenseTypeClass(type: string): string {
    const m: {[k: string]: string} = {
      'CARBURANT': 'primary',
      'ENTRETIEN': 'info',
      'REPARATION': 'warning',
      'ASSURANCE': 'success',
      'VISITE_TECHNIQUE': 'secondary',
      'AMENDE': 'danger',
      'LAVAGE': 'light',
      'AUTRE': 'dark'
    };
    return m[type] || 'secondary';
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
