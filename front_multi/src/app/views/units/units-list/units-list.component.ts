import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

import {
  ButtonModule,
  ButtonGroupModule,
  CardModule,
  FormModule,
  BadgeModule,
  ModalModule,
  AlertModule,
  SpinnerModule,
  RowComponent,
  ColComponent,
  ContainerComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-units-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    IconDirective,
    ButtonModule,
    ButtonGroupModule,
    CardModule,
    FormModule,
    BadgeModule,
    ModalModule,
    AlertModule,
    SpinnerModule,
    RowComponent,
    ColComponent,
    ContainerComponent
  ],
  templateUrl: './units-list.component.html',
  styleUrls: ['./units-list.component.scss']
})
export class UnitsListComponent implements OnInit {
  units: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  itemsPerPage = 15;

  // Selection
  selectedUnits: Set<number> = new Set();
  selectAll = false;

  // Modal
  showFormModal = false;
  editMode = false;
  submitted = false;
  unitForm: FormGroup;
  selectedUnit: any = null;
  deleteModalOpen = false;
  unitToDelete: any = null;

  Math = Math;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {
    this.unitForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(50)]],
      conversion_value: [null]
    });
  }

  ngOnInit(): void {
    this.loadUnits();
  }

  loadUnits(): void {
    this.loading = true;
    this.error = null;

    this.apiService.get<any>(`units?page=${this.currentPage}`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const paginated = response.data;
          this.units = paginated.data || [];
          this.currentPage = paginated.current_page || 1;
          this.totalPages = paginated.last_page || 1;
          this.totalItems = paginated.total || 0;
          this.itemsPerPage = paginated.per_page || 15;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error   = 'Erreur lors du chargement des unités';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadUnits();
  }

  openCreateModal(): void {
    this.editMode = false;
    this.submitted = false;
    this.unitForm.reset({ name: '', conversion_value: null });
    this.showFormModal = true;
  }

  openEditModal(unit: any): void {
    this.editMode = true;
    this.submitted = false;
    this.selectedUnit = unit;
    this.unitForm.patchValue({
      name: unit.name,
      conversion_value: unit.conversion_value
    });
    this.showFormModal = true;
  }

  saveUnit(): void {
    this.submitted = true;
    if (this.unitForm.invalid) return;

    const data = this.unitForm.value;

    if (this.editMode && this.selectedUnit) {
      this.apiService.put<any>(`units/${this.selectedUnit.id}`, data).subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = 'Unité mise à jour avec succès';
            this.showFormModal = false;
            this.loadUnits();
            this.clearMessages();
          }
        },
        error: (err) => {
          this.error = err?.error?.message || 'Erreur lors de la mise à jour';
        }
      });
    } else {
      this.apiService.post<any>('units', data).subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = 'Unité créée avec succès';
            this.showFormModal = false;
            this.loadUnits();
            this.clearMessages();
          }
        },
        error: (err) => {
          this.error = err?.error?.message || 'Erreur lors de la création';
        }
      });
    }
  }

  confirmDelete(unit: any): void {
    this.unitToDelete = unit;
    this.deleteModalOpen = true;
  }

  deleteUnit(): void {
    if (!this.unitToDelete) return;

    this.apiService.delete<any>(`units/${this.unitToDelete.id}`).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = 'Unité supprimée avec succès';
          this.deleteModalOpen = false;
          this.unitToDelete = null;
          this.loadUnits();
          this.clearMessages();
        }
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur lors de la suppression';
        this.deleteModalOpen = false;
      }
    });
  }

  toggleSelectAll(): void {
    if (this.selectAll) {
      this.selectedUnits.clear();
    } else {
      this.units.forEach(u => this.selectedUnits.add(u.id));
    }
    this.selectAll = !this.selectAll;
  }

  toggleUnitSelection(id: number): void {
    if (this.selectedUnits.has(id)) {
      this.selectedUnits.delete(id);
    } else {
      this.selectedUnits.add(id);
    }
    this.selectAll = this.selectedUnits.size === this.units.length;
  }

  isUnitSelected(id: number): boolean {
    return this.selectedUnits.has(id);
  }

  deleteSelectedUnits(): void {
    if (this.selectedUnits.size === 0) return;
    if (!confirm(`Supprimer ${this.selectedUnits.size} unité(s) ?`)) return;

    const ids = Array.from(this.selectedUnits);
    let completed = 0;
    ids.forEach(id => {
      this.apiService.delete<any>(`units/${id}`).subscribe({
        next: () => {
          completed++;
          if (completed === ids.length) {
            this.selectedUnits.clear();
            this.selectAll = false;
            this.loadUnits();
            this.successMessage = `${ids.length} unité(s) supprimée(s)`;
            this.clearMessages();
          }
        },
        error: () => { completed++; }
      });
    });
  }

  trackByUnitId(_index: number, unit: any): number {
    return unit.id;
  }

  getPages(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  private clearMessages(): void {
    setTimeout(() => {
      this.successMessage = null;
      this.error = null;
      this.cdr.detectChanges();
    }, 3000);
  }
}
