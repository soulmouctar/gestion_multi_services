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
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-client-list',
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
  templateUrl: './client-list.component.html',
  styleUrls: ['./client-list.component.scss']
})
export class ClientListComponent implements OnInit {
  clients: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  itemsPerPage = 15;

  // Selection
  selectedClients: Set<number> = new Set();
  selectAll = false;

  // Modal
  showFormModal = false;
  editMode = false;
  submitted = false;
  clientForm: FormGroup;
  selectedClient: any = null;
  deleteModalOpen = false;
  clientToDelete: any = null;

  Math = Math;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) {
    this.clientForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(150)]],
      phone1: [''],
      phone2: ['']
    });
  }

  ngOnInit(): void {
    this.loadClients();
  }

  loadClients(): void {
    this.loading = true;
    this.error = null;

    this.apiService.get<any>(`clients?page=${this.currentPage}`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const paginated = response.data;
          this.clients = paginated.data || [];
          this.currentPage = paginated.current_page || 1;
          this.totalPages = paginated.last_page || 1;
          this.totalItems = paginated.total || 0;
          this.itemsPerPage = paginated.per_page || 15;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des clients';
        console.error('Error loading clients:', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadClients();
  }

  openCreateModal(): void {
    this.editMode = false;
    this.submitted = false;
    this.clientForm.reset({ name: '', phone1: '', phone2: '' });
    this.showFormModal = true;
  }

  openEditModal(client: any): void {
    this.editMode = true;
    this.submitted = false;
    this.selectedClient = client;
    this.clientForm.patchValue({
      name: client.name,
      phone1: client.phone1 || '',
      phone2: client.phone2 || ''
    });
    this.showFormModal = true;
  }

  saveClient(): void {
    this.submitted = true;
    if (this.clientForm.invalid) return;

    const data = {
      ...this.clientForm.value,
      tenant_id: 1 // Fixed for testing
    };

    console.log('Sending client data:', data);

    if (this.editMode && this.selectedClient) {
      this.apiService.put<any>(`clients/${this.selectedClient.id}`, data).subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = 'Client mis à jour avec succès';
            this.showFormModal = false;
            this.loadClients();
            this.clearMessages();
          }
        },
        error: (err) => {
          console.error('Client update error:', err);
          this.error = err?.error?.message || err?.message || 'Erreur lors de la mise à jour';
        }
      });
    } else {
      this.apiService.post<any>('clients-public', data).subscribe({
        next: (response) => {
          if (response.success) {
            this.successMessage = 'Client créé avec succès';
            this.showFormModal = false;
            this.loadClients();
            this.clearMessages();
          }
        },
        error: (err) => {
          console.error('Client creation error:', err);
          this.error = err?.error?.message || err?.message || 'Erreur lors de la création';
        }
      });
    }
  }

  confirmDelete(client: any): void {
    this.clientToDelete = client;
    this.deleteModalOpen = true;
  }

  deleteClient(): void {
    if (!this.clientToDelete) return;

    this.apiService.delete<any>(`clients/${this.clientToDelete.id}`).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = 'Client supprimé avec succès';
          this.deleteModalOpen = false;
          this.clientToDelete = null;
          this.loadClients();
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
      this.selectedClients.clear();
    } else {
      this.clients.forEach(c => this.selectedClients.add(c.id));
    }
    this.selectAll = !this.selectAll;
  }

  toggleClientSelection(id: number): void {
    if (this.selectedClients.has(id)) {
      this.selectedClients.delete(id);
    } else {
      this.selectedClients.add(id);
    }
    this.selectAll = this.selectedClients.size === this.clients.length;
  }

  isClientSelected(id: number): boolean {
    return this.selectedClients.has(id);
  }

  deleteSelectedClients(): void {
    if (this.selectedClients.size === 0) return;
    if (!confirm(`Supprimer ${this.selectedClients.size} client(s) ?`)) return;

    const ids = Array.from(this.selectedClients);
    let completed = 0;
    ids.forEach(id => {
      this.apiService.delete<any>(`clients/${id}`).subscribe({
        next: () => {
          completed++;
          if (completed === ids.length) {
            this.selectedClients.clear();
            this.selectAll = false;
            this.loadClients();
            this.successMessage = `${ids.length} client(s) supprimé(s)`;
            this.clearMessages();
          }
        },
        error: () => { completed++; }
      });
    });
  }

  trackByClientId(index: number, client: any): number {
    return client.id;
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
