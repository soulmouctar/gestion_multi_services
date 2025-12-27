import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Tenant, User, Subscription, SubscriptionPlan, ApiResponse, PaginatedResponse, FilterOptions } from '../models';

@Injectable({
  providedIn: 'root'
})
export class TenantService {
  private tenants = new BehaviorSubject<Tenant[]>([]);
  private currentTenant = new BehaviorSubject<Tenant | null>(null);
  private subscriptionPlans = new BehaviorSubject<SubscriptionPlan[]>([]);
  
  tenants$ = this.tenants.asObservable();
  currentTenant$ = this.currentTenant.asObservable();
  subscriptionPlans$ = this.subscriptionPlans.asObservable();
  
  constructor(private apiService: ApiService) {}
  
  // Tenant Management (Super Admin only)
  getTenants(options?: FilterOptions): Observable<PaginatedResponse<Tenant>> {
    return this.apiService.getPaginated('tenants', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.tenants.next(response.data);
        }
      })
    );
  }
  
  createTenant(tenantData: Partial<Tenant>): Observable<ApiResponse<Tenant>> {
    return this.apiService.post('tenants', tenantData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentTenants = this.tenants.value;
          this.tenants.next([...currentTenants, response.data]);
        }
      })
    );
  }
  
  updateTenant(id: string, tenantData: Partial<Tenant>): Observable<ApiResponse<Tenant>> {
    return this.apiService.put(`tenants/${id}`, tenantData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentTenants = this.tenants.value;
          const updatedTenants = currentTenants.map(tenant => 
            tenant.id === id ? response.data! : tenant
          );
          this.tenants.next(updatedTenants);
          
          // Update current tenant if it's the same
          if (this.currentTenant.value?.id === id) {
            this.currentTenant.next(response.data!);
          }
        }
      })
    );
  }
  
  deleteTenant(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`tenants/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentTenants = this.tenants.value;
          const filteredTenants = currentTenants.filter(tenant => tenant.id !== id);
          this.tenants.next(filteredTenants);
        }
      })
    );
  }
  
  suspendTenant(id: string): Observable<ApiResponse<Tenant>> {
    return this.apiService.post(`tenants/${id}/suspend`, {}).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.updateTenantInList(response.data);
        }
      })
    );
  }
  
  activateTenant(id: string): Observable<ApiResponse<Tenant>> {
    return this.apiService.post(`tenants/${id}/activate`, {}).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.updateTenantInList(response.data);
        }
      })
    );
  }
  
  // Current Tenant Management
  getCurrentTenant(): Observable<ApiResponse<Tenant>> {
    return this.apiService.get('tenant/current').pipe(
      tap(response => {
        if (response.success && response.data) {
          this.currentTenant.next(response.data);
        }
      })
    );
  }
  
  updateCurrentTenant(tenantData: Partial<Tenant>): Observable<ApiResponse<Tenant>> {
    return this.apiService.put('tenant/current', tenantData).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.currentTenant.next(response.data);
        }
      })
    );
  }
  
  // User Management within Tenant
  getTenantUsers(tenantId: string): Observable<ApiResponse<User[]>> {
    return this.apiService.get(`tenants/${tenantId}/users`);
  }
  
  createTenantUser(tenantId: string, userData: Partial<User>): Observable<ApiResponse<User>> {
    return this.apiService.post(`tenants/${tenantId}/users`, userData);
  }
  
  updateTenantUser(tenantId: string, userId: string, userData: Partial<User>): Observable<ApiResponse<User>> {
    return this.apiService.put(`tenants/${tenantId}/users/${userId}`, userData);
  }
  
  deleteTenantUser(tenantId: string, userId: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`tenants/${tenantId}/users/${userId}`);
  }
  
  // Module Management
  getTenantModules(tenantId: string): Observable<ApiResponse<any[]>> {
    return this.apiService.get(`tenants/${tenantId}/modules`);
  }
  
  updateTenantModules(tenantId: string, moduleIds: string[]): Observable<ApiResponse<any>> {
    return this.apiService.put(`tenants/${tenantId}/modules`, { moduleIds });
  }
  
  // Subscription Management
  getSubscriptionPlans(): Observable<ApiResponse<SubscriptionPlan[]>> {
    return this.apiService.get('subscription-plans').pipe(
      tap(response => {
        if (response.success && response.data) {
          this.subscriptionPlans.next(response.data);
        }
      })
    );
  }
  
  createSubscription(subscriptionData: {
    tenantId: string;
    planId: string;
    paymentMethod: string;
    paymentDetails: any;
  }): Observable<ApiResponse<Subscription>> {
    return this.apiService.post('subscriptions', subscriptionData);
  }
  
  getTenantSubscription(tenantId: string): Observable<ApiResponse<Subscription>> {
    return this.apiService.get(`tenants/${tenantId}/subscription`);
  }
  
  renewSubscription(tenantId: string, planId: string): Observable<ApiResponse<Subscription>> {
    return this.apiService.post(`tenants/${tenantId}/subscription/renew`, { planId });
  }
  
  cancelSubscription(tenantId: string, reason?: string): Observable<ApiResponse<any>> {
    return this.apiService.post(`tenants/${tenantId}/subscription/cancel`, { reason });
  }
  
  getSubscriptionPayments(subscriptionId: string): Observable<ApiResponse<any[]>> {
    return this.apiService.get(`subscriptions/${subscriptionId}/payments`);
  }
  
  // Tenant Statistics
  getTenantStatistics(tenantId: string): Observable<ApiResponse<{
    totalUsers: number;
    activeUsers: number;
    totalRevenue: number;
    totalExpenses: number;
    moduleUsage: Array<{ moduleCode: string; usageCount: number }>;
  }>> {
    return this.apiService.get(`tenants/${tenantId}/statistics`);
  }
  
  // Global Statistics (Super Admin)
  getGlobalStatistics(): Observable<ApiResponse<{
    totalTenants: number;
    activeTenants: number;
    totalRevenue: number;
    totalUsers: number;
    subscriptionsByPlan: Array<{ planName: string; count: number }>;
    monthlyGrowth: Array<{ month: string; newTenants: number; revenue: number }>;
  }>> {
    return this.apiService.get('admin/statistics');
  }
  
  // Private helper methods
  private updateTenantInList(updatedTenant: Tenant): void {
    const currentTenants = this.tenants.value;
    const updatedTenants = currentTenants.map(tenant => 
      tenant.id === updatedTenant.id ? updatedTenant : tenant
    );
    this.tenants.next(updatedTenants);
  }
}
