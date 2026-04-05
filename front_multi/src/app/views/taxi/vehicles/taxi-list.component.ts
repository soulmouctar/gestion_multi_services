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
  selector: 'app-taxi-list',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './taxi-list.component.html'
})
export class TaxiListComponent implements OnInit {
  taxis: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  currentPage = 1; totalPages = 1; totalItems = 0; itemsPerPage = 15;
  showFormModal = false; editMode = false; submitted = false;
  taxiForm: FormGroup;
  selectedItem: any = null;
  deleteModalOpen = false; itemToDelete: any = null;
  Math = Math;

  constructor(private fb: FormBuilder, private apiService: ApiService, private cdr: ChangeDetectorRef) {
    this.taxiForm = this.fb.group({ plate_number: ['', Validators.required] });
  }

  ngOnInit(): void { this.loadData(); }

  loadData(): void {
    this.loading = true; this.error = null;
    this.apiService.get<any>(`taxis?page=${this.currentPage}`).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          const p = r.data; this.taxis = p.data || [];
          this.currentPage = p.current_page || 1; this.totalPages = p.last_page || 1;
          this.totalItems = p.total || 0; this.itemsPerPage = p.per_page || 15;
        }
        this.loading = false; this.cdr.detectChanges();
      },
      error: () => { this.error = 'Erreur lors du chargement'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  onPageChange(page: number): void { if (page < 1 || page > this.totalPages) return; this.currentPage = page; this.loadData(); }
  openCreateModal(): void { this.editMode = false; this.submitted = false; this.taxiForm.reset({ plate_number: '' }); this.showFormModal = true; }
  openEditModal(item: any): void { this.editMode = true; this.submitted = false; this.selectedItem = item; this.taxiForm.patchValue(item); this.showFormModal = true; }

  save(): void {
    this.submitted = true; if (this.taxiForm.invalid) return;
    
    const data = this.taxiForm.value;
    const obs = this.editMode && this.selectedItem
      ? this.apiService.put<any>(`taxis/${this.selectedItem.id}`, data)
      : this.apiService.post<any>('taxis', data);
    obs.subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = this.editMode ? 'Véhicule mis à jour avec succès' : 'Véhicule créé avec succès';
          this.showFormModal = false;
          this.loadData();
          this.clearMessages();
        }
      },
      error: (err) => { this.error = err?.error?.message || 'Erreur lors de la sauvegarde'; }
    });
  }

  confirmDelete(item: any): void { this.itemToDelete = item; this.deleteModalOpen = true; }
  deleteItem(): void {
    if (!this.itemToDelete) return;
    this.apiService.delete<any>(`taxis/${this.itemToDelete.id}`).subscribe({
      next: (r) => { if (r.success) { this.successMessage = 'Véhicule supprimé'; this.deleteModalOpen = false; this.itemToDelete = null; this.loadData(); this.clearMessages(); } },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; this.deleteModalOpen = false; }
    });
  }

  getPages(): number[] { const p: number[] = []; for (let i = 1; i <= this.totalPages; i++) p.push(i); return p; }
  private clearMessages(): void { setTimeout(() => { this.successMessage = null; this.error = null; this.cdr.detectChanges(); }, 3000); }
}
