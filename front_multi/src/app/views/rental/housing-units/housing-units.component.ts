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
  selector: 'app-housing-units',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './housing-units.component.html'
})
export class HousingUnitsComponent implements OnInit {
  housingUnits: any[] = [];
  floors: any[] = [];
  configurations: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  currentPage = 1; totalPages = 1; totalItems = 0; itemsPerPage = 15;
  showFormModal = false; editMode = false; submitted = false;
  unitForm: FormGroup;
  selectedItem: any = null;
  deleteModalOpen = false; itemToDelete: any = null;
  Math = Math;

  constructor(private fb: FormBuilder, private apiService: ApiService, private cdr: ChangeDetectorRef) {
    this.unitForm = this.fb.group({
      floor_id: [null, Validators.required],
      unit_configuration_id: [null],
      rent_amount: [null, [Validators.required, Validators.min(0)]],
      status: ['LIBRE']
    });
  }

  ngOnInit(): void { this.loadData(); this.loadFloors(); this.loadConfigurations(); }

  loadFloors(): void {
    this.apiService.get<any>('floors?per_page=200').subscribe({
      next: (r) => { if (r.success && r.data) this.floors = r.data.data || []; }
    });
  }

  loadConfigurations(): void {
    this.apiService.get<any>('unit-configurations?per_page=200').subscribe({
      next: (r) => { if (r.success && r.data) this.configurations = r.data.data || []; }
    });
  }

  loadData(): void {
    this.loading = true; this.error = null;
    this.apiService.get<any>(`housing-units?page=${this.currentPage}`).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          const p = r.data; this.housingUnits = p.data || [];
          this.currentPage = p.current_page || 1; this.totalPages = p.last_page || 1;
          this.totalItems = p.total || 0; this.itemsPerPage = p.per_page || 15;
        }
        this.loading = false; this.cdr.detectChanges();
      },
      error: () => { this.error = 'Erreur lors du chargement'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  onPageChange(page: number): void { if (page < 1 || page > this.totalPages) return; this.currentPage = page; this.loadData(); }
  openCreateModal(): void { this.editMode = false; this.submitted = false; this.unitForm.reset({ floor_id: null, unit_configuration_id: null, rent_amount: null, status: 'LIBRE' }); this.showFormModal = true; }
  openEditModal(item: any): void { this.editMode = true; this.submitted = false; this.selectedItem = item; this.unitForm.patchValue(item); this.showFormModal = true; }

  save(): void {
    this.submitted = true; if (this.unitForm.invalid) return;
    const data = this.unitForm.value;
    const obs = this.editMode && this.selectedItem
      ? this.apiService.put<any>(`housing-units/${this.selectedItem.id}`, data)
      : this.apiService.post<any>('housing-units', data);
    obs.subscribe({
      next: (r) => { if (r.success) { this.successMessage = this.editMode ? 'Unité mise à jour' : 'Unité créée'; this.showFormModal = false; this.loadData(); this.clearMessages(); } },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; }
    });
  }

  confirmDelete(item: any): void { this.itemToDelete = item; this.deleteModalOpen = true; }
  deleteItem(): void {
    if (!this.itemToDelete) return;
    this.apiService.delete<any>(`housing-units/${this.itemToDelete.id}`).subscribe({
      next: (r) => { if (r.success) { this.successMessage = 'Unité supprimée'; this.deleteModalOpen = false; this.itemToDelete = null; this.loadData(); this.clearMessages(); } },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; this.deleteModalOpen = false; }
    });
  }

  getFloorLabel(id: number): string { const f = this.floors.find(x => x.id === id); return f ? `Étage ${f.floor_number}` : `ID: ${id}`; }
  getConfigName(id: number): string { const c = this.configurations.find(x => x.id === id); return c ? c.name : '-'; }

  getStatusClass(s: string): string {
    const m: {[k: string]: string} = { 'LIBRE': 'success', 'OCCUPE': 'warning' };
    return m[s] || 'secondary';
  }
  getStatusLabel(s: string): string {
    const m: {[k: string]: string} = { 'LIBRE': 'Libre', 'OCCUPE': 'Occupé' };
    return m[s] || s;
  }

  getPages(): number[] { const p: number[] = []; for (let i = 1; i <= this.totalPages; i++) p.push(i); return p; }
  private clearMessages(): void { setTimeout(() => { this.successMessage = null; this.error = null; this.cdr.detectChanges(); }, 3000); }
}
