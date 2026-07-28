import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../../core/services/api.service';
import { AlertService } from '../../../../core/services/alert.service';

interface ClientOption {
  id: number;
  name: string;
  phone1?: string;
}

interface CurrencyAccount {
  id: number;
  currency: string;
  is_primary: boolean;
  label?: string;
}

const SUPPORTED_CURRENCIES = ['GNF', 'USD', 'EUR'] as const;
const PAYMENT_METHODS = [
  { value: 'ESPECES', label: 'Espèces' },
  { value: 'VIREMENT', label: 'Virement' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'WAVE', label: 'Wave' },
  { value: 'MTN_MONEY', label: 'MTN Money' },
] as const;

@Component({
  selector: 'app-payment-batch-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-batch-form.component.html',
  styleUrl: './payment-batch-form.component.scss',
})
export class PaymentBatchFormComponent implements OnChanges {
  private readonly destroyRef = inject(DestroyRef);

  @Input() visible = false;
  @Input() clientId: number | null = null;
  @Input() clientName: string | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<any>();

  readonly currencies = SUPPORTED_CURRENCIES;
  readonly methods = PAYMENT_METHODS;

  form: FormGroup;
  clients: ClientOption[] = [];
  currencyAccounts: CurrencyAccount[] = [];
  loadingClients = false;
  loadingAccounts = false;
  submitting = false;

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private alert: AlertService,
    private cdr: ChangeDetectorRef,
  ) {
    this.form = this.fb.group({
      client_id: [null, [Validators.required]],
      paid_by_client_id: [null],
      payment_date: [new Date().toISOString().split('T')[0], [Validators.required]],
      method: ['ESPECES', [Validators.required]],
      reference: [''],
      description: [''],
      entries: this.fb.array([this.buildEntry()]),
    });
  }

  get entries(): FormArray<FormGroup> {
    return this.form.get('entries') as FormArray<FormGroup>;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.resetForm();
      this.loadClients();
      if (this.clientId) {
        this.form.get('client_id')?.setValue(this.clientId);
        this.form.get('client_id')?.disable();
        this.loadCurrencyAccounts(this.clientId);
      } else {
        this.form.get('client_id')?.enable();
        this.loadClients();
      }
    }
  }

  private buildEntry(): FormGroup {
    return this.fb.group({
      amount: [null, [Validators.required, Validators.min(0.01)]],
      currency: ['GNF', [Validators.required]],
      target_currency: ['GNF'],
      target_account_id: [null],
      exchange_rate: [null],
    });
  }

  addEntry(): void {
    this.entries.push(this.buildEntry());
  }

  removeEntry(index: number): void {
    if (this.entries.length > 1) {
      this.entries.removeAt(index);
    }
  }

  resetForm(): void {
    this.form.reset({
      client_id: null,
      paid_by_client_id: null,
      payment_date: new Date().toISOString().split('T')[0],
      method: 'ESPECES',
      reference: '',
      description: '',
    });
    while (this.entries.length > 1) this.entries.removeAt(1);
    this.entries.at(0).reset({
      amount: null,
      currency: 'GNF',
      target_currency: 'GNF',
      target_account_id: null,
      exchange_rate: null,
    });
  }

  private loadClients(): void {
    this.loadingClients = true;
    this.api.getPaginated<ClientOption>('clients', { params: { per_page: 200 } })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r: any) => {
          const list = r?.data?.data || r?.data || [];
          this.clients = Array.isArray(list) ? list : [];
          this.loadingClients = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loadingClients = false; this.cdr.detectChanges(); },
      });
  }

  onClientChange(): void {
    const id = Number(this.form.get('client_id')?.value);
    if (id) this.loadCurrencyAccounts(id);
    else this.currencyAccounts = [];
  }

  private loadCurrencyAccounts(clientId: number): void {
    this.loadingAccounts = true;
    this.api.get<CurrencyAccount[]>(`clients/${clientId}/currency-accounts`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r: any) => {
          this.currencyAccounts = r?.data || [];
          this.loadingAccounts = false;
          this.cdr.detectChanges();
        },
        error: () => { this.currencyAccounts = []; this.loadingAccounts = false; this.cdr.detectChanges(); },
      });
  }

  fmtNumber(v: number): string {
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v || 0);
  }

  totalsByCurrency(): { currency: string; total: number }[] {
    const map = new Map<string, number>();
    for (const grp of this.entries.controls) {
      const currency = String(grp.get('currency')?.value || 'GNF');
      const amount = Number(grp.get('amount')?.value || 0);
      map.set(currency, (map.get(currency) || 0) + amount);
    }
    return Array.from(map.entries()).map(([currency, total]) => ({ currency, total }));
  }

  needsExchangeRate(entry: FormGroup): boolean {
    const currency = String(entry.get('currency')?.value || 'GNF');
    const target = String(entry.get('target_currency')?.value || currency);
    return currency !== target;
  }

  close(): void {
    if (this.submitting) return;
    this.visible = false;
    this.visibleChange.emit(false);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    for (const grp of this.entries.controls) {
      if (this.needsExchangeRate(grp) && !Number(grp.get('exchange_rate')?.value)) {
        this.alert.showWarning('Taux de change requis', 'Renseigne un taux de change pour chaque ligne convertie.');
        return;
      }
    }

    const raw = this.form.getRawValue();
    const payload = {
      type: 'CLIENT',
      method: raw.method,
      payment_date: raw.payment_date,
      client_id: raw.client_id,
      paid_by_client_id: raw.paid_by_client_id || null,
      reference: raw.reference || null,
      description: raw.description || null,
      entries: raw.entries.map((e: any) => ({
        amount: Number(e.amount),
        currency: e.currency,
        target_currency: e.target_currency || e.currency,
        target_account_id: e.target_account_id || null,
        exchange_rate: e.exchange_rate ? Number(e.exchange_rate) : null,
      })),
    };

    this.submitting = true;
    this.cdr.detectChanges();
    this.api.post<any>('payments/batch', payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r: any) => {
          this.submitting = false;
          if (r?.success) {
            this.alert.showSuccess('Versement enregistré');
            this.saved.emit(r.data);
            this.close();
          } else {
            this.alert.showError('Erreur', r?.message || 'Erreur lors de l\'enregistrement.');
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.submitting = false;
          const msg = err?.error?.message || err?.message || 'Erreur lors de l\'enregistrement du versement.';
          this.alert.showError('Erreur', msg);
          this.cdr.detectChanges();
        },
      });
  }

  trackByIndex(i: number): number { return i; }
  trackByAcc(_i: number, a: CurrencyAccount): number { return a.id; }
  trackByClient(_i: number, c: ClientOption): number { return c.id; }
}
