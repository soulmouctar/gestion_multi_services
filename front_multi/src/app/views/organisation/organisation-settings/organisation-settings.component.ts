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
  selector: 'app-organisation-settings',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './organisation-settings.component.html'
})
export class OrganisationSettingsComponent implements OnInit {
  settings: any = null;
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  submitted = false;
  settingsForm: FormGroup;

  constructor(private fb: FormBuilder, private apiService: ApiService, private cdr: ChangeDetectorRef) {
    this.settingsForm = this.fb.group({
      // Paramètres généraux
      timezone: ['Europe/Paris', Validators.required],
      language: ['fr', Validators.required],
      date_format: ['DD/MM/YYYY', Validators.required],
      number_format: ['fr', Validators.required],
      
      // Paramètres de facturation
      invoice_prefix: ['INV-', Validators.required],
      invoice_counter: [1, [Validators.required, Validators.min(1)]],
      quote_prefix: ['DEV-', Validators.required],
      quote_counter: [1, [Validators.required, Validators.min(1)]],
      
      // Paramètres de notification
      email_notifications: [true],
      sms_notifications: [false],
      browser_notifications: [true],
      
      // Paramètres de sécurité
      session_timeout: [30, [Validators.required, Validators.min(5)]],
      password_expiry: [90, [Validators.required, Validators.min(30)]],
      two_factor_auth: [false],
      
      // Paramètres d'archivage
      auto_archive_invoices: [true],
      archive_after_days: [365, [Validators.required, Validators.min(30)]],
      backup_frequency: ['weekly', Validators.required]
    });
  }

  ngOnInit(): void { this.loadSettings(); }

  loadSettings(): void {
    this.loading = true; this.error = null;
    this.apiService.get<any>('organisation-settings').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.settings = r.data;
          this.settingsForm.patchValue(r.data);
        }
        this.loading = false; this.cdr.detectChanges();
      },
      error: () => { this.error = 'Erreur lors du chargement des paramètres'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  saveSettings(): void {
    this.submitted = true;
    if (this.settingsForm.invalid) return;
    
    const data = this.settingsForm.value;
    const obs = this.settings 
      ? this.apiService.put<any>(`organisation-settings/${this.settings.id}`, data)
      : this.apiService.post<any>('organisation-settings', data);
    
    obs.subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = 'Paramètres sauvegardés avec succès';
          this.settings = r.data;
          this.clearMessages();
        }
      },
      error: (err) => { this.error = err?.error?.message || 'Erreur lors de la sauvegarde'; }
    });
  }

  resetToDefaults(): void {
    this.settingsForm.patchValue({
      timezone: 'Europe/Paris',
      language: 'fr',
      date_format: 'DD/MM/YYYY',
      number_format: 'fr',
      invoice_prefix: 'INV-',
      invoice_counter: 1,
      quote_prefix: 'DEV-',
      quote_counter: 1,
      email_notifications: true,
      sms_notifications: false,
      browser_notifications: true,
      session_timeout: 30,
      password_expiry: 90,
      two_factor_auth: false,
      auto_archive_invoices: true,
      archive_after_days: 365,
      backup_frequency: 'weekly'
    });
  }

  private clearMessages(): void {
    setTimeout(() => { this.successMessage = null; this.error = null; this.cdr.detectChanges(); }, 3000);
  }
}
