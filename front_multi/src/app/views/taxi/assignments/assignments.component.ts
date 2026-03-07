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
  selector: 'app-taxi-assignments',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './assignments.component.html'
})
export class TaxiAssignmentsComponent implements OnInit {
  assignments: any[] = [];
  taxis: any[] = [];
  drivers: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  currentPage = 1; totalPages = 1; totalItems = 0; itemsPerPage = 15;
  showFormModal = false; editMode = false; submitted = false;
  assignForm: FormGroup;
  selectedItem: any = null;
  deleteModalOpen = false; itemToDelete: any = null;
  Math = Math;

  constructor(private fb: FormBuilder, private apiService: ApiService, private cdr: ChangeDetectorRef) {
    this.assignForm = this.fb.group({
      taxi_id: [null, Validators.required],
      driver_id: [null, Validators.required],
      start_date: ['', Validators.required],
      end_date: ['']
    });
  }

  ngOnInit(): void { this.loadData(); this.loadTaxis(); this.loadDrivers(); }

  loadTaxis(): void {
    this.apiService.get<any>('taxis?per_page=200').subscribe({
      next: (r) => { if (r.success && r.data) this.taxis = r.data.data || []; }
    });
  }

  loadDrivers(): void {
    this.apiService.get<any>('drivers?per_page=200').subscribe({
      next: (r) => { if (r.success && r.data) this.drivers = r.data.data || []; }
    });
  }

  loadData(): void {
    this.loading = true; this.error = null;
    this.apiService.get<any>(`taxi-assignments?page=${this.currentPage}`).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          const p = r.data; this.assignments = p.data || [];
          this.currentPage = p.current_page || 1; this.totalPages = p.last_page || 1;
          this.totalItems = p.total || 0; this.itemsPerPage = p.per_page || 15;
        }
        this.loading = false; this.cdr.detectChanges();
      },
      error: () => { this.error = 'Erreur lors du chargement'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  onPageChange(page: number): void { if (page < 1 || page > this.totalPages) return; this.currentPage = page; this.loadData(); }
  openCreateModal(): void { this.editMode = false; this.submitted = false; this.assignForm.reset({ taxi_id: null, driver_id: null, start_date: '', end_date: '' }); this.showFormModal = true; }
  openEditModal(item: any): void {
    this.editMode = true; this.submitted = false; this.selectedItem = item;
    this.assignForm.patchValue({
      taxi_id: item.taxi_id, driver_id: item.driver_id,
      start_date: item.start_date ? item.start_date.substring(0, 10) : '',
      end_date: item.end_date ? item.end_date.substring(0, 10) : ''
    });
    this.showFormModal = true;
  }

  save(): void {
    this.submitted = true; if (this.assignForm.invalid) return;
    const data = this.assignForm.value;
    const obs = this.editMode && this.selectedItem
      ? this.apiService.put<any>(`taxi-assignments/${this.selectedItem.id}`, data)
      : this.apiService.post<any>('taxi-assignments', data);
    obs.subscribe({
      next: (r) => { if (r.success) { this.successMessage = this.editMode ? 'Affectation mise à jour' : 'Affectation créée'; this.showFormModal = false; this.loadData(); this.clearMessages(); } },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; }
    });
  }

  confirmDelete(item: any): void { this.itemToDelete = item; this.deleteModalOpen = true; }
  deleteItem(): void {
    if (!this.itemToDelete) return;
    this.apiService.delete<any>(`taxi-assignments/${this.itemToDelete.id}`).subscribe({
      next: (r) => { if (r.success) { this.successMessage = 'Affectation supprimée'; this.deleteModalOpen = false; this.itemToDelete = null; this.loadData(); this.clearMessages(); } },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; this.deleteModalOpen = false; }
    });
  }

  getTaxiPlate(id: number): string { const t = this.taxis.find(x => x.id === id); return t ? t.plate_number : `ID: ${id}`; }
  getDriverName(id: number): string { const d = this.drivers.find(x => x.id === id); return d ? d.name : `ID: ${id}`; }
  getPages(): number[] { const p: number[] = []; for (let i = 1; i <= this.totalPages; i++) p.push(i); return p; }
  private clearMessages(): void { setTimeout(() => { this.successMessage = null; this.error = null; this.cdr.detectChanges(); }, 3000); }
}
