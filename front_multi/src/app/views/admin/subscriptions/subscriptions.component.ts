import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SubscriptionService, Subscription, SubscriptionPlan, ApiResponse } from '../../../core/services/subscription.service';
import Swal from 'sweetalert2';
import { AlertService } from '../../../core/services/alert.service';
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

// Interfaces importées depuis le service

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
  filteredSubscriptions: Subscription[] = [];
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
    private cdr: ChangeDetectorRef,
    private subscriptionService: SubscriptionService,
    private alertService: AlertService
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
    
    this.subscriptionService.getSubscriptions().subscribe({
      next: (response: any) => {
        // L'API retourne une structure paginée avec data.data
        this.subscriptions = response.data?.data || response.data || [];
        this.loading = false;
        setTimeout(() => {
          this.applyFilters();
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        console.error('Error loading subscriptions:', error);
        this.subscriptions = [];
        this.showErrorMessage('Erreur lors du chargement des abonnements.');
        this.loading = false;
        setTimeout(() => {
          this.cdr.detectChanges();
        });
      }
    });
  }

  loadPlans(): void {
    this.subscriptionService.getSubscriptionPlans().subscribe({
      next: (response: any) => {
        this.plans = response.data?.data || response.data || [];
      },
      error: (error) => {
        console.error('Error loading plans:', error);
        this.plans = [];
        this.showErrorMessage('Erreur lors du chargement des plans.');
      }
    });
  }

  loadTenants(): void {
    // Pour les tenants, on peut utiliser un service tenant ou créer des données temporaires
    // En attendant l'implémentation du service tenant, on garde les données simulées
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
      
      if (this.editMode && this.selectedSubscription) {
        // Update existing subscription
        this.subscriptionService.updateSubscription(this.selectedSubscription.id, formData).subscribe({
          next: (response: ApiResponse<Subscription>) => {
            const index = this.subscriptions.findIndex(s => s.id === this.selectedSubscription!.id);
            if (index !== -1) {
              this.subscriptions[index] = response.data;
              this.subscriptions = [...this.subscriptions];
            }
            this.loading = false;
            this.closeSubscriptionModal();
            setTimeout(() => {
              this.applyFilters();
              this.showSuccessMessage('Abonnement modifié avec succès!');
              this.cdr.detectChanges();
            });
          },
          error: (error) => {
            console.error('Error updating subscription:', error);
            this.showErrorMessage('Erreur lors de la modification de l\'abonnement.');
            this.loading = false;
            setTimeout(() => {
              this.cdr.detectChanges();
            });
          }
        });
      } else {
        // Create new subscription
        this.subscriptionService.createSubscription(formData).subscribe({
          next: (response: ApiResponse<Subscription>) => {
            this.subscriptions.unshift(response.data);
            this.subscriptions = [...this.subscriptions];
            this.loading = false;
            this.closeSubscriptionModal();
            setTimeout(() => {
              this.applyFilters();
              this.showSuccessMessage('Abonnement créé avec succès!');
              this.cdr.detectChanges();
            });
          },
          error: (error) => {
            console.error('Error creating subscription:', error);
            this.showErrorMessage('Erreur lors de la création de l\'abonnement.');
            this.loading = false;
            setTimeout(() => {
              this.cdr.detectChanges();
            });
          }
        });
      }
    } else {
      console.log('Form is invalid:', this.subscriptionForm.errors);
      this.showErrorMessage('Veuillez corriger les erreurs dans le formulaire.');
    }
  }

  // Delete subscription with AlertService confirmation
  openDeleteModal(subscription: Subscription): void {
    this.alertService.showDeleteConfirmation(
      subscription.tenant?.name || 'cet abonnement', 
      'l\'abonnement'
    ).then((result) => {
      if (result.isConfirmed) {
        this.confirmDelete(subscription);
      }
    });
  }

  closeDeleteModal(): void {
    this.deleteModalOpen = false;
    this.subscriptionToDelete = null;
  }

  confirmDelete(subscription: Subscription): void {
    this.loading = true;
    this.cdr.detectChanges();
    
    this.subscriptionService.deleteSubscription(subscription.id).subscribe({
      next: (response: ApiResponse<void>) => {
        this.subscriptions = this.subscriptions.filter(s => s.id !== subscription.id);
        this.loading = false;
        setTimeout(() => {
          this.applyFilters();
          this.showSuccessMessage('Abonnement supprimé avec succès!');
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        console.error('Error deleting subscription:', error);
        this.showErrorMessage('Erreur lors de la suppression de l\'abonnement.');
        this.loading = false;
        setTimeout(() => {
          this.cdr.detectChanges();
        });
      }
    });
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
    return new Intl.NumberFormat('fr-GN', {
      style: 'currency',
      currency: 'GNF'
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

  // Message handling with AlertService
  showSuccessMessage(message: string): void {
    this.alertService.showSuccess('Succès!', message);
  }

  showErrorMessage(message: string): void {
    this.alertService.showError('Erreur!', message);
  }

  // Filter and search
  applyFilters(): void {
    if (!Array.isArray(this.subscriptions)) {
      this.subscriptions = [];
    }
    
    const search = this.filterForm.get('search')?.value?.toLowerCase() || '';
    const status = this.filterForm.get('status')?.value || 'ALL';
    const plan = this.filterForm.get('plan')?.value || 'ALL';
    
    this.filteredSubscriptions = this.subscriptions.filter(subscription => {
      const matchesSearch = !search || 
        subscription.tenant?.name.toLowerCase().includes(search) ||
        subscription.tenant?.domain.toLowerCase().includes(search) ||
        subscription.plan?.name.toLowerCase().includes(search);
      
      const matchesStatus = status === 'ALL' || subscription.status === status;
      
      const matchesPlan = plan === 'ALL' || subscription.plan_id.toString() === plan;
      
      return matchesSearch && matchesStatus && matchesPlan;
    });
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
