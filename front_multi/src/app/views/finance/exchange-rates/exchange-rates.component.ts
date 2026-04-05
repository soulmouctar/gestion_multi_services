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
  selector: 'app-exchange-rates',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './exchange-rates.component.html'
})
export class ExchangeRatesComponent implements OnInit {
  exchangeRates: any[] = [];
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
  rateForm: FormGroup;
  selectedRate: any = null;
  deleteModalOpen = false;
  rateToDelete: any = null;
  Math = Math;

  constructor(private fb: FormBuilder, private apiService: ApiService, private cdr: ChangeDetectorRef) {
    this.rateForm = this.fb.group({
      currency_id: [null, Validators.required],
      rate: [null, [Validators.required, Validators.min(0)]],
      rate_date: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadExchangeRates();
    this.loadCurrencies();
  }

  loadCurrencies(): void {
    this.apiService.get<any>('currencies?per_page=100').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.currencies = Array.isArray(r.data) ? r.data : (r.data.data || []);
        }
      },
      error: () => { this.currencies = []; }
    });
  }

  loadExchangeRates(): void {
    this.loading = true;
    this.error = null;
    this.apiService.get<any>(`exchange-rates?page=${this.currentPage}`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const p = response.data;
          this.exchangeRates = p.data || [];
          this.currentPage = p.current_page || 1;
          this.totalPages = p.last_page || 1;
          this.totalItems = p.total || 0;
          this.itemsPerPage = p.per_page || 15;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Erreur lors du chargement des taux';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadExchangeRates();
  }

  openCreateModal(): void {
    this.editMode = false; this.submitted = false;
    this.rateForm.reset({ currency_id: null, rate: null, rate_date: '' });
    this.showFormModal = true;
  }

  openEditModal(rate: any): void {
    this.editMode = true; this.submitted = false; this.selectedRate = rate;
    this.rateForm.patchValue({
      currency_id: rate.currency_id,
      rate: rate.rate,
      rate_date: rate.rate_date ? rate.rate_date.substring(0, 10) : ''
    });
    this.showFormModal = true;
  }

  saveRate(): void {
    this.submitted = true;
    if (this.rateForm.invalid) return;
    const data = this.rateForm.value;
    const obs = this.editMode && this.selectedRate
      ? this.apiService.put<any>(`exchange-rates/${this.selectedRate.id}`, data)
      : this.apiService.post<any>('exchange-rates', data);
    obs.subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = this.editMode ? 'Taux mis à jour' : 'Taux créé';
          this.showFormModal = false; this.loadExchangeRates(); this.clearMessages();
        }
      },
      error: (err) => { this.error = err?.error?.message || 'Erreur lors de la sauvegarde'; }
    });
  }

  confirmDelete(rate: any): void { this.rateToDelete = rate; this.deleteModalOpen = true; }

  deleteRate(): void {
    if (!this.rateToDelete) return;
    this.apiService.delete<any>(`exchange-rates/${this.rateToDelete.id}`).subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = 'Taux supprimé'; this.deleteModalOpen = false;
          this.rateToDelete = null; this.loadExchangeRates(); this.clearMessages();
        }
      },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; this.deleteModalOpen = false; }
    });
  }

  getCurrencyName(id: number): string {
    const c = this.currencies.find(cur => cur.id === id);
    return c ? `${c.code} - ${c.name}` : `ID: ${id}`;
  }

  getPages(): number[] { const p: number[] = []; for (let i = 1; i <= this.totalPages; i++) p.push(i); return p; }

  private clearMessages(): void {
    setTimeout(() => { this.successMessage = null; this.error = null; this.cdr.detectChanges(); }, 3000);
  }
}
