import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { 
  CardModule, 
  ButtonModule, 
  FormModule, 
  SpinnerModule,
  AlertModule,
  TabsModule,
  GridModule,
  TabDirective,
  TabPanelComponent,
  TabsComponent,
  TabsContentComponent,
  TabsListComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

@Component({
  selector: 'app-organisation-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    FormModule,
    SpinnerModule,
    AlertModule,
    TabsModule,
    GridModule,
    TabDirective,
    TabPanelComponent,
    TabsComponent,
    TabsContentComponent,
    TabsListComponent,
    IconDirective
  ],
  templateUrl: './organisation-settings.component.html',
  styleUrls: ['./organisation-settings.component.scss']
})
export class OrganisationSettingsComponent implements OnInit {
  settingsForm: FormGroup;
  loading = false;
  saving = false;

  timezones = [
    { value: 'Europe/Paris', label: 'Europe/Paris (GMT+1)' },
    { value: 'Europe/London', label: 'Europe/London (GMT+0)' },
    { value: 'America/New_York', label: 'America/New_York (GMT-5)' },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles (GMT-8)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (GMT+9)' }
  ];

  languages = [
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'de', label: 'Deutsch' }
  ];

  dateFormats = [
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2024)' },
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2024)' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2024-12-31)' },
    { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY (31-12-2024)' }
  ];

  numberFormats = [
    { value: 'fr', label: '1 234,56 (Français)' },
    { value: 'en', label: '1,234.56 (Anglais)' },
    { value: 'de', label: '1.234,56 (Allemand)' }
  ];

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
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
      session_timeout: [30, [Validators.required, Validators.min(5), Validators.max(480)]],
      password_expiry: [90, [Validators.required, Validators.min(30), Validators.max(365)]],
      two_factor_auth: [false],
      
      // Paramètres d'archivage
      auto_archive_invoices: [true],
      archive_after_days: [365, [Validators.required, Validators.min(30)]],
      backup_frequency: ['weekly', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.loading = true;
    // Simulate API call
    setTimeout(() => {
      // Load current settings from API
      const currentSettings = {
        timezone: 'Europe/Paris',
        language: 'fr',
        date_format: 'DD/MM/YYYY',
        number_format: 'fr',
        invoice_prefix: 'INV-',
        invoice_counter: 1001,
        quote_prefix: 'DEV-',
        quote_counter: 501,
        email_notifications: true,
        sms_notifications: false,
        browser_notifications: true,
        session_timeout: 30,
        password_expiry: 90,
        two_factor_auth: false,
        auto_archive_invoices: true,
        archive_after_days: 365,
        backup_frequency: 'weekly'
      };
      
      this.settingsForm.patchValue(currentSettings);
      this.loading = false;
    }, 1000);
  }

  onSubmit(): void {
    if (this.settingsForm.valid) {
      this.saving = true;
      const formData = this.settingsForm.value;
      
      // Simulate API call
      setTimeout(() => {
        console.log('Settings saved:', formData);
        this.saving = false;
        // Show success message
      }, 1000);
    }
  }

  resetToDefaults(): void {
    if (confirm('Êtes-vous sûr de vouloir restaurer les paramètres par défaut ?')) {
      this.settingsForm.reset({
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
  }

  get f() {
    return this.settingsForm.controls;
  }
}
