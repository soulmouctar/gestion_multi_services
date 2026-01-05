import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Tenant {
  id: number;
  name: string;
  email: string;
  phone: string;
  subscription_status: 'ACTIVE' | 'SUSPENDED';
  modules?: Module[];
  subscriptions?: any[];
  users?: any[];
  created_at?: string;
  updated_at?: string;
}

export interface Module {
  id: number;
  code: string;
  name: string;
  icon: string;
  enabled: boolean;
  pivot?: {
    tenant_id: number;
    module_id: number;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class TenantService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Tenants CRUD
  getTenants(): Observable<ApiResponse<Tenant[]>> {
    return this.http.get<ApiResponse<Tenant[]>>(`${this.API_URL}/tenants`);
  }

  getTenant(id: number): Observable<ApiResponse<Tenant>> {
    return this.http.get<ApiResponse<Tenant>>(`${this.API_URL}/tenants/${id}`);
  }

  createTenant(tenant: Partial<Tenant>): Observable<ApiResponse<Tenant>> {
    return this.http.post<ApiResponse<Tenant>>(`${this.API_URL}/tenants`, tenant);
  }

  updateTenant(id: number, tenant: Partial<Tenant>): Observable<ApiResponse<Tenant>> {
    return this.http.put<ApiResponse<Tenant>>(`${this.API_URL}/tenants/${id}`, tenant);
  }

  deleteTenant(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API_URL}/tenants/${id}`);
  }

  // Module management
  assignModule(tenantId: number, moduleId: number, isActive: boolean = true): Observable<ApiResponse<Tenant>> {
    return this.http.post<ApiResponse<Tenant>>(`${this.API_URL}/tenants/${tenantId}/assign-module`, {
      module_id: moduleId,
      is_active: isActive
    });
  }

  removeModule(tenantId: number, moduleId: number): Observable<ApiResponse<Tenant>> {
    return this.http.post<ApiResponse<Tenant>>(`${this.API_URL}/tenants/${tenantId}/remove-module`, {
      module_id: moduleId
    });
  }

  // Utility methods
  getActiveTenants(): Observable<ApiResponse<Tenant[]>> {
    return this.http.get<ApiResponse<Tenant[]>>(`${this.API_URL}/tenants?subscription_status=ACTIVE`);
  }

  getSuspendedTenants(): Observable<ApiResponse<Tenant[]>> {
    return this.http.get<ApiResponse<Tenant[]>>(`${this.API_URL}/tenants?subscription_status=SUSPENDED`);
  }

  searchTenants(query: string): Observable<ApiResponse<Tenant[]>> {
    return this.http.get<ApiResponse<Tenant[]>>(`${this.API_URL}/tenants?search=${query}`);
  }

  // Module management utilities
  toggleModuleStatus(tenant: Tenant, module: Module): Observable<ApiResponse<Tenant>> {
    const isActive = module.pivot?.is_active ?? false;
    return this.assignModule(tenant.id, module.id, !isActive);
  }

  getTenantModules(tenantId: number): Observable<ApiResponse<Module[]>> {
    return this.http.get<ApiResponse<Module[]>>(`${this.API_URL}/tenants/${tenantId}/modules`);
  }

  getTenantStats(tenantId: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.API_URL}/tenants/${tenantId}/stats`);
  }

  // Status management
  activateTenant(tenantId: number): Observable<ApiResponse<Tenant>> {
    return this.updateTenant(tenantId, { subscription_status: 'ACTIVE' });
  }

  suspendTenant(tenantId: number): Observable<ApiResponse<Tenant>> {
    return this.updateTenant(tenantId, { subscription_status: 'SUSPENDED' });
  }

  // Validation helpers
  validateTenantEmail(email: string): Observable<ApiResponse<{ available: boolean }>> {
    return this.http.post<ApiResponse<{ available: boolean }>>(`${this.API_URL}/tenants/validate-email`, {
      email
    });
  }

  validateTenantDomain(domain: string): Observable<ApiResponse<{ available: boolean }>> {
    return this.http.post<ApiResponse<{ available: boolean }>>(`${this.API_URL}/tenants/validate-domain`, {
      domain
    });
  }

  // Bulk operations
  bulkUpdateStatus(tenantIds: number[], status: 'ACTIVE' | 'SUSPENDED'): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.API_URL}/tenants/bulk-update-status`, {
      tenant_ids: tenantIds,
      status
    });
  }

  bulkDelete(tenantIds: number[]): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.API_URL}/tenants/bulk-delete`, {
      tenant_ids: tenantIds
    });
  }

  // Export functionality
  exportTenants(format: 'csv' | 'excel' | 'pdf' = 'csv'): Observable<ApiResponse<Blob>> {
    return this.http.get<ApiResponse<Blob>>(`${this.API_URL}/tenants/export?format=${format}`, {
      responseType: 'blob' as 'json'
    });
  }

  // Get tenant statistics for dashboard
  getTenantDashboardStats(tenantId: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.API_URL}/tenants/${tenantId}/dashboard-stats`);
  }

  // Module management for tenants
  assignModuleToTenant(tenantId: number, moduleId: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.API_URL}/tenants/${tenantId}/assign-module`, {
      module_id: moduleId
    });
  }

  removeModuleFromTenant(tenantId: number, moduleId: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.API_URL}/tenants/${tenantId}/remove-module`, {
      module_id: moduleId
    });
  }
}
