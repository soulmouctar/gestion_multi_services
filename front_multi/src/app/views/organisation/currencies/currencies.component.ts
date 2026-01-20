import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { 
  CardModule, 
  ButtonModule, 
  TableModule, 
  ModalModule, 
  FormModule, 
  BadgeModule,
  SpinnerModule,
  AlertModule,
  GridModule 
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

interface Currency {
  id?: number;
  code: string;
  name: string;
  symbol: string;
  exchange_rate: number;
  is_default: boolean;
  is_active: boolean;
}

@Component({
  selector: 'app-currencies',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    TableModule,
    ModalModule,
    FormModule,
    BadgeModule,
    SpinnerModule,
    AlertModule,
    GridModule,
    IconDirective
  ],
  templateUrl: './currencies.component.html',
  styleUrls: ['./currencies.component.scss']
})
export class CurrenciesComponent implements OnInit {
  currencyForm: FormGroup;
  currencies: Currency[] = [];
  loading = false;
  saving = false;
  editingCurrency: Currency | null = null;
  showModal = false;

  commonCurrencies = [
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'USD', name: 'Dollar américain', symbol: '$' },
    { code: 'GBP', name: 'Livre sterling', symbol: '£' },
    { code: 'CHF', name: 'Franc suisse', symbol: 'CHF' },
    { code: 'CAD', name: 'Dollar canadien', symbol: 'C$' },
    { code: 'JPY', name: 'Yen japonais', symbol: '¥' },
    { code: 'CNY', name: 'Yuan chinois', symbol: '¥' },
    { code: 'AUD', name: 'Dollar australien', symbol: 'A$' }
  ];

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.currencyForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
      name: ['', [Validators.required, Validators.minLength(2)]],
      symbol: ['', [Validators.required, Validators.minLength(1)]],
      exchange_rate: [1, [Validators.required, Validators.min(0.0001)]],
      is_default: [false],
      is_active: [true]
    });
  }

  ngOnInit(): void {
    this.loadCurrencies();
  }

  loadCurrencies(): void {
    this.loading = true;
    // Simulate API call
    setTimeout(() => {
      this.currencies = [
        {
          id: 1,
          code: 'EUR',
          name: 'Euro',
          symbol: '€',
          exchange_rate: 1,
          is_default: true,
          is_active: true
        },
        {
          id: 2,
          code: 'USD',
          name: 'Dollar américain',
          symbol: '$',
          exchange_rate: 1.08,
          is_default: false,
          is_active: true
        }
      ];
      this.loading = false;
    }, 1000);
  }

  openModal(currency?: Currency): void {
    this.editingCurrency = currency || null;
    if (currency) {
      this.currencyForm.patchValue(currency);
    } else {
      this.currencyForm.reset({
        exchange_rate: 1,
        is_default: false,
        is_active: true
      });
    }
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingCurrency = null;
    this.currencyForm.reset();
  }

  selectCommonCurrency(currency: any): void {
    this.currencyForm.patchValue({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol
    });
  }

  onSubmit(): void {
    if (this.currencyForm.valid) {
      this.saving = true;
      const formData = this.currencyForm.value;
      
      // Ensure code is uppercase
      formData.code = formData.code.toUpperCase();
      
      // Simulate API call
      setTimeout(() => {
        if (this.editingCurrency) {
          // Update existing currency
          const index = this.currencies.findIndex(c => c.id === this.editingCurrency!.id);
          if (index !== -1) {
            this.currencies[index] = { ...this.editingCurrency, ...formData };
          }
        } else {
          // Add new currency
          const newCurrency: Currency = {
            id: Date.now(),
            ...formData
          };
          this.currencies.push(newCurrency);
        }
        
        // If setting as default, remove default from others
        if (formData.is_default) {
          this.currencies.forEach(c => {
            if (c.id !== (this.editingCurrency?.id || Date.now())) {
              c.is_default = false;
            }
          });
        }
        
        this.saving = false;
        this.closeModal();
      }, 1000);
    }
  }

  setAsDefault(currency: Currency): void {
    // Remove default from all currencies
    this.currencies.forEach(c => c.is_default = false);
    // Set this currency as default
    currency.is_default = true;
  }

  toggleStatus(currency: Currency): void {
    if (currency.is_default && !currency.is_active) {
      alert('Impossible de désactiver la devise par défaut');
      return;
    }
    currency.is_active = !currency.is_active;
  }

  deleteCurrency(currency: Currency): void {
    if (currency.is_default) {
      alert('Impossible de supprimer la devise par défaut');
      return;
    }
    
    if (confirm(`Êtes-vous sûr de vouloir supprimer la devise "${currency.name}" ?`)) {
      this.currencies = this.currencies.filter(c => c.id !== currency.id);
    }
  }

  get f() {
    return this.currencyForm.controls;
  }
}
