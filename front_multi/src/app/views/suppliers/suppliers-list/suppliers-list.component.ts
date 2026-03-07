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
  selector: 'app-suppliers-list',
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
  templateUrl: './suppliers-list.component.html',
  styleUrls: ['./suppliers-list.component.scss']
})
export class SuppliersListComponent implements OnInit {
  suppliers: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  itemsPerPage = 15;

  // Filters
  searchTerm = '';

  // Selection
  selectedSuppliers: Set<number> = new Set();
  selectAll = false;

  // Modal
  showFormModal = false;
  editMode = false;
  submitted = false;
  supplierForm: FormGroup;
  selectedSupplier: any = null;
  deleteModalOpen = false;
  supplierToDelete: any = null;

  Math = Math;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {
    this.supplierForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(150)]],
      currency: ['GNF']
    });
  }

  ngOnInit(): void {
    this.loadSuppliers();
  }

  loadSuppliers(): void {
    this.loading = true;
    this.error = null;

    this.apiService.get<any>(`suppliers-public?page=${this.currentPage}`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const paginated = response.data;
          this.suppliers = paginated.data || [];
          this.currentPage = paginated.current_page || 1;
          this.totalPages = paginated.last_page || 1;
          this.totalItems = paginated.total || 0;
          this.itemsPerPage = paginated.per_page || 15;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des fournisseurs';
        console.error('Error loading suppliers:', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadSuppliers();
  }

  // CRUD
  openCreateModal(): void {
    this.editMode = false;
    this.submitted = false;
    this.supplierForm.reset({ name: '', currency: 'GNF' });
    this.showFormModal = true;
  }

  openEditModal(supplier: any): void {
    this.editMode = true;
    this.submitted = false;
    this.selectedSupplier = supplier;
    this.supplierForm.patchValue({
      name: supplier.name,
      currency: supplier.currency || 'GNF'
    });
    this.showFormModal = true;
  }

  saveSupplier(): void {
    this.submitted = true;
    if (this.supplierForm.invalid) return;

    const data = this.supplierForm.value;

    if (this.editMode && this.selectedSupplier) {
      this.apiService.put<any>(`suppliers/${this.selectedSupplier.id}`, data).subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = 'Fournisseur mis à jour avec succès';
            this.showFormModal = false;
            this.loadSuppliers();
            this.clearMessages();
          }
        },
        error: (err) => {
          this.error = err?.error?.message || 'Erreur lors de la mise à jour';
        }
      });
    } else {
      // Add tenant_id for testing
      const supplierData = { ...data, tenant_id: 1 };
      this.apiService.post<any>('suppliers-public', supplierData).subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = 'Fournisseur créé avec succès';
            this.showFormModal = false;
            this.loadSuppliers();
            this.clearMessages();
          }
        },
        error: (err) => {
          this.error = err?.error?.message || 'Erreur lors de la création';
        }
      });
    }
  }

  confirmDelete(supplier: any): void {
    this.supplierToDelete = supplier;
    this.deleteModalOpen = true;
  }

  deleteSupplier(): void {
    if (!this.supplierToDelete) return;

    this.apiService.delete<any>(`suppliers/${this.supplierToDelete.id}`).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = 'Fournisseur supprimé avec succès';
          this.deleteModalOpen = false;
          this.supplierToDelete = null;
          this.loadSuppliers();
          this.clearMessages();
        }
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur lors de la suppression';
        this.deleteModalOpen = false;
      }
    });
  }

  // Selection
  toggleSelectAll(): void {
    if (this.selectAll) {
      this.selectedSuppliers.clear();
    } else {
      this.suppliers.forEach(s => this.selectedSuppliers.add(s.id));
    }
    this.selectAll = !this.selectAll;
  }

  toggleSupplierSelection(id: number): void {
    if (this.selectedSuppliers.has(id)) {
      this.selectedSuppliers.delete(id);
    } else {
      this.selectedSuppliers.add(id);
    }
    this.selectAll = this.selectedSuppliers.size === this.suppliers.length;
  }

  isSupplierSelected(id: number): boolean {
    return this.selectedSuppliers.has(id);
  }

  deleteSelectedSuppliers(): void {
    if (this.selectedSuppliers.size === 0) return;
    if (!confirm(`Supprimer ${this.selectedSuppliers.size} fournisseur(s) ?`)) return;

    const ids = Array.from(this.selectedSuppliers);
    let completed = 0;
    ids.forEach(id => {
      this.apiService.delete<any>(`suppliers/${id}`).subscribe({
        next: () => {
          completed++;
          if (completed === ids.length) {
            this.selectedSuppliers.clear();
            this.selectAll = false;
            this.loadSuppliers();
            this.successMessage = `${ids.length} fournisseur(s) supprimé(s)`;
            this.clearMessages();
          }
        },
        error: () => { completed++; }
      });
    });
  }

  trackBySupplierId(index: number, supplier: any): number {
    return supplier.id;
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
