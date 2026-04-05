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
  selector: 'app-locations',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './locations.component.html'
})
export class LocationsComponent implements OnInit {
  locations: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  currentPage = 1; totalPages = 1; totalItems = 0; itemsPerPage = 15;
  showFormModal = false; editMode = false; submitted = false;
  locationForm: FormGroup;
  selectedItem: any = null;
  deleteModalOpen = false; itemToDelete: any = null;
  Math = Math;

  constructor(private fb: FormBuilder, private apiService: ApiService, private cdr: ChangeDetectorRef) {
    this.locationForm = this.fb.group({ name: ['', [Validators.required, Validators.maxLength(150)]] });
  }

  ngOnInit(): void { this.loadData(); }

  loadData(): void {
    this.loading = true;
    this.apiService.get<any>(`locations?page=${this.currentPage}`).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          const p = r.data; this.locations = p.data || [];
          this.currentPage = p.current_page || 1; this.totalPages = p.last_page || 1;
          this.totalItems = p.total || 0; this.itemsPerPage = p.per_page || 15;
        }
        this.loading = false; this.cdr.detectChanges();
      },
      error: () => { this.error = 'Erreur lors du chargement'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  onPageChange(page: number): void { if (page < 1 || page > this.totalPages) return; this.currentPage = page; this.loadData(); }

  openCreateModal(): void { this.editMode = false; this.submitted = false; this.locationForm.reset({ name: '' }); this.showFormModal = true; }
  openEditModal(item: any): void { this.editMode = true; this.submitted = false; this.selectedItem = item; this.locationForm.patchValue(item); this.showFormModal = true; }

  save(): void {
    this.submitted = true; if (this.locationForm.invalid) return;
    const data = this.locationForm.value;
    const obs = this.editMode && this.selectedItem
      ? this.apiService.put<any>(`locations/${this.selectedItem.id}`, data)
      : this.apiService.post<any>('locations', data);
    obs.subscribe({
      next: (r) => { if (r.success) { this.successMessage = this.editMode ? 'Emplacement mis à jour' : 'Emplacement créé'; this.showFormModal = false; this.loadData(); this.clearMessages(); } },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; }
    });
  }

  confirmDelete(item: any): void { this.itemToDelete = item; this.deleteModalOpen = true; }
  deleteItem(): void {
    if (!this.itemToDelete) return;
    this.apiService.delete<any>(`locations/${this.itemToDelete.id}`).subscribe({
      next: (r) => { if (r.success) { this.successMessage = 'Emplacement supprimé'; this.deleteModalOpen = false; this.itemToDelete = null; this.loadData(); this.clearMessages(); } },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; this.deleteModalOpen = false; }
    });
  }

  getPages(): number[] { const p: number[] = []; for (let i = 1; i <= this.totalPages; i++) p.push(i); return p; }
  private clearMessages(): void { setTimeout(() => { this.successMessage = null; this.error = null; this.cdr.detectChanges(); }, 3000); }
}
