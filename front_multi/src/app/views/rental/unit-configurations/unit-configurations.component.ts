import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-unit-configurations',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unit-configurations.component.html'
})
export class UnitConfigurationsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  configurations: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  currentPage = 1; totalPages = 1; totalItems = 0; itemsPerPage = 15;
  showFormModal = false; editMode = false; submitted = false;
  configForm: FormGroup;
  selectedItem: any = null;
  deleteModalOpen = false; itemToDelete: any = null;
  Math = Math;

  constructor(private fb: FormBuilder, private apiService: ApiService, private authService: AuthService, private cdr: ChangeDetectorRef) {
    this.configForm = this.fb.group({
      name: ['', Validators.required],
      bedrooms: [null],
      living_rooms: [null],
      bathrooms: [null],
      has_terrace: [false]
    });
  }

  ngOnInit(): void { this.loadData(); }

  get canCreateConfigurations(): boolean { return this.authService.hasModulePermission('RENTAL', 'create'); }
  get canEditConfigurations(): boolean { return this.authService.hasModulePermission('RENTAL', 'edit'); }
  get canDeleteConfigurations(): boolean { return this.authService.hasModulePermission('RENTAL', 'delete'); }

  loadData(): void {
    this.loading = true; this.error = null;
    this.apiService.get<any>(`unit-configurations?page=${this.currentPage}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          const p = r.data; this.configurations = p.data || [];
          this.currentPage = p.current_page || 1; this.totalPages = p.last_page || 1;
          this.totalItems = p.total || 0; this.itemsPerPage = p.per_page || 15;
        }
        this.loading = false; this.cdr.detectChanges();
      },
      error: () => { this.error = 'Erreur lors du chargement'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  onPageChange(page: number): void { if (page < 1 || page > this.totalPages) return; this.currentPage = page; this.loadData(); }
  openCreateModal(): void { if (!this.canCreateConfigurations) return; this.editMode = false; this.submitted = false; this.configForm.reset({ name: '', bedrooms: null, living_rooms: null, bathrooms: null, has_terrace: false }); this.showFormModal = true; }
  openEditModal(item: any): void { if (!this.canEditConfigurations) return; this.editMode = true; this.submitted = false; this.selectedItem = item; this.configForm.patchValue(item); this.showFormModal = true; }

  save(): void {
    this.submitted = true; if (this.configForm.invalid) return;
    if (this.editMode ? !this.canEditConfigurations : !this.canCreateConfigurations) return;
    const data = this.configForm.value;
    const obs = this.editMode && this.selectedItem
      ? this.apiService.put<any>(`unit-configurations/${this.selectedItem.id}`, data)
      : this.apiService.post<any>('unit-configurations', data);
    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { if (r.success) { this.successMessage = this.editMode ? 'Configuration mise à jour' : 'Configuration créée'; this.showFormModal = false; this.loadData(); this.clearMessages(); } },
      error: (err) => { this.error = err.message || 'Erreur'; }
    });
  }

  confirmDelete(item: any): void { if (!this.canDeleteConfigurations) return; this.itemToDelete = item; this.deleteModalOpen = true; }
  deleteItem(): void {
    if (!this.itemToDelete || !this.canDeleteConfigurations) return;
    this.apiService.delete<any>(`unit-configurations/${this.itemToDelete.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { if (r.success) { this.successMessage = 'Configuration supprimée'; this.deleteModalOpen = false; this.itemToDelete = null; this.loadData(); this.clearMessages(); } },
      error: (err) => { this.error = err.message || 'Erreur'; this.deleteModalOpen = false; }
    });
  }

  getPages(): number[] { const p: number[] = []; for (let i = 1; i <= this.totalPages; i++) p.push(i); return p; }
  private clearMessages(): void { setTimeout(() => { this.successMessage = null; this.error = null; this.cdr.detectChanges(); }, 3000); }
  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }

}
