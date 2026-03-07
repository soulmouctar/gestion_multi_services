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
import { OrganisationSettingService, OrganisationSetting, SettingOptions } from '../../../core/services/organisation-setting.service';
import Swal from 'sweetalert2';

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
  currentSettings: OrganisationSetting | null = null;

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
    private cdr: ChangeDetectorRef,
    private organisationSettingService: OrganisationSettingService
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
    this.organisationSettingService.getSettings().subscribe({
      next: (response) => {
        if (response.success) {
          const settings = response.data;
          this.currentSettings = settings;
          this.settingsForm.patchValue(settings);
        }
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading settings:', error);
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: 'Impossible de charger les paramètres. Veuillez réessayer.',
          confirmButtonColor: '#dc3545'
        });
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.settingsForm.valid) {
      this.saving = true;
      const formData = this.settingsForm.value;
      
      this.organisationSettingService.updateSettings(formData).subscribe({
        next: (response) => {
          if (response.success) {
            const updatedSettings = response.data;
            this.currentSettings = updatedSettings;
          }
          this.saving = false;
        },
        error: (error: any) => {
          console.error('Error saving settings:', error);
          this.saving = false;
          Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: 'Impossible d\'enregistrer les paramètres. Veuillez réessayer.',
            confirmButtonColor: '#dc3545'
          });
        }
      });
    }
  }

  resetToDefaults(): void {
    Swal.fire({
      title: 'Êtes-vous sûr?',
      text: 'Cela va restaurer tous les paramètres à leurs valeurs par défaut.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Oui, restaurer',
      cancelButtonText: 'Annuler'
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.saving = true;
        
        this.organisationSettingService.resetSettings().subscribe({
          next: (response) => {
            if (response.success) {
              const resetSettings = response.data;
              this.currentSettings = resetSettings;
              this.settingsForm.patchValue(resetSettings);
            }
            this.saving = false;
          },
          error: (error: any) => {
            console.error('Error resetting settings:', error);
            this.saving = false;
            Swal.fire({
              icon: 'error',
              title: 'Erreur',
              text: 'Impossible de restaurer les paramètres. Veuillez réessayer.',
              confirmButtonColor: '#dc3545'
            });
          }
        });
      }
    });
  }

  get f() {
    return this.settingsForm.controls;
  }
}
