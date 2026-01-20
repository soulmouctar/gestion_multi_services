import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { 
  CardModule, 
  ButtonModule, 
  ModalModule, 
  FormModule, 
  BadgeModule, 
  SpinnerModule,
  AlertModule,
  GridModule 
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

interface InvoiceHeader {
  id?: number;
  name: string;
  logo_url?: string;
  company_name: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  phone: string;
  email: string;
  website?: string;
  tax_number?: string;
  registration_number?: string;
  bank_details?: string;
  footer_text?: string;
  is_default: boolean;
}

@Component({
  selector: 'app-invoice-headers',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    ModalModule,
    FormModule,
    BadgeModule,
    SpinnerModule,
    AlertModule,
    GridModule,
    IconDirective
  ],
  templateUrl: './invoice-headers.component.html',
  styleUrls: ['./invoice-headers.component.scss']
})
export class InvoiceHeadersComponent implements OnInit {
  headerForm: FormGroup;
  headers: InvoiceHeader[] = [];
  loading = false;
  saving = false;
  editingHeader: InvoiceHeader | null = null;
  showModal = false;
  previewMode = false;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.headerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      logo_url: [''],
      company_name: ['', Validators.required],
      address: ['', Validators.required],
      city: ['', Validators.required],
      postal_code: ['', Validators.required],
      country: ['France', Validators.required],
      phone: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      website: [''],
      tax_number: [''],
      registration_number: [''],
      bank_details: [''],
      footer_text: [''],
      is_default: [false]
    });
  }

  ngOnInit(): void {
    this.loadHeaders();
  }

  loadHeaders(): void {
    this.loading = true;
    // Simulate API call
    setTimeout(() => {
      this.headers = [
        {
          id: 1,
          name: 'En-tête Standard',
          company_name: 'SAAR AUTO INDUSTRIE',
          address: '123 Rue de la Paix',
          city: 'Paris',
          postal_code: '75001',
          country: 'France',
          phone: '+33 1 23 45 67 89',
          email: 'contact@saar-auto.com',
          website: 'www.saar-auto.com',
          tax_number: 'FR12345678901',
          registration_number: '12345678901234',
          bank_details: 'IBAN: FR76 1234 5678 9012 3456 7890 123\nBIC: ABCDEFGH',
          footer_text: 'Merci de votre confiance',
          is_default: true
        }
      ];
      this.loading = false;
    }, 1000);
  }

  openModal(header?: InvoiceHeader): void {
    this.editingHeader = header || null;
    this.previewMode = false;
    if (header) {
      this.headerForm.patchValue(header);
    } else {
      this.headerForm.reset({
        country: 'France',
        is_default: false
      });
    }
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingHeader = null;
    this.previewMode = false;
    this.headerForm.reset();
  }

  togglePreview(): void {
    this.previewMode = !this.previewMode;
  }

  onSubmit(): void {
    if (this.headerForm.valid) {
      this.saving = true;
      const formData = this.headerForm.value;
      
      // Simulate API call
      setTimeout(() => {
        if (this.editingHeader) {
          // Update existing header
          const index = this.headers.findIndex(h => h.id === this.editingHeader!.id);
          if (index !== -1) {
            this.headers[index] = { ...this.editingHeader, ...formData };
          }
        } else {
          // Add new header
          const newHeader: InvoiceHeader = {
            id: Date.now(),
            ...formData
          };
          this.headers.push(newHeader);
        }
        
        // If setting as default, remove default from others
        if (formData.is_default) {
          this.headers.forEach(h => {
            if (h.id !== (this.editingHeader?.id || Date.now())) {
              h.is_default = false;
            }
          });
        }
        
        this.saving = false;
        this.closeModal();
      }, 1000);
    }
  }

  setAsDefault(header: InvoiceHeader): void {
    // Remove default from all headers
    this.headers.forEach(h => h.is_default = false);
    // Set this header as default
    header.is_default = true;
  }

  deleteHeader(header: InvoiceHeader): void {
    if (header.is_default) {
      alert('Impossible de supprimer l\'en-tête par défaut');
      return;
    }
    
    if (confirm(`Êtes-vous sûr de vouloir supprimer l'en-tête "${header.name}" ?`)) {
      this.headers = this.headers.filter(h => h.id !== header.id);
    }
  }

  duplicateHeader(header: InvoiceHeader): void {
    const duplicate: InvoiceHeader = {
      ...header,
      id: Date.now(),
      name: `${header.name} (Copie)`,
      is_default: false
    };
    this.headers.push(duplicate);
  }

  get f() {
    return this.headerForm.controls;
  }

  get previewData() {
    return this.headerForm.value;
  }
}
