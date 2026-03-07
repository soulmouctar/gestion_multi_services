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
  selector: 'app-drivers',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './drivers.component.html'
})
export class DriversComponent implements OnInit {
  drivers: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  currentPage = 1; totalPages = 1; totalItems = 0; itemsPerPage = 15;
  showFormModal = false; editMode = false; submitted = false;
  driverForm: FormGroup;
  selectedItem: any = null;
  deleteModalOpen = false; itemToDelete: any = null;
  Math = Math;

  constructor(private fb: FormBuilder, private apiService: ApiService, private cdr: ChangeDetectorRef) {
    this.driverForm = this.fb.group({
      name: ['', Validators.required],
      phone: [''],
      contract_end: [''],
      status: ['ACTIVE'],
      daily_rate: [0, [Validators.min(0)]]
    });
  }

  ngOnInit(): void { this.loadData(); }

  loadData(): void {
    this.loading = true; this.error = null;
    this.apiService.get<any>(`drivers?page=${this.currentPage}`).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          const p = r.data; this.drivers = p.data || [];
          this.currentPage = p.current_page || 1; this.totalPages = p.last_page || 1;
          this.totalItems = p.total || 0; this.itemsPerPage = p.per_page || 15;
        }
        this.loading = false; this.cdr.detectChanges();
      },
      error: () => { this.error = 'Erreur lors du chargement'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  onPageChange(page: number): void { if (page < 1 || page > this.totalPages) return; this.currentPage = page; this.loadData(); }
  
  openCreateModal(): void {
    this.editMode = false;
    this.submitted = false;
    this.driverForm.reset({ name: '', phone: '', contract_end: '', status: 'ACTIVE', daily_rate: 0 });
    this.showFormModal = true;
  }
  
  openEditModal(item: any): void {
    this.editMode = true;
    this.submitted = false;
    this.selectedItem = item;
    this.driverForm.patchValue({
      name: item.name,
      phone: item.phone,
      contract_end: item.contract_end ? item.contract_end.substring(0, 10) : '',
      status: item.status || 'ACTIVE',
      daily_rate: item.daily_rate || 0
    });
    this.showFormModal = true;
  }

  toggleStatus(item: any): void {
    this.apiService.post<any>(`drivers/${item.id}/toggle-status`, {}).subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = 'Statut mis à jour';
          this.loadData();
          this.clearMessages();
        }
      },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; }
    });
  }

  getStatusClass(status: string): string {
    const m: {[k: string]: string} = { 'ACTIVE': 'success', 'INACTIVE': 'secondary', 'SUSPENDED': 'danger' };
    return m[status] || 'secondary';
  }

  getStatusLabel(status: string): string {
    const m: {[k: string]: string} = { 'ACTIVE': 'Actif', 'INACTIVE': 'Inactif', 'SUSPENDED': 'Suspendu' };
    return m[status] || status;
  }

  save(): void {
    this.submitted = true; if (this.driverForm.invalid) return;
    const data = { ...this.driverForm.value, tenant_id: 1 };
    const obs = this.editMode && this.selectedItem
      ? this.apiService.put<any>(`drivers/${this.selectedItem.id}`, data)
      : this.apiService.post<any>('drivers', data);
    obs.subscribe({
      next: (r) => { if (r.success) { this.successMessage = this.editMode ? 'Conducteur mis à jour' : 'Conducteur créé'; this.showFormModal = false; this.loadData(); this.clearMessages(); } },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; }
    });
  }

  confirmDelete(item: any): void { this.itemToDelete = item; this.deleteModalOpen = true; }
  deleteItem(): void {
    if (!this.itemToDelete) return;
    this.apiService.delete<any>(`drivers/${this.itemToDelete.id}`).subscribe({
      next: (r) => { if (r.success) { this.successMessage = 'Conducteur supprimé'; this.deleteModalOpen = false; this.itemToDelete = null; this.loadData(); this.clearMessages(); } },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; this.deleteModalOpen = false; }
    });
  }

  getPages(): number[] { const p: number[] = []; for (let i = 1; i <= this.totalPages; i++) p.push(i); return p; }
  private clearMessages(): void { setTimeout(() => { this.successMessage = null; this.error = null; this.cdr.detectChanges(); }, 3000); }
}
