import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService, ApiResponse, Tenant } from '../../../core/services/tenant.service';
import { OrganisationFilterService } from '../../../core/services/organisation-filter.service';
import { 
  CardModule, 
  ButtonModule, 
  FormModule, 
  SpinnerModule,
  AlertModule,
  GridModule 
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

@Component({
  selector: 'app-company-info',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    FormModule,
    SpinnerModule,
    AlertModule,
    GridModule,
    IconDirective
  ],
  templateUrl: './company-info.component.html',
  styleUrls: ['./company-info.component.scss']
})
export class CompanyInfoComponent implements OnInit {
  companyForm: FormGroup;
  loading = false;
  saving = false;
  currentOrganisation: any = null;
  
  // Organisation filtering
  selectedOrganisation: Tenant | null = null;
  availableOrganisations: Tenant[] = [];
  canSelectOrganisation = false;
  currentUserRole: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private tenantService: TenantService,
    private organisationFilterService: OrganisationFilterService,
    private cdr: ChangeDetectorRef
  ) {
    this.companyForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      website: [''],
      description: [''],
      logo: [''],
      address: [''],
      city: [''],
      postal_code: [''],
      country: [''],
      tax_number: [''],
      registration_number: ['']
    });
  }

  ngOnInit(): void {
    this.initializeOrganisationFilter();
    this.loadOrganisationInfo();
  }

  private initializeOrganisationFilter(): void {
    this.currentUserRole = this.organisationFilterService.getCurrentUserRole();
    this.canSelectOrganisation = this.organisationFilterService.canSelectOrganisation();

    // S'abonner aux changements d'organisation
    this.organisationFilterService.selectedOrganisation$.subscribe(organisation => {
      this.selectedOrganisation = organisation;
      if (organisation) {
        this.loadOrganisationInfo();
      }
    });

    this.organisationFilterService.availableOrganisations$.subscribe(organisations => {
      this.availableOrganisations = organisations;
      this.cdr.detectChanges();
    });
  }

  onOrganisationChange(organisationId: number): void {
    const organisation = this.availableOrganisations.find(org => org.id === organisationId);
    if (organisation) {
      this.organisationFilterService.selectOrganisation(organisation);
    }
  }

  loadOrganisationInfo(): void {
    if (!this.selectedOrganisation) {
      console.warn('No organisation selected');
      return;
    }

    this.loading = true;
    
    // Simuler le chargement des informations selon l'organisation sélectionnée
    setTimeout(() => {
      // Données simulées basées sur l'organisation
      const mockOrganisations: { [key: number]: any } = {
        1: {
          id: 1,
          name: 'Organisation Alpha',
          email: 'contact@alpha.com',
          phone: '+33 1 23 45 67 89',
          website: 'https://www.alpha.com',
          description: 'Organisation Alpha - Leader du marché',
          logo: '',
          address: '123 Rue de la Paix',
          city: 'Paris',
          postal_code: '75001',
          country: 'France',
          tax_number: 'FR12345678901',
          registration_number: '12345678901234'
        },
        2: {
          id: 2,
          name: 'Organisation Beta',
          email: 'contact@beta.com',
          phone: '+33 2 34 56 78 90',
          website: 'https://www.beta.com',
          description: 'Organisation Beta - Innovation et technologie',
          logo: '',
          address: '456 Avenue des Champs',
          city: 'Lyon',
          postal_code: '69000',
          country: 'France',
          tax_number: 'FR98765432109',
          registration_number: '98765432109876'
        }
      };

      this.currentOrganisation = mockOrganisations[this.selectedOrganisation?.id || 0] || {
        id: this.selectedOrganisation?.id || 0,
        name: this.selectedOrganisation?.name || '',
        email: `contact@${(this.selectedOrganisation?.name || 'organisation').toLowerCase().replace(/\s+/g, '')}.com`,
        phone: '+33 1 00 00 00 00',
        website: '',
        description: '',
        logo: '',
        address: '',
        city: '',
        postal_code: '',
        country: 'France',
        tax_number: '',
        registration_number: ''
      };

      this.companyForm.patchValue(this.currentOrganisation);
      this.loading = false;
      this.cdr.detectChanges();
    }, 1000);
  }

  onSubmit(): void {
    if (this.companyForm.valid && this.currentOrganisation) {
      this.saving = true;
      
      const formData = this.companyForm.value;
      
      this.tenantService.updateTenant(this.currentOrganisation.id, formData).subscribe({
        next: (response: ApiResponse<any>) => {
          if (response.data) {
            this.currentOrganisation = response.data;
            console.log('Organisation info updated successfully');
          }
          this.saving = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error updating organisation info:', error);
          this.saving = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  onOrganisationSelectChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const organisationId = Number(target.value);
    this.onOrganisationChange(organisationId);
  }

  get f() {
    return this.companyForm.controls;
  }
}
