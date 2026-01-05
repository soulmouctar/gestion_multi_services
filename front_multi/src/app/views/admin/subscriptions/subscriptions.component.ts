import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
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

export interface Subscription {
  id: number;
  tenant_id: number;
  plan_id: number;
  start_date: string;
  end_date: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED';
  auto_renew: boolean;
  created_at?: string;
  updated_at?: string;
  // Relations
  tenant?: {
    id: number;
    name: string;
    domain: string;
  };
  plan?: {
    id: number;
    name: string;
    price: number;
    duration_months: number;
  };
}

export interface SubscriptionPlan {
  id: number;
  name: string;
  price: number;
  duration_months: number;
  features: string[];
  is_active: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Component({
  selector: 'app-subscriptions',
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
  templateUrl: './subscriptions.component.html',
  styleUrls: ['./subscriptions.component.scss']
})
export class SubscriptionsComponent implements OnInit {
  subscriptions: Subscription[] = [];
  plans: SubscriptionPlan[] = [];
  tenants: any[] = [];
  loading = false;
  submitted = false;
  editMode = false;
  selectedSubscription: Subscription | null = null;
  
  // Modal states
  subscriptionModalOpen = false;
  deleteModalOpen = false;
  renewModalOpen = false;
  subscriptionToDelete: Subscription | null = null;
  subscriptionToRenew: Subscription | null = null;
  
  // Forms
  subscriptionForm!: FormGroup;
  filterForm!: FormGroup;
  renewForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForms();
  }

  private initializeForms(): void {
    this.subscriptionForm = this.fb.group({
      tenant_id: ['', Validators.required],
      plan_id: ['', Validators.required],
      start_date: ['', Validators.required],
      auto_renew: [false],
      status: ['ACTIVE', Validators.required]
    });

    this.filterForm = this.fb.group({
      search: [''],
      status: ['ALL'],
      plan: ['ALL']
    });

    this.renewForm = this.fb.group({
      duration_months: [12, [Validators.required, Validators.min(1)]],
      auto_renew: [false]
    });
  }

  ngOnInit(): void {
    this.loadSubscriptions();
    this.loadPlans();
    this.loadTenants();
  }

  // Data loading
  loadSubscriptions(): void {
    this.loading = true;
    this.cdr.detectChanges();
    
    // Simulate API call - replace with actual service
    setTimeout(() => {
      this.subscriptions = [
        {
          id: 1,
          tenant_id: 1,
          plan_id: 2,
          start_date: '2024-01-15',
          end_date: '2025-01-15',
          status: 'ACTIVE',
          auto_renew: true,
          tenant: { id: 1, name: 'Entreprise Alpha', domain: 'alpha.example.com' },
          plan: { id: 2, name: 'Plan Business', price: 299.99, duration_months: 12 }
        },
        {
          id: 2,
          tenant_id: 2,
          plan_id: 1,
          start_date: '2024-06-01',
          end_date: '2024-07-01',
          status: 'EXPIRED',
          auto_renew: false,
          tenant: { id: 2, name: 'Startup Beta', domain: 'beta.example.com' },
          plan: { id: 1, name: 'Plan Starter', price: 29.99, duration_months: 1 }
        },
        {
          id: 3,
          tenant_id: 3,
          plan_id: 3,
          start_date: '2024-12-01',
          end_date: '2025-12-01',
          status: 'ACTIVE',
          auto_renew: true,
          tenant: { id: 3, name: 'Corporation Gamma', domain: 'gamma.example.com' },
          plan: { id: 3, name: 'Plan Enterprise', price: 599.99, duration_months: 12 }
        },
        {
          id: 4,
          tenant_id: 4,
          plan_id: 2,
          start_date: '2024-11-15',
          end_date: '2025-11-15',
          status: 'SUSPENDED',
          auto_renew: false,
          tenant: { id: 4, name: 'Société Delta', domain: 'delta.example.com' },
          plan: { id: 2, name: 'Plan Business', price: 299.99, duration_months: 12 }
        }
      ];
      this.loading = false;
      this.cdr.detectChanges();
    }, 1000);
  }

  loadPlans(): void {
    // Simulate API call
    this.plans = [
      { id: 1, name: 'Plan Starter', price: 29.99, duration_months: 1, features: ['Basic'], is_active: true },
      { id: 2, name: 'Plan Business', price: 299.99, duration_months: 12, features: ['Advanced'], is_active: true },
      { id: 3, name: 'Plan Enterprise', price: 599.99, duration_months: 12, features: ['Premium'], is_active: true }
    ];
  }

  loadTenants(): void {
    // Simulate API call
    this.tenants = [
      { id: 1, name: 'Entreprise Alpha', domain: 'alpha.example.com' },
      { id: 2, name: 'Startup Beta', domain: 'beta.example.com' },
      { id: 3, name: 'Corporation Gamma', domain: 'gamma.example.com' },
      { id: 4, name: 'Société Delta', domain: 'delta.example.com' },
      { id: 5, name: 'Groupe Epsilon', domain: 'epsilon.example.com' }
    ];
  }

  // Subscription management
  openSubscriptionModal(subscription?: Subscription): void {
    this.editMode = !!subscription;
    this.selectedSubscription = subscription || null;
    
    if (subscription) {
      this.subscriptionForm.patchValue({
        tenant_id: subscription.tenant_id,
        plan_id: subscription.plan_id,
        start_date: subscription.start_date,
        auto_renew: subscription.auto_renew,
        status: subscription.status
      });
    } else {
      this.subscriptionForm.reset({
        tenant_id: '',
        plan_id: '',
        start_date: new Date().toISOString().split('T')[0],
        auto_renew: false,
        status: 'ACTIVE'
      });
    }
    
    this.subscriptionModalOpen = true;
    this.submitted = false;
  }

  closeSubscriptionModal(): void {
    this.subscriptionModalOpen = false;
    this.selectedSubscription = null;
    this.editMode = false;
    this.submitted = false;
  }

  saveSubscription(): void {
    this.submitted = true;
    
    if (this.subscriptionForm.valid) {
      this.loading = true;
      this.cdr.detectChanges();
      
      const formData = this.subscriptionForm.value;
      const selectedPlan = this.plans.find(p => p.id == formData.plan_id);
      
      if (selectedPlan) {
        // Calculate end date based on plan duration
        const startDate = new Date(formData.start_date);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + selectedPlan.duration_months);
        formData.end_date = endDate.toISOString().split('T')[0];
      }
      
      // Simulate API call
      setTimeout(() => {
        if (this.editMode && this.selectedSubscription) {
          // Update existing subscription
          const index = this.subscriptions.findIndex(s => s.id === this.selectedSubscription!.id);
          if (index !== -1) {
            this.subscriptions[index] = {
              ...this.selectedSubscription,
              ...formData,
              updated_at: new Date().toISOString()
            };
          }
        } else {
          // Create new subscription
          const newSubscription: Subscription = {
            id: Math.max(...this.subscriptions.map(s => s.id)) + 1,
            ...formData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tenant: this.tenants.find(t => t.id == formData.tenant_id),
            plan: this.plans.find(p => p.id == formData.plan_id)
          };
          this.subscriptions.unshift(newSubscription);
        }
        
        this.loading = false;
        this.closeSubscriptionModal();
        this.cdr.detectChanges();
      }, 1500);
    }
  }

  // Delete subscription
  openDeleteModal(subscription: Subscription): void {
    this.subscriptionToDelete = subscription;
    this.deleteModalOpen = true;
  }

  closeDeleteModal(): void {
    this.deleteModalOpen = false;
    this.subscriptionToDelete = null;
  }

  confirmDelete(): void {
    if (this.subscriptionToDelete) {
      this.loading = true;
      this.cdr.detectChanges();
      
      // Simulate API call
      setTimeout(() => {
        this.subscriptions = this.subscriptions.filter(s => s.id !== this.subscriptionToDelete!.id);
        this.loading = false;
        this.closeDeleteModal();
        this.cdr.detectChanges();
      }, 1000);
    }
  }

  // Renew subscription
  openRenewModal(subscription: Subscription): void {
    this.subscriptionToRenew = subscription;
    this.renewForm.patchValue({
      duration_months: subscription.plan?.duration_months || 12,
      auto_renew: subscription.auto_renew
    });
    this.renewModalOpen = true;
  }

  closeRenewModal(): void {
    this.renewModalOpen = false;
    this.subscriptionToRenew = null;
  }

  confirmRenew(): void {
    if (this.subscriptionToRenew && this.renewForm.valid) {
      this.loading = true;
      this.cdr.detectChanges();
      
      const renewData = this.renewForm.value;
      
      // Simulate API call
      setTimeout(() => {
        const index = this.subscriptions.findIndex(s => s.id === this.subscriptionToRenew!.id);
        if (index !== -1) {
          const currentEndDate = new Date(this.subscriptions[index].end_date);
          const newEndDate = new Date(currentEndDate);
          newEndDate.setMonth(newEndDate.getMonth() + renewData.duration_months);
          
          this.subscriptions[index] = {
            ...this.subscriptions[index],
            end_date: newEndDate.toISOString().split('T')[0],
            auto_renew: renewData.auto_renew,
            status: 'ACTIVE',
            updated_at: new Date().toISOString()
          };
        }
        
        this.loading = false;
        this.closeRenewModal();
        this.cdr.detectChanges();
      }, 1500);
    }
  }

  // Toggle subscription status
  toggleSubscriptionStatus(subscription: Subscription): void {
    this.loading = true;
    this.cdr.detectChanges();
    
    // Simulate API call
    setTimeout(() => {
      const newStatus = subscription.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      subscription.status = newStatus;
      subscription.updated_at = new Date().toISOString();
      this.loading = false;
      this.cdr.detectChanges();
    }, 500);
  }

  // Utility methods
  getStatusBadgeColor(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'EXPIRED': return 'danger';
      case 'CANCELLED': return 'secondary';
      case 'SUSPENDED': return 'warning';
      default: return 'secondary';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'ACTIF';
      case 'EXPIRED': return 'EXPIRÉ';
      case 'CANCELLED': return 'ANNULÉ';
      case 'SUSPENDED': return 'SUSPENDU';
      default: return status;
    }
  }

  getDaysRemaining(endDate: string): number {
    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  isExpiringSoon(endDate: string): boolean {
    const daysRemaining = this.getDaysRemaining(endDate);
    return daysRemaining > 0 && daysRemaining <= 30;
  }

  isExpired(endDate: string): boolean {
    return this.getDaysRemaining(endDate) < 0;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR');
  }

  getActiveSubscriptionsCount(): number {
    return this.subscriptions.filter(s => s.status === 'ACTIVE').length;
  }

  // Form helpers
  get f() { return this.subscriptionForm.controls; }
  get rf() { return this.renewForm.controls; }

  // Filter and search
  applyFilters(): void {
    const search = this.filterForm.get('search')?.value?.toLowerCase() || '';
    const status = this.filterForm.get('status')?.value || 'ALL';
    const plan = this.filterForm.get('plan')?.value || 'ALL';
    
    // Implement filtering logic here
    console.log('Applying filters:', { search, status, plan });
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      status: 'ALL',
      plan: 'ALL'
    });
    this.applyFilters();
  }
}
