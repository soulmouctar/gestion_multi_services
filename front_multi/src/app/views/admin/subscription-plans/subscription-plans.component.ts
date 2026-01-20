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
  ButtonGroupModule,
  SpinnerModule
} from '@coreui/angular';
import { IconModule } from '@coreui/icons-angular';
import { SubscriptionService } from '../../../core/services/subscription.service';
import Swal from 'sweetalert2';
import { AlertService } from '../../../core/services/alert.service';

export interface SubscriptionPlan {
  id: number;
  name: string;
  duration_months: number;
  price: number;
  monthly_price: number;
  description?: string;
  features: string[];
  is_active: boolean;
  max_users?: number;
  max_modules?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Component({
  selector: 'app-subscription-plans',
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
    ButtonGroupModule,
    SpinnerModule,
    IconModule
  ],
  templateUrl: './subscription-plans.component.html',
  styleUrls: ['./subscription-plans.component.scss']
})
export class SubscriptionPlansComponent implements OnInit {
  plans: SubscriptionPlan[] = [];
  loading = false;
  submitted = false;
  editMode = false;
  selectedPlan: SubscriptionPlan | null = null;
  
  // Modal states
  planModalOpen = false;
  deleteModalOpen = false;
  planToDelete: SubscriptionPlan | null = null;
  
  // Forms
  planForm!: FormGroup;
  filterForm!: FormGroup;
  
  // Available features
  availableFeatures = [
    'Gestion multi-utilisateurs',
    'Sauvegarde automatique',
    'Support prioritaire',
    'Rapports avancés',
    'API complète',
    'Modules illimités',
    'Stockage étendu',
    'Intégrations tierces'
  ];

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private subscriptionService: SubscriptionService,
    private alertService: AlertService
  ) {
    this.initializeForms();
  }

  private initializeForms(): void {
    this.planForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      duration_months: [12, [Validators.required, Validators.min(1), Validators.max(60)]],
      price: [0, [Validators.required, Validators.min(0)]],
      description: ['', [Validators.maxLength(255)]],
      features: [[], Validators.required],
      is_active: [true],
      max_users: [null, [Validators.min(1)]],
      max_modules: [null, [Validators.min(1)]]
    });

    this.filterForm = this.fb.group({
      search: [''],
      status: ['ALL']
    });
  }

  ngOnInit(): void {
    this.loadPlans();
  }

  // Data loading
  loadPlans(): void {
    this.loading = true;
    this.cdr.detectChanges();
    
    this.subscriptionService.getSubscriptionPlans().subscribe({
      next: (response: any) => {
        const rawPlans = response.data?.data || response.data || [];
        // Ensure each plan has required properties with defaults
        this.plans = rawPlans.map((plan: any) => ({
          ...plan,
          features: plan.features || [],
          max_users: plan.max_users || null,
          monthly_price: plan.monthly_price || plan.price || 0,
          yearly_price: plan.yearly_price || (plan.price * 12) || 0
        }));
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading plans:', error);
        this.plans = [];
        this.showErrorMessage('Erreur lors du chargement des plans.');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Plan management
  openPlanModal(plan?: SubscriptionPlan): void {
    this.editMode = !!plan;
    this.selectedPlan = plan || null;
    
    if (plan) {
      this.planForm.patchValue({
        name: plan.name,
        duration_months: plan.duration_months,
        price: plan.price,
        description: plan.description,
        features: plan.features,
        is_active: plan.is_active,
        max_users: plan.max_users,
        max_modules: plan.max_modules
      });
    } else {
      this.planForm.reset({
        name: '',
        duration_months: 12,
        price: 0,
        description: '',
        features: [],
        is_active: true,
        max_users: null,
        max_modules: null
      });
    }
    
    this.planModalOpen = true;
    this.submitted = false;
  }

  closePlanModal(): void {
    this.planModalOpen = false;
    this.selectedPlan = null;
    this.editMode = false;
    this.submitted = false;
  }

  savePlan(): void {
    this.submitted = true;
    
    if (this.planForm.valid) {
      this.loading = true;
      this.cdr.detectChanges();
      
      const formData = this.planForm.value;
      
      if (this.editMode && this.selectedPlan) {
        // Update existing plan
        this.subscriptionService.updateSubscriptionPlan(this.selectedPlan.id, formData).subscribe({
          next: (response: any) => {
            const updatedPlan = response.data;
            const index = this.plans.findIndex(p => p.id === this.selectedPlan!.id);
            if (index !== -1) {
              this.plans[index] = updatedPlan;
            }
            this.loading = false;
            this.closePlanModal();
            this.showSuccessMessage('Plan modifié avec succès!');
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Error updating plan:', error);
            this.showErrorMessage('Erreur lors de la modification du plan.');
            this.loading = false;
            this.cdr.detectChanges();
          }
        });
      } else {
        // Create new plan
        this.subscriptionService.createSubscriptionPlan(formData).subscribe({
          next: (response: any) => {
            const newPlan = response.data;
            this.plans.unshift(newPlan);
            this.loading = false;
            this.closePlanModal();
            this.showSuccessMessage('Plan créé avec succès!');
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Error creating plan:', error);
            this.showErrorMessage('Erreur lors de la création du plan.');
            this.loading = false;
            this.cdr.detectChanges();
          }
        });
      }
    }
  }

  // Delete plan
  openDeleteModal(plan: SubscriptionPlan): void {
    this.planToDelete = plan;
    this.deleteModalOpen = true;
  }

  closeDeleteModal(): void {
    this.deleteModalOpen = false;
    this.planToDelete = null;
  }

  confirmDelete(): void {
    if (this.planToDelete) {
      this.loading = true;
      this.cdr.detectChanges();
      
      this.subscriptionService.deleteSubscriptionPlan(this.planToDelete.id).subscribe({
        next: () => {
          this.plans = this.plans.filter(p => p.id !== this.planToDelete!.id);
          this.loading = false;
          this.closeDeleteModal();
          this.showSuccessMessage('Plan supprimé avec succès!');
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error deleting plan:', error);
          this.showErrorMessage('Erreur lors de la suppression du plan.');
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  // Toggle plan status
  togglePlanStatus(plan: SubscriptionPlan): void {
    this.loading = true;
    this.cdr.detectChanges();
    
    const updatedData = { is_active: !plan.is_active };
    
    this.subscriptionService.updateSubscriptionPlan(plan.id, updatedData).subscribe({
      next: (response: any) => {
        const updatedPlan = response.data;
        const index = this.plans.findIndex(p => p.id === plan.id);
        if (index !== -1) {
          this.plans[index] = updatedPlan;
        }
        this.loading = false;
        this.showSuccessMessage(`Plan ${updatedPlan.is_active ? 'activé' : 'désactivé'} avec succès!`);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error toggling plan status:', error);
        this.showErrorMessage('Erreur lors du changement de statut du plan.');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Utility methods
  getStatusBadgeColor(isActive: boolean): string {
    return isActive ? 'success' : 'secondary';
  }

  getStatusText(isActive: boolean): string {
    return isActive ? 'ACTIF' : 'INACTIF';
  }

  getPriceBadgeColor(monthlyPrice: number): string {
    if (monthlyPrice < 20) return 'success';
    if (monthlyPrice < 40) return 'warning';
    return 'danger';
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('fr-GN', {
      style: 'currency',
      currency: 'GNF'
    }).format(price);
  }

  getDurationText(months: number): string {
    if (months === 1) return '1 mois';
    if (months < 12) return `${months} mois`;
    if (months === 12) return '1 an';
    return `${Math.floor(months / 12)} an${Math.floor(months / 12) > 1 ? 's' : ''}`;
  }

  // Form helpers
  get f() { return this.planForm.controls; }

  isFeatureSelected(feature: string): boolean {
    const selectedFeatures = this.planForm.get('features')?.value || [];
    return selectedFeatures.includes(feature);
  }

  toggleFeature(feature: string): void {
    const currentFeatures = this.planForm.get('features')?.value || [];
    const index = currentFeatures.indexOf(feature);
    
    if (index > -1) {
      currentFeatures.splice(index, 1);
    } else {
      currentFeatures.push(feature);
    }
    
    this.planForm.patchValue({ features: currentFeatures });
  }

  // Filter and search
  applyFilters(): void {
    const search = this.filterForm.get('search')?.value?.toLowerCase() || '';
    const status = this.filterForm.get('status')?.value || 'ALL';
    
    // Implement filtering logic here
    console.log('Applying filters:', { search, status });
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      status: 'ALL'
    });
    this.applyFilters();
  }

  getActivePlansCount(): number {
    return this.plans.filter(p => p.is_active).length;
  }

  // Message helpers
  showSuccessMessage(message: string): void {
    this.alertService.showSuccess('Succès!', message);
  }

  showErrorMessage(message: string): void {
    this.alertService.showError('Erreur!', message);
  }
}
