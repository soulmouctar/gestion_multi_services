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

interface Contact {
  id?: number;
  type: 'primary' | 'billing' | 'shipping' | 'support';
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

@Component({
  selector: 'app-contacts',
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
  templateUrl: './contacts.component.html',
  styleUrls: ['./contacts.component.scss']
})
export class ContactsComponent implements OnInit {
  contactForm: FormGroup;
  contacts: Contact[] = [];
  loading = false;
  saving = false;
  editingContact: Contact | null = null;
  showModal = false;

  contactTypes = [
    { value: 'primary', label: 'Contact Principal', icon: 'cilUser' },
    { value: 'billing', label: 'Facturation', icon: 'cilCreditCard' },
    { value: 'shipping', label: 'Livraison', icon: 'cilTruck' },
    { value: 'support', label: 'Support', icon: 'cilSupport' }
  ];

  constructor(private fb: FormBuilder, private cdr: ChangeDetectorRef) {
    this.contactForm = this.fb.group({
      type: ['primary', Validators.required],
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      address: ['', Validators.required],
      city: ['', Validators.required],
      postal_code: ['', Validators.required],
      country: ['France', Validators.required],
      is_default: [false]
    });
  }

  ngOnInit(): void {
    this.loadContacts();
  }

  loadContacts(): void {
    this.loading = true;
    // Simulate API call
    setTimeout(() => {
      this.contacts = [
        {
          id: 1,
          type: 'primary',
          name: 'Jean Dupont',
          email: 'jean.dupont@entreprise.com',
          phone: '+33 1 23 45 67 89',
          address: '123 Rue de la Paix',
          city: 'Paris',
          postal_code: '75001',
          country: 'France',
          is_default: true
        }
      ];
      this.loading = false;
    }, 1000);
  }

  openModal(contact?: Contact): void {
    this.editingContact = contact || null;
    if (contact) {
      this.contactForm.patchValue(contact);
    } else {
      this.contactForm.reset({
        type: 'primary',
        country: 'France',
        is_default: false
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
      const formData = this.contactForm.value;
      
      // Simulate API call
      setTimeout(() => {
        if (this.editingContact) {
          // Update existing contact
          const index = this.contacts.findIndex(c => c.id === this.editingContact!.id);
          if (index !== -1) {
            this.contacts[index] = { ...this.editingContact, ...formData };
          }
        } else {
          // Add new contact
          const newContact: Contact = {
            id: Date.now(),
            ...formData
          };
          this.contacts.push(newContact);
        }
        
        this.saving = false;
        this.closeModal();
      }, 1000);
    }
  }

  deleteContact(contact: Contact): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le contact "${contact.name}" ?`)) {
      this.contacts = this.contacts.filter(c => c.id !== contact.id);
    }
  }

  setAsDefault(contact: Contact): void {
    // Remove default from all contacts
    this.contacts.forEach(c => c.is_default = false);
    // Set this contact as default
    contact.is_default = true;
  }

  getContactTypeLabel(type: string): string {
    const contactType = this.contactTypes.find(ct => ct.value === type);
    return contactType ? contactType.label : type;
  }

  getContactTypeIcon(type: string): string {
    const contactType = this.contactTypes.find(ct => ct.value === type);
    return contactType ? contactType.icon : 'cilUser';
  }

  get f() {
    return this.contactForm.controls;
  }
}
