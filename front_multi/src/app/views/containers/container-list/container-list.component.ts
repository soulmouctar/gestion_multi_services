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
  isSuperAdmin = false;
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
  readonly generatedContainerExample = `CNT${new Date().getFullYear().toString().slice(-2)}001`;
  readonly ports = ['Dakar', 'Banjul', 'Conakry', 'Abidjan', 'Lomé', 'Tema', 'Cotonou', 'Autre'];
  readonly deliveryStatuses = [
    { value: 'NON_LIVRE', label: 'Non livré' },
    { value: 'LIVRE', label: 'Livré' }
  ];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.containerForm = this.fb.group({
      container_number: [''],
      shipping_number: ['', Validators.required],
      bl_number: [''],
      capacity: [null],
      delivery_status: ['NON_LIVRE', Validators.required],
      entry_port: [''],
      entry_date: [null],
      expected_delivery_date: [null],
      tenant_id: [null]
    });
  }

  ngOnInit(): void {
    // Subscribe to authState so isSuperAdmin is always up-to-date
    this.authService.authState$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(state => {
      const user = state.user as any;
      const roles: any[] = Array.isArray(user?.roles) ? user.roles : [];
      this.isSuperAdmin = roles.some((r: any) => r?.name === 'SUPER_ADMIN');
      if (this.isSuperAdmin && this.tenants.length === 0) {
        this.loadTenants();
      }
      this.cdr.markForCheck();
    });
    this.loadContainers();
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
    this.containerForm.reset({
      container_number: '',
      shipping_number: '',
      bl_number: '',
      capacity: null,
      delivery_status: 'NON_LIVRE',
      entry_port: '',
      entry_date: null,
      expected_delivery_date: null,
      tenant_id: null
    });
    this.containerForm.get('container_number')?.disable();
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
    this.containerForm.get('container_number')?.enable();
    this.containerForm.get('tenant_id')?.clearValidators();
    this.containerForm.get('tenant_id')?.updateValueAndValidity();
    this.containerForm.patchValue({
      container_number: container.container_number || '',
      shipping_number: container.shipping_number || '',
      bl_number: container.bl_number || '',
      capacity: container.capacity ?? null,
      delivery_status: container.delivery_status || 'NON_LIVRE',
      entry_port: container.entry_port || '',
      entry_date: container.entry_date ? String(container.entry_date).split('T')[0] : null,
      expected_delivery_date: container.expected_delivery_date ? String(container.expected_delivery_date).split('T')[0] : null,
      tenant_id: container.tenant_id || null
    });
    this.showFormModal = true;
  }

  saveContainer(): void {
    this.submitted = true;
    if (this.containerForm.invalid) {
      this.error = 'Veuillez remplir tous les champs obligatoires';
      this.cdr.detectChanges();
      return;
    }

    const data = this.containerForm.getRawValue();

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
