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
  selector: 'app-categories-list',
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
  templateUrl: './categories-list.component.html',
  styleUrls: ['./categories-list.component.scss']
})
export class CategoriesListComponent implements OnInit {
  categories: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  itemsPerPage = 15;

  // Selection
  selectedCategories: Set<number> = new Set();
  selectAll = false;

  // Modal
  showFormModal = false;
  editMode = false;
  submitted = false;
  categoryForm: FormGroup;
  selectedCategory: any = null;
  deleteModalOpen = false;
  categoryToDelete: any = null;

  Math = Math;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]]
    });
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading = true;
    this.error = null;

    this.apiService.get<any>(`product-categories?page=${this.currentPage}`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const paginated = response.data;
          this.categories = paginated.data || [];
          this.currentPage = paginated.current_page || 1;
          this.totalPages = paginated.last_page || 1;
          this.totalItems = paginated.total || 0;
          this.itemsPerPage = paginated.per_page || 15;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error   = 'Erreur lors du chargement des catégories';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadCategories();
  }

  openCreateModal(): void {
    this.editMode = false;
    this.submitted = false;
    this.categoryForm.reset({ name: '' });
    this.showFormModal = true;
  }

  openEditModal(category: any): void {
    this.editMode = true;
    this.submitted = false;
    this.selectedCategory = category;
    this.categoryForm.patchValue({ name: category.name });
    this.showFormModal = true;
  }

  saveCategory(): void {
    this.submitted = true;
    if (this.categoryForm.invalid) return;

    const data = this.categoryForm.value;

    if (this.editMode && this.selectedCategory) {
      this.apiService.put<any>(`product-categories/${this.selectedCategory.id}`, data).subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = 'Catégorie mise à jour avec succès';
            this.showFormModal = false;
            this.loadCategories();
            this.clearMessages();
          }
        },
        error: (err) => {
          this.error = err?.error?.message || 'Erreur lors de la mise à jour';
        }
      });
    } else {
      this.apiService.post<any>('product-categories', data).subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = 'Catégorie créée avec succès';
            this.showFormModal = false;
            this.loadCategories();
            this.clearMessages();
          }
        },
        error: (err) => {
          this.error = err?.error?.message || 'Erreur lors de la création';
        }
      });
    }
  }

  confirmDelete(category: any): void {
    this.categoryToDelete = category;
    this.deleteModalOpen = true;
  }

  deleteCategory(): void {
    if (!this.categoryToDelete) return;

    this.apiService.delete<any>(`product-categories/${this.categoryToDelete.id}`).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = 'Catégorie supprimée avec succès';
          this.deleteModalOpen = false;
          this.categoryToDelete = null;
          this.loadCategories();
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
      this.selectedCategories.clear();
    } else {
      this.categories.forEach(c => this.selectedCategories.add(c.id));
    }
    this.selectAll = !this.selectAll;
  }

  toggleCategorySelection(id: number): void {
    if (this.selectedCategories.has(id)) {
      this.selectedCategories.delete(id);
    } else {
      this.selectedCategories.add(id);
    }
    this.selectAll = this.selectedCategories.size === this.categories.length;
  }

  isCategorySelected(id: number): boolean {
    return this.selectedCategories.has(id);
  }

  deleteSelectedCategories(): void {
    if (this.selectedCategories.size === 0) return;
    if (!confirm(`Supprimer ${this.selectedCategories.size} catégorie(s) ?`)) return;

    const ids = Array.from(this.selectedCategories);
    let completed = 0;
    ids.forEach(id => {
      this.apiService.delete<any>(`product-categories/${id}`).subscribe({
        next: () => {
          completed++;
          if (completed === ids.length) {
            this.selectedCategories.clear();
            this.selectAll = false;
            this.loadCategories();
            this.successMessage = `${ids.length} catégorie(s) supprimée(s)`;
            this.clearMessages();
          }
        },
        error: () => { completed++; }
      });
    });
  }

  trackByCategoryId(_index: number, category: any): number {
    return category.id;
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
