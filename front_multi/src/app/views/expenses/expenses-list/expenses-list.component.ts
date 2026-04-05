import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  ButtonModule, CardModule, FormModule, BadgeModule,
  ModalModule, SpinnerModule, ProgressModule, NavModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-expenses-list',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective, RouterModule,
    ButtonModule, CardModule, FormModule, BadgeModule,
    ModalModule, SpinnerModule, ProgressModule, NavModule
  ],
  templateUrl: './expenses-list.component.html'
})
export class ExpensesListComponent implements OnInit {

  expenses: any[]    = [];
  categories: any[]  = [];
  loading = false;

  // Pagination
  currentPage = 1; totalPages = 1; totalItems = 0;

  // Stats (month summary)
  monthStats: any = { total_count: 0, total_amount: 0, paid_amount: 0, pending_amount: 0 };

  // Filters
  filterForm: FormGroup;

  // Modal
  showModal = false;
  editMode  = false;
  submitted = false;
  selectedExpense: any = null;
  form: FormGroup;

  paymentMethods = [
    { value: 'ESPECES',      label: 'Espèces' },
    { value: 'VIREMENT',     label: 'Virement bancaire' },
    { value: 'CHEQUE',       label: 'Chèque' },
    { value: 'ORANGE_MONEY', label: 'Orange Money' },
    { value: 'MOBILE_MONEY', label: 'Mobile Money' },
    { value: 'CARTE',        label: 'Carte bancaire' }
  ];

  currencies = [
    { value: 'GNF', label: 'GNF' },
    { value: 'USD', label: 'USD' },
    { value: 'EUR', label: 'EUR' }
  ];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {
    this.filterForm = this.fb.group({
      category_id: [''],
      status:      [''],
      date_from:   [this.monthStart()],
      date_to:     [this.today()],
      search:      ['']
    });

    this.form = this.fb.group({
      title:             ['', [Validators.required, Validators.maxLength(200)]],
      amount:            [null, [Validators.required, Validators.min(0)]],
      currency:          ['GNF', Validators.required],
      expense_date:      [this.today(), Validators.required],
      category_id:       [null],
      payment_method:    ['ESPECES', Validators.required],
      status:            ['PAID', Validators.required],
      description:       [''],
      reference:         [''],
      is_recurring:      [false],
      recurrence_period: ['']
    });
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadExpenses();
    this.loadMonthStats();
  }

  loadCategories(): void {
    this.apiService.get<any>('personal-expense-categories').subscribe({
      next: (r) => {
        this.categories = r.success ? (Array.isArray(r.data) ? r.data : (r.data?.data || [])) : [];
      }
    });
  }

  loadExpenses(): void {
    this.loading = true;
    const f = this.filterForm.value;
    let url = `personal-expenses?page=${this.currentPage}&per_page=20`;
    if (f.category_id) url += `&category_id=${f.category_id}`;
    if (f.status)      url += `&status=${f.status}`;
    if (f.date_from)   url += `&date_from=${f.date_from}`;
    if (f.date_to)     url += `&date_to=${f.date_to}`;
    if (f.search)      url += `&search=${encodeURIComponent(f.search)}`;

    this.apiService.get<any>(url).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.expenses    = r.data.data || [];
          this.currentPage = r.data.current_page || 1;
          this.totalPages  = r.data.last_page || 1;
          this.totalItems  = r.data.total || 0;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  loadMonthStats(): void {
    const dateFrom = this.monthStart();
    const dateTo   = this.today();
    this.apiService.get<any>(`personal-expenses/statistics?date_from=${dateFrom}&date_to=${dateTo}`).subscribe({
      next: (r) => {
        if (r.success && r.data?.summary) {
          this.monthStats = r.data.summary;
          this.cdr.detectChanges();
        }
      }
    });
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadExpenses();
  }

  resetFilters(): void {
    this.filterForm.reset({ category_id: '', status: '', date_from: this.monthStart(), date_to: this.today(), search: '' });
    this.applyFilters();
  }

  onPageChange(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
    this.loadExpenses();
  }

  openNew(): void {
    this.editMode = false;
    this.submitted = false;
    this.selectedExpense = null;
    this.form.reset({ title: '', amount: null, currency: 'GNF', expense_date: this.today(), category_id: null, payment_method: 'ESPECES', status: 'PAID', description: '', reference: '', is_recurring: false, recurrence_period: '' });
    this.showModal = true;
  }

  openEdit(exp: any): void {
    this.editMode = true;
    this.submitted = false;
    this.selectedExpense = exp;
    this.form.patchValue({
      title:             exp.title,
      amount:            exp.amount,
      currency:          exp.currency,
      expense_date:      exp.expense_date?.split('T')[0] || exp.expense_date,
      category_id:       exp.category_id,
      payment_method:    exp.payment_method,
      status:            exp.status,
      description:       exp.description || '',
      reference:         exp.reference || '',
      is_recurring:      exp.is_recurring || false,
      recurrence_period: exp.recurrence_period || ''
    });
    this.showModal = true;
  }

  save(): void {
    this.submitted = true;
    if (this.form.invalid) return;

    const obs = this.editMode && this.selectedExpense
      ? this.apiService.put<any>(`personal-expenses/${this.selectedExpense.id}`, this.form.value)
      : this.apiService.post<any>('personal-expenses', this.form.value);

    obs.subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ icon: 'success', title: this.editMode ? 'Dépense modifiée' : 'Dépense enregistrée', timer: 1800, showConfirmButton: false });
          this.showModal = false;
          this.loadExpenses();
          this.loadMonthStats();
        }
      },
      error: (e) => Swal.fire({ icon: 'error', title: 'Erreur', text: e?.error?.message || 'Erreur' })
    });
  }

  delete(exp: any): void {
    Swal.fire({
      title: `Supprimer "${exp.title}" ?`,
      text: this.fmt(exp.amount, exp.currency),
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#d33', cancelButtonColor: '#6c757d',
      confirmButtonText: 'Supprimer', cancelButtonText: 'Annuler'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.apiService.delete<any>(`personal-expenses/${exp.id}`).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', timer: 1500, showConfirmButton: false, title: 'Supprimé' });
          this.loadExpenses();
          this.loadMonthStats();
        },
        error: () => Swal.fire({ icon: 'error', title: 'Impossible de supprimer' })
      });
    });
  }

  // ===== HELPERS =====
  getStatusColor(s: string): string {
    return { PAID: 'success', PENDING: 'warning', CANCELLED: 'secondary' }[s] || 'secondary';
  }
  getStatusLabel(s: string): string {
    return { PAID: 'Payée', PENDING: 'En attente', CANCELLED: 'Annulée' }[s] || s;
  }
  getMethodLabel(m: string): string {
    return this.paymentMethods.find(x => x.value === m)?.label || m;
  }
  getCategoryName(id: number): string {
    return this.categories.find(c => c.id === id)?.name || 'Sans catégorie';
  }
  getCategoryColor(id: number): string {
    return this.categories.find(c => c.id === id)?.color || '#6c757d';
  }
  fmt(v: number, currency = 'GNF'): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0 }).format(v || 0) + ' ' + currency;
  }
  getPages(): number[] { return Array.from({ length: this.totalPages }, (_, i) => i + 1); }
  private today(): string      { return new Date().toISOString().split('T')[0]; }
  private monthStart(): string { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; }
}
