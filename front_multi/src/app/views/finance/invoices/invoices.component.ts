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
  selector: 'app-invoices',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './invoices.component.html'
})
export class InvoicesComponent implements OnInit {
  invoices: any[] = [];
  clients: any[] = [];
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
  invoiceForm: FormGroup;
  selectedInvoice: any = null;
  deleteModalOpen = false;
  invoiceToDelete: any = null;
  Math = Math;

  constructor(private fb: FormBuilder, private apiService: ApiService, private cdr: ChangeDetectorRef) {
    this.invoiceForm = this.fb.group({
      client_id: [null, Validators.required],
      invoice_number: ['', Validators.required],
      total_amount: [0, [Validators.required, Validators.min(0)]],
      status: ['PENDING'],
      due_date: ['']
    });
  }

  ngOnInit(): void {
    this.loadInvoices();
    this.loadClients();
  }

  loadClients(): void {
    this.apiService.get<any>('clients?per_page=200').subscribe({
      next: (r) => { if (r.success && r.data) this.clients = r.data.data || []; }
    });
  }

  loadInvoices(): void {
    this.loading = true;
    this.error = null;
    this.apiService.get<any>(`invoices?page=${this.currentPage}`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const p = response.data;
          this.invoices = p.data || [];
          this.currentPage = p.current_page || 1;
          this.totalPages = p.last_page || 1;
          this.totalItems = p.total || 0;
          this.itemsPerPage = p.per_page || 15;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.error = 'Erreur lors du chargement des factures'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadInvoices();
  }

  openCreateModal(): void {
    this.editMode = false; this.submitted = false;
    this.invoiceForm.reset({ client_id: null, invoice_number: '', total_amount: 0, status: 'PENDING', due_date: '' });
    this.showFormModal = true;
  }

  openEditModal(invoice: any): void {
    this.editMode = true; this.submitted = false; this.selectedInvoice = invoice;
    this.invoiceForm.patchValue({
      client_id: invoice.client_id,
      invoice_number: invoice.invoice_number,
      total_amount: invoice.total_amount,
      status: invoice.status,
      due_date: invoice.due_date ? invoice.due_date.substring(0, 10) : ''
    });
    this.showFormModal = true;
  }

  saveInvoice(): void {
    this.submitted = true;
    if (this.invoiceForm.invalid) return;
    const data = this.invoiceForm.value;
    const obs = this.editMode && this.selectedInvoice
      ? this.apiService.put<any>(`invoices/${this.selectedInvoice.id}`, data)
      : this.apiService.post<any>('invoices', data);
    obs.subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = this.editMode ? 'Facture mise à jour' : 'Facture créée';
          this.showFormModal = false; this.loadInvoices(); this.clearMessages();
        }
      },
      error: (err) => { this.error = err?.error?.message || 'Erreur lors de la sauvegarde'; }
    });
  }

  confirmDelete(inv: any): void { this.invoiceToDelete = inv; this.deleteModalOpen = true; }

  deleteInvoice(): void {
    if (!this.invoiceToDelete) return;
    this.apiService.delete<any>(`invoices/${this.invoiceToDelete.id}`).subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = 'Facture supprimée'; this.deleteModalOpen = false;
          this.invoiceToDelete = null; this.loadInvoices(); this.clearMessages();
        }
      },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; this.deleteModalOpen = false; }
    });
  }

  getClientName(id: number): string {
    const c = this.clients.find(cl => cl.id === id);
    return c ? c.name : `ID: ${id}`;
  }

  getStatusClass(status: string): string {
    const m: {[k: string]: string} = { 'PENDING': 'warning', 'PAID': 'success', 'OVERDUE': 'danger', 'CANCELLED': 'secondary' };
    return m[status] || 'info';
  }

  getStatusLabel(status: string): string {
    const m: {[k: string]: string} = { 'PENDING': 'En attente', 'PAID': 'Payée', 'OVERDUE': 'En retard', 'CANCELLED': 'Annulée' };
    return m[status] || status;
  }

  getPages(): number[] { const p: number[] = []; for (let i = 1; i <= this.totalPages; i++) p.push(i); return p; }

  private clearMessages(): void {
    setTimeout(() => { this.successMessage = null; this.error = null; this.cdr.detectChanges(); }, 3000);
  }
}
