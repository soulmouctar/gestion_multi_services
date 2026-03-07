import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup } from '@angular/forms';
import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-organisation-settings-advanced',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './organisation-settings-advanced.component.html'
})
export class OrganisationSettingsAdvancedComponent implements OnInit {
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  
  // Settings Options
  settingsOptions: any = null;
  optionsLoading = false;
  
  // Next Numbers
  nextInvoiceNumber: string = '';
  nextQuoteNumber: string = '';
  numbersLoading = false;
  
  // Test Notifications
  testNotificationForm: FormGroup;
  testLoading = false;

  constructor(private fb: FormBuilder, private apiService: ApiService, private cdr: ChangeDetectorRef) {
    this.testNotificationForm = this.fb.group({
      type: ['email'],
      recipient: [''],
      message: ['Test de notification depuis les paramètres avancés']
    });
  }

  ngOnInit(): void {
    this.loadSettingsOptions();
    this.loadNextNumbers();
  }

  // Settings Options
  loadSettingsOptions(): void {
    this.optionsLoading = true;
    this.apiService.get<any>('organisation-settings/options').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.settingsOptions = r.data;
        }
        this.optionsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.optionsLoading = false;
        console.error('Erreur lors du chargement des options');
      }
    });
  }

  // Next Numbers
  loadNextNumbers(): void {
    this.numbersLoading = true;
    
    // Load next invoice number
    this.apiService.get<any>('organisation-settings/next-invoice-number').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.nextInvoiceNumber = r.data.next_number || 'N/A';
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.nextInvoiceNumber = 'Erreur';
      }
    });
    
    // Load next quote number
    this.apiService.get<any>('organisation-settings/next-quote-number').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.nextQuoteNumber = r.data.next_number || 'N/A';
        }
        this.numbersLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.nextQuoteNumber = 'Erreur';
        this.numbersLoading = false;
      }
    });
  }

  // Test Notifications
  testNotifications(): void {
    if (this.testNotificationForm.invalid) return;
    
    this.testLoading = true;
    const data = this.testNotificationForm.value;
    
    this.apiService.post<any>('organisation-settings/test-notifications', data).subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = 'Test de notification envoyé avec succès';
          this.clearMessages();
        }
        this.testLoading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur lors de l\'envoi du test';
        this.testLoading = false;
        this.clearMessages();
      }
    });
  }

  refreshData(): void {
    this.loadSettingsOptions();
    this.loadNextNumbers();
  }

  getOptionValue(option: any): string {
    if (typeof option === 'boolean') {
      return option ? 'Activé' : 'Désactivé';
    }
    if (typeof option === 'object' && option !== null) {
      return JSON.stringify(option);
    }
    return option?.toString() || 'N/A';
  }

  getOptionColor(option: any): string {
    if (typeof option === 'boolean') {
      return option ? 'success' : 'secondary';
    }
    return 'primary';
  }

  private clearMessages(): void {
    setTimeout(() => {
      this.successMessage = null;
      this.error = null;
      this.cdr.detectChanges();
    }, 3000);
  }
}
