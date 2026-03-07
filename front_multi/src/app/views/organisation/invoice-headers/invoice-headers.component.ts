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
import { InvoiceHeaderService, InvoiceHeader } from '../../../core/services/invoice-header.service';
import Swal from 'sweetalert2';

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
    private cdr: ChangeDetectorRef,
    private invoiceHeaderService: InvoiceHeaderService
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
    this.invoiceHeaderService.getHeaders().subscribe({
      next: (response) => {
        if (response.success) {
          this.headers = response.data;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading headers:', error);
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: 'Impossible de charger les en-têtes de factures.',
          confirmButtonColor: '#dc3545'
        });
        this.loading = false;
      }
    });
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
      
      if (this.editingHeader) {
        // Update existing header
        this.invoiceHeaderService.updateHeader(this.editingHeader.id!, formData).subscribe({
          next: (response) => {
            if (response.success) {
              const index = this.headers.findIndex(h => h.id === this.editingHeader!.id);
              if (index !== -1) {
                this.headers[index] = response.data;
              }
              this.saving = false;
              this.closeModal();
              Swal.fire({
                icon: 'success',
                title: 'Succès',
                text: 'En-tête mis à jour avec succès!',
                confirmButtonColor: '#28a745'
              });
            }
          },
          error: (error) => {
            console.error('Error updating header:', error);
            this.saving = false;
            Swal.fire({
              icon: 'error',
              title: 'Erreur',
              text: 'Impossible de mettre à jour l\'en-tête.',
              confirmButtonColor: '#dc3545'
            });
          }
        });
      } else {
        // Create new header
        this.invoiceHeaderService.createHeader(formData).subscribe({
          next: (response) => {
            if (response.success) {
              this.headers.push(response.data);
              this.saving = false;
              this.closeModal();
              Swal.fire({
                icon: 'success',
                title: 'Succès',
                text: 'En-tête créé avec succès!',
                confirmButtonColor: '#28a745'
              });
            }
          },
          error: (error) => {
            console.error('Error creating header:', error);
            this.saving = false;
            Swal.fire({
              icon: 'error',
              title: 'Erreur',
              text: 'Impossible de créer l\'en-tête.',
              confirmButtonColor: '#dc3545'
            });
          }
        });
      }
    }
  }

  setAsDefault(header: InvoiceHeader): void {
    this.invoiceHeaderService.setAsDefault(header.id!).subscribe({
      next: (response) => {
        if (response.success) {
          // Update local headers array
          this.headers.forEach(h => {
            h.is_default = h.id === header.id;
          });
          Swal.fire({
            icon: 'success',
            title: 'Succès',
            text: 'En-tête défini comme par défaut.',
            confirmButtonColor: '#28a745'
          });
        }
      },
      error: (error) => {
        console.error('Error setting header as default:', error);
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: 'Impossible de définir l\'en-tête comme par défaut.',
          confirmButtonColor: '#dc3545'
        });
      }
    });
  }

  deleteHeader(header: InvoiceHeader): void {
    Swal.fire({
      title: 'Êtes-vous sûr?',
      text: `Voulez-vous vraiment supprimer l'en-tête "${header.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler'
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.invoiceHeaderService.deleteHeader(header.id!).subscribe({
          next: (response) => {
            if (response.success) {
              this.headers = this.headers.filter(h => h.id !== header.id);
              Swal.fire({
                icon: 'success',
                title: 'Supprimé!',
                text: 'L\'en-tête a été supprimé.',
                confirmButtonColor: '#28a745'
              });
            }
          },
          error: (error) => {
            console.error('Error deleting header:', error);
            let errorMessage = 'Impossible de supprimer l\'en-tête.';
            if (error.status === 400) {
              errorMessage = 'Impossible de supprimer le seul en-tête de facture.';
            }
            Swal.fire({
              icon: 'error',
              title: 'Erreur',
              text: errorMessage,
              confirmButtonColor: '#dc3545'
            });
          }
        });
      }
    });
  }

  duplicateHeader(header: InvoiceHeader): void {
    this.invoiceHeaderService.duplicateHeader(header.id!).subscribe({
      next: (response) => {
        if (response.success) {
          this.headers.push(response.data);
          Swal.fire({
            icon: 'success',
            title: 'Succès',
            text: 'En-tête dupliqué avec succès!',
            confirmButtonColor: '#28a745'
          });
        }
      },
      error: (error) => {
        console.error('Error duplicating header:', error);
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: 'Impossible de dupliquer l\'en-tête.',
          confirmButtonColor: '#dc3545'
        });
      }
    });
  }

  get f() {
    return this.headerForm.controls;
  }

  get previewData() {
    return this.headerForm.value;
  }
}
