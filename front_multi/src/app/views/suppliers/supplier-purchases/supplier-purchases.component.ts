import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { SpinnerModule, AlertModule } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

interface Purchase {
  id: number;
  purchase_number: string;
  supplier?: { id: number; name: string };
  supplier_id: number;
  category: string;
  designation: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  currency: string;
  total_amount_gnf: number;
  purchase_date: string;
  reference: string | null;
}

@Component({
  selector: 'app-supplier-purchases',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, SpinnerModule, AlertModule, IconDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './supplier-purchases.component.html',
  styleUrl: './supplier-purchases.component.scss'
})
export class SupplierPurchasesComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  loading = true;
  saving = false;
  error: string | null = null;
  success: string | null = null;

  rows: Purchase[] = [];
  suppliers: { id: number; name: string; category?: string }[] = [];

  showForm = false;
  form: FormGroup;

  /** Memes libelles que les types clients, pour rester coherent. */
  readonly categories = [
    { value: 'TEXTILE', label: 'Textile' },
    { value: 'COSMETIQUES', label: 'Cosmétiques' },
    { value: 'PNEUS', label: 'Pneus' },
    { value: 'MACHINE_A_COUDRE', label: 'Machine à coudre' },
    { value: 'AUTRE', label: 'Autre' },
  ];

  filterSupplier = '';
  filterCategory = '';
  from = '';
  to = '';

  constructor(private api: ApiService, private fb: FormBuilder, private cdr: ChangeDetectorRef) {
    this.form = this.fb.group({
      supplier_id:   [null, Validators.required],
      designation:   ['', [Validators.required, Validators.maxLength(255)]],
      category:      ['AUTRE'],
      quantity:      [1, [Validators.required, Validators.min(0.01)]],
      unit_price:    [0, [Validators.required, Validators.min(0)]],
      currency:      ['GNF', Validators.required],
      exchange_rate: [null],
      purchase_date: [new Date().toISOString().slice(0, 10), Validators.required],
      reference:     [''],
      notes:         [''],
    });
  }

  ngOnInit(): void {
    this.loadSuppliers();
    this.load();
  }

  private loadSuppliers(): void {
    this.api.get<any>('suppliers?per_page=200')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r: any) => {
          const d = r?.data;
          this.suppliers = Array.isArray(d) ? d : (d?.data ?? []);
          this.cdr.markForCheck();
        },
        error: () => { /* la liste reste vide, le formulaire le signalera */ }
      });
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    const qs: string[] = [];
    if (this.filterSupplier) qs.push(`supplier_id=${this.filterSupplier}`);
    if (this.filterCategory) qs.push(`category=${this.filterCategory}`);
    if (this.from) qs.push(`from=${this.from}`);
    if (this.to) qs.push(`to=${this.to}`);

    this.api.get<any>(`supplier-purchases${qs.length ? '?' + qs.join('&') : ''}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r: any) => {
          const d = r?.data;
          this.rows = d?.data ?? (Array.isArray(d) ? d : []);
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (e: any) => {
          this.error = e?.error?.message || 'Impossible de charger les achats';
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  openForm(): void {
    this.success = null;
    this.error = null;
    this.showForm = true;
    this.cdr.markForCheck();
  }

  closeForm(): void {
    this.showForm = false;
    this.form.reset({
      supplier_id: null, designation: '', category: 'AUTRE', quantity: 1, unit_price: 0,
      currency: 'GNF', exchange_rate: null,
      purchase_date: new Date().toISOString().slice(0, 10), reference: '', notes: ''
    });
    this.cdr.markForCheck();
  }

  /** Total affiché en direct : évite de saisir un montant incohérent. */
  get computedTotal(): number {
    return Number(this.form.value.quantity || 0) * Number(this.form.value.unit_price || 0);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    this.saving = true;
    this.error = null;
    this.cdr.markForCheck();

    const { supplier_id, ...payload } = this.form.value;

    this.api.post<any>(`suppliers/${supplier_id}/purchases`, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r: any) => {
          this.saving = false;
          this.success = `Achat ${r?.data?.purchase_number ?? ''} enregistré et porté au compte du fournisseur.`;
          this.closeForm();
          this.load();
        },
        error: (e: any) => {
          this.saving = false;
          this.error = e?.error?.message || 'Enregistrement impossible';
          this.cdr.markForCheck();
        }
      });
  }

  remove(row: Purchase): void {
    if (!confirm(`Supprimer l'achat ${row.purchase_number} ? Le montant sera retiré du compte du fournisseur.`)) return;

    this.api.delete<any>(`supplier-purchases/${row.id}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.success = 'Achat supprimé.'; this.load(); },
        error: (e: any) => { this.error = e?.error?.message || 'Suppression impossible'; this.cdr.markForCheck(); }
      });
  }

  categoryLabel(v: string): string {
    return this.categories.find(c => c.value === v)?.label ?? v;
  }

  fmt(v: number | null | undefined): string {
    return new Intl.NumberFormat('fr-FR').format(Math.round(Number(v || 0)));
  }

  trackRow(_i: number, r: Purchase) { return r.id; }
}
