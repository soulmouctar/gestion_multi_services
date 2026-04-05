import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
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
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './container-list.component.html'
})
export class ContainerListComponent implements OnInit {
  containers: any[] = [];
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
      interest_rate: [null]
    });
  }

  ngOnInit(): void { this.loadContainers(); }

  loadContainers(): void {
    this.loading = true;
    this.error = null;
    this.apiService.get<any>(`containers?page=${this.currentPage}`).subscribe({
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
    this.editMode = false; this.submitted = false;
    this.containerForm.reset({ container_number: '', capacity_min: null, capacity_max: null, interest_rate: null });
    this.showFormModal = true;
  }

  openEditModal(container: any): void {
    this.editMode = true; this.submitted = false; this.selectedContainer = container;
    this.containerForm.patchValue(container);
    this.showFormModal = true;
  }

  saveContainer(): void {
    this.submitted = true;
    if (this.containerForm.invalid) {
      this.error = 'Veuillez remplir tous les champs obligatoires';
      return;
    }
    
    const data = this.containerForm.value;

    const obs = this.editMode && this.selectedContainer
      ? this.apiService.put<any>(`containers/${this.selectedContainer.id}`, data)
      : this.apiService.post<any>('containers', data);
    obs.subscribe({
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
        this.error = err?.error?.message || 'Erreur lors de la sauvegarde du conteneur';
      }
    });
  }

  confirmDelete(c: any): void { this.containerToDelete = c; this.deleteModalOpen = true; }

  deleteContainer(): void {
    if (!this.containerToDelete) return;
    this.apiService.delete<any>(`containers/${this.containerToDelete.id}`).subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = 'Conteneur supprimé'; this.deleteModalOpen = false;
          this.containerToDelete = null; this.loadContainers(); this.clearMessages();
        }
      },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; this.deleteModalOpen = false; }
    });
  }

  viewContainerDetails(container: any): void {
    this.router.navigate(['/containers/detail', container.id]);
  }

  getPages(): number[] { const p: number[] = []; for (let i = 1; i <= this.totalPages; i++) p.push(i); return p; }

  private clearMessages(): void {
    setTimeout(() => { this.successMessage = null; this.error = null; this.cdr.detectChanges(); }, 3000);
  }
}
