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
  selector: 'app-finance-currencies',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './currencies.component.html'
})
export class FinanceCurrenciesComponent implements OnInit {
  currencies: any[] = [];
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
  currencyForm: FormGroup;
  selectedCurrency: any = null;
  deleteModalOpen = false;
  currencyToDelete: any = null;
  Math = Math;

  constructor(private fb: FormBuilder, private apiService: ApiService, private cdr: ChangeDetectorRef) {
    this.currencyForm = this.fb.group({
      code: ['', [Validators.required, Validators.maxLength(10)]],
      name: ['', [Validators.required, Validators.maxLength(100)]],
      symbol: ['', [Validators.maxLength(10)]],
      exchange_rate: [1],
      is_default: [false],
      is_active: [true]
    });
  }

  ngOnInit(): void { this.loadCurrencies(); }

  loadCurrencies(): void {
    this.loading = true;
    this.error = null;
    this.apiService.get<any>(`currencies?page=${this.currentPage}`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Handle both paginated and non-paginated responses
          if (Array.isArray(response.data)) {
            this.currencies = response.data;
            this.totalItems = response.data.length;
            this.totalPages = 1;
          } else {
            const p = response.data;
            this.currencies = p.data || [];
            this.currentPage = p.current_page || 1;
            this.totalPages = p.last_page || 1;
            this.totalItems = p.total || 0;
            this.itemsPerPage = p.per_page || 15;
          }
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => { this.error = 'Erreur lors du chargement des devises'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadCurrencies();
  }

  openCreateModal(): void {
    this.editMode = false; this.submitted = false;
    this.currencyForm.reset({ code: '', name: '', symbol: '', exchange_rate: 1, is_default: false, is_active: true });
    this.showFormModal = true;
  }

  openEditModal(currency: any): void {
    this.editMode = true; this.submitted = false; this.selectedCurrency = currency;
    this.currencyForm.patchValue(currency);
    this.showFormModal = true;
  }

  saveCurrency(): void {
    this.submitted = true;
    if (this.currencyForm.invalid) return;
    const data = this.currencyForm.value;
    const obs = this.editMode && this.selectedCurrency
      ? this.apiService.put<any>(`currencies/${this.selectedCurrency.id}`, data)
      : this.apiService.post<any>('currencies', data);
    obs.subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = this.editMode ? 'Devise mise à jour' : 'Devise créée';
          this.showFormModal = false; this.loadCurrencies(); this.clearMessages();
        }
      },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; }
    });
  }

  confirmDelete(c: any): void { this.currencyToDelete = c; this.deleteModalOpen = true; }

  deleteCurrency(): void {
    if (!this.currencyToDelete) return;
    this.apiService.delete<any>(`currencies/${this.currencyToDelete.id}`).subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = 'Devise supprimée'; this.deleteModalOpen = false;
          this.currencyToDelete = null; this.loadCurrencies(); this.clearMessages();
        }
      },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; this.deleteModalOpen = false; }
    });
  }

  getPages(): number[] { const p: number[] = []; for (let i = 1; i <= this.totalPages; i++) p.push(i); return p; }

  private clearMessages(): void {
    setTimeout(() => { this.successMessage = null; this.error = null; this.cdr.detectChanges(); }, 3000);
  }
}
