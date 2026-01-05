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
    private cdr: ChangeDetectorRef
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
    
    // Simulate API call - replace with actual service
    setTimeout(() => {
      this.plans = [
        {
          id: 1,
          name: 'Plan Starter',
          duration_months: 1,
          price: 29.99,
          monthly_price: 29.99,
          description: 'Parfait pour les petites entreprises',
          features: ['Gestion multi-utilisateurs', 'Sauvegarde automatique'],
          is_active: true,
          max_users: 5,
          max_modules: 3
        },
        {
          id: 2,
          name: 'Plan Business',
          duration_months: 12,
          price: 299.99,
          monthly_price: 24.99,
          description: 'Solution complète pour entreprises en croissance',
          features: ['Gestion multi-utilisateurs', 'Sauvegarde automatique', 'Support prioritaire', 'Rapports avancés'],
          is_active: true,
          max_users: 25,
          max_modules: 8
        },
        {
          id: 3,
          name: 'Plan Enterprise',
          duration_months: 12,
          price: 599.99,
          monthly_price: 49.99,
          description: 'Solution premium pour grandes entreprises',
          features: ['Gestion multi-utilisateurs', 'Sauvegarde automatique', 'Support prioritaire', 'Rapports avancés', 'API complète', 'Modules illimités'],
          is_active: true,
          max_users: undefined, // Illimité
          max_modules: undefined // Illimité
        },
        {
          id: 4,
          name: 'Plan Test',
          duration_months: 3,
          price: 59.99,
          monthly_price: 19.99,
          description: 'Plan de test temporaire',
          features: ['Gestion multi-utilisateurs'],
          is_active: false,
          max_users: 10,
          max_modules: 5
        }
      ];
      this.loading = false;
      this.cdr.detectChanges();
    }, 1000);
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
      // Calculate monthly price
      formData.monthly_price = formData.duration_months > 0 ? formData.price / formData.duration_months : formData.price;
      
      // Simulate API call
      setTimeout(() => {
        if (this.editMode && this.selectedPlan) {
          // Update existing plan
          const index = this.plans.findIndex(p => p.id === this.selectedPlan!.id);
          if (index !== -1) {
            this.plans[index] = {
              ...this.selectedPlan,
              ...formData,
              updated_at: new Date().toISOString()
            };
          }
        } else {
          // Create new plan
          const newPlan: SubscriptionPlan = {
            id: Math.max(...this.plans.map(p => p.id)) + 1,
            ...formData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          this.plans.unshift(newPlan);
        }
        
        this.loading = false;
        this.closePlanModal();
        this.cdr.detectChanges();
      }, 1500);
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
      
      // Simulate API call
      setTimeout(() => {
        this.plans = this.plans.filter(p => p.id !== this.planToDelete!.id);
        this.loading = false;
        this.closeDeleteModal();
        this.cdr.detectChanges();
      }, 1000);
    }
  }

  // Toggle plan status
  togglePlanStatus(plan: SubscriptionPlan): void {
    this.loading = true;
    this.cdr.detectChanges();
    
    // Simulate API call
    setTimeout(() => {
      plan.is_active = !plan.is_active;
      plan.updated_at = new Date().toISOString();
      this.loading = false;
      this.cdr.detectChanges();
    }, 500);
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
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
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
}
