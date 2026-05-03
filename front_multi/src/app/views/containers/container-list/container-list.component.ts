import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-container-list',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './container-list.component.html'
})
export class ContainerListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  containers: any[] = [];
  tenants: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  itemsPerPage = 15;
  showFormModal = false;
  editMode = false;
  submitted = false;
  containerForm: FormGroup;
  selectedContainer: any = null;
  deleteModalOpen = false;
  containerToDelete: any = null;
  Math = Math;

  get isSuperAdmin(): boolean { return this.authService.isSuperAdmin; }

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.containerForm = this.fb.group({
      container_number: ['', Validators.required],
      capacity_min: [null],
      capacity_max: [null],
      interest_rate: [null],
      tenant_id: [null]
    });
  }

  ngOnInit(): void {
    this.loadContainers();
    if (this.isSuperAdmin) {
      this.loadTenants();
    }
  }

  loadTenants(): void {
    this.apiService.get<any>('tenants?per_page=200').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.tenants = r.data?.data || r.data || [];
        this.cdr.detectChanges();
      }
    });
  }

  loadContainers(): void {
    this.loading = true;
    this.error = null;
    this.apiService.get<any>(`containers?page=${this.currentPage}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const p = response.data;
          this.containers = p.data || [];
          this.currentPage = p.current_page || 1;
          this.totalPages = p.last_page || 1;
          this.totalItems = p.total || 0;
          this.itemsPerPage = p.per_page || 15;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Erreur lors du chargement des conteneurs';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadContainers();
  }

  openCreateModal(): void {
    this.editMode = false;
    this.submitted = false;
    this.containerForm.reset({ container_number: '', capacity_min: null, capacity_max: null, interest_rate: null, tenant_id: null });
    if (this.isSuperAdmin) {
      this.containerForm.get('tenant_id')?.setValidators(Validators.required);
    } else {
      this.containerForm.get('tenant_id')?.clearValidators();
    }
    this.containerForm.get('tenant_id')?.updateValueAndValidity();
    this.showFormModal = true;
  }

  openEditModal(container: any): void {
    this.editMode = true;
    this.submitted = false;
    this.selectedContainer = container;
    this.containerForm.get('tenant_id')?.clearValidators();
    this.containerForm.get('tenant_id')?.updateValueAndValidity();
    this.containerForm.patchValue(container);
    this.showFormModal = true;
  }

  saveContainer(): void {
    this.submitted = true;
    if (this.containerForm.invalid) {
      this.error = 'Veuillez remplir tous les champs obligatoires';
      this.cdr.detectChanges();
      return;
    }

    const data = this.containerForm.value;

    if (this.isSuperAdmin && !data.tenant_id) {
      this.error = 'Veuillez sélectionner une organisation.';
      this.cdr.detectChanges();
      return;
    }

    const obs = this.editMode && this.selectedContainer
      ? this.apiService.put<any>(`containers/${this.selectedContainer.id}`, data)
      : this.apiService.post<any>('containers', data);

    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = this.editMode ? 'Conteneur mis à jour avec succès' : 'Conteneur créé avec succès';
          this.showFormModal = false;
          this.containerForm.reset();
          this.loadContainers();
          this.clearMessages();
        }
      },
      error: (err) => {
        this.error = err.message || 'Erreur lors de la sauvegarde du conteneur';
        this.cdr.detectChanges();
      }
    });
  }

  confirmDelete(c: any): void { this.containerToDelete = c; this.deleteModalOpen = true; }

  deleteContainer(): void {
    if (!this.containerToDelete) return;
    this.apiService.delete<any>(`containers/${this.containerToDelete.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = 'Conteneur supprimé';
          this.deleteModalOpen = false;
          this.containerToDelete = null;
          this.loadContainers();
          this.clearMessages();
        }
      },
      error: (err) => {
        this.error = err.message || 'Erreur lors de la suppression';
        this.deleteModalOpen = false;
        this.cdr.detectChanges();
      }
    });
  }

  viewContainerDetails(container: any): void {
    this.router.navigate(['/containers/detail', container.id]);
  }

  getPages(): number[] {
    const p: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) p.push(i);
    return p;
  }

  private clearMessages(): void {
    setTimeout(() => { this.successMessage = null; this.error = null; this.cdr.detectChanges(); }, 3000);
  }

  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }
}
