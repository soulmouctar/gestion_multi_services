import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ContactService, Contact, ContactType } from '../../../core/services/contact.service';
import { AuthService } from '../../../core/services/auth.service';
import { 
  CardModule, 
  ButtonModule, 
  FormModule, 
  ModalModule, 
  TableModule, 
  BadgeModule,
  SpinnerModule,
  AlertModule,
  GridModule 
} from '@coreui/angular';
import { IconModule } from '@coreui/icons-angular';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-contacts',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    FormModule,
    ModalModule,
    TableModule,
    BadgeModule,
    SpinnerModule,
    AlertModule,
    GridModule,
    IconModule
  ],
  templateUrl: './contacts.component.html',
  styleUrls: ['./contacts.component.scss']
})
export class ContactsComponent implements OnInit {
  contactForm: FormGroup;
  contacts: Contact[] = [];
  contactTypes: { [key: string]: string } = {};
  loading = false;
  saving = false;
  editingContact: Contact | null = null;
  showModal = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private contactService: ContactService,
    private cdr: ChangeDetectorRef
  ) {
    this.contactForm = this.fb.group({
      type: ['phone', Validators.required],
      name: ['', [Validators.required, Validators.minLength(2)]],
      value: ['', [Validators.required]],
      email: ['', [Validators.email]],
      phone: [''],
      address: [''],
      city: [''],
      postal_code: [''],
      country: [''],
      description: [''],
      is_default: [false],
      is_active: [true]
    });
  }

  ngOnInit(): void {
    this.loadContactTypes();
    this.loadContacts();
  }

  loadContactTypes(): void {
    this.contactService.getContactTypes().subscribe({
      next: (response) => {
        setTimeout(() => {
          if (response.success) {
            this.contactTypes = response.data;
          }
          this.cdr.detectChanges();
        }, 0);
      },
      error: (error) => {
        setTimeout(() => {
          console.error('Error loading contact types:', error);
          this.contactService.showErrorMessage('Erreur lors du chargement des types de contact');
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  loadContacts(): void {
    this.loading = true;
    this.contactService.getContacts({ active: true }).subscribe({
      next: (response) => {
        setTimeout(() => {
          if (response.success) {
            this.contacts = response.data?.data || response.data || [];
          }
          this.loading = false;
          this.cdr.detectChanges();
        }, 0);
      },
      error: (error) => {
        setTimeout(() => {
          console.error('Error loading contacts:', error);
          this.contactService.showErrorMessage('Erreur lors du chargement des contacts');
          this.loading = false;
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  openModal(contact?: Contact): void {
    this.editingContact = contact || null;
    
    if (contact) {
      this.contactForm.patchValue({
        type: contact.type,
        name: contact.name,
        value: contact.value,
        description: contact.description || '',
        is_default: contact.is_default,
        is_active: contact.is_active
      });
    } else {
      this.contactForm.reset({
        type: 'phone',
        name: '',
        value: '',
        description: '',
        is_default: false,
        is_active: true
      });
    }
    
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingContact = null;
    this.contactForm.reset();
  }

  onSubmit(): void {
    if (this.contactForm.valid) {
      this.saving = true;
      const contactData = this.contactForm.value;

      if (this.editingContact) {
        // Update existing contact
        this.contactService.updateContact(this.editingContact.id!, contactData).subscribe({
          next: (response) => {
            if (response.success) {
              this.loadContacts();
              this.closeModal();
            }
            this.saving = false;
          },
          error: (error) => {
            console.error('Error updating contact:', error);
            this.contactService.showErrorMessage('Erreur lors de la mise à jour du contact');
            this.saving = false;
          }
        });
      } else {
        // Create new contact
        this.contactService.createContact(contactData).subscribe({
          next: (response) => {
            if (response.success) {
              this.loadContacts();
              this.closeModal();
            }
            this.saving = false;
          },
          error: (error) => {
            console.error('Error creating contact:', error);
            this.contactService.showErrorMessage('Erreur lors de la création du contact');
            this.saving = false;
          }
        });
      }
    }
  }

  setAsDefault(contact: Contact): void {
    this.contactService.setAsDefault(contact.id!).subscribe({
      next: (response) => {
        if (response.success) {
          // Update local contacts array
          this.contacts.forEach(c => {
            c.is_default = c.id === contact.id && c.type === contact.type;
          });
          Swal.fire({
            icon: 'success',
            title: 'Succès',
            text: 'Contact défini comme par défaut.',
            confirmButtonColor: '#28a745'
          });
        }
      },
      error: (error) => {
        console.error('Error setting contact as default:', error);
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: 'Impossible de définir le contact comme par défaut.',
          confirmButtonColor: '#dc3545'
        });
      }
    });
  }

  deleteContact(contact: Contact): void {
    this.contactService.showDeleteConfirmation(contact.name).then((result) => {
      if (result.isConfirmed) {
        this.contactService.deleteContact(contact.id!).subscribe({
          next: (response) => {
            if (response.success) {
              this.loadContacts();
            }
          },
          error: (error) => {
            console.error('Error deleting contact:', error);
            this.contactService.showErrorMessage('Erreur lors de la suppression du contact');
          }
        });
      }
    });
  }

  getContactTypeLabel(type: string): string {
    return this.contactTypes[type] || type;
  }

  getContactTypeIcon(type: string): string {
    const iconMap: { [key: string]: string } = {
      'phone': 'cilPhone',
      'email': 'cilEnvelopeClosed',
      'address': 'cilLocationPin',
      'website': 'cilGlobeAlt',
      'fax': 'cilPrint',
      'whatsapp': 'cilPhone',
      'telegram': 'cilChat'
    };
    return iconMap[type] || 'cilUser';
  }

  get f() {
    return this.contactForm?.controls || {};
  }
}
