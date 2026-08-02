import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Tenant, Module, ApiResponse } from '../models/tenant.model';
import { AuthService } from './auth.service';
import { resolveUploadUrl } from '../utils/upload-url.util';

@Injectable({
  providedIn: 'root'
})
export class TenantService {
  private readonly API_URL = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // Organisation courante (accessible ADMIN + SUPER_ADMIN)
  getMyTenant(): Observable<ApiResponse<Tenant>> {
    const tenantId = this.authService.isSuperAdmin ? this.authService.selectedManagedTenantId : null;
    const options = tenantId
      ? { params: new HttpParams().set('tenant_id', tenantId.toString()) }
      : {};
    return this.http.get<ApiResponse<Tenant>>(`${this.API_URL}/organisation/tenant`, options).pipe(
      map(response => this.normalizeTenantResponse(response))
    );
  }

  updateMyTenant(data: Partial<Tenant> | FormData): Observable<ApiResponse<Tenant>> {
    const payload = this.attachSelectedTenant(data);
    // Laravel ne lit pas les fichiers sur PUT multipart : POST + _method=PUT
    if (payload instanceof FormData) {
      if (!payload.has('_method')) {
        payload.append('_method', 'PUT');
      }
      return this.http.post<ApiResponse<Tenant>>(`${this.API_URL}/organisation/tenant`, payload).pipe(
        map(response => this.normalizeTenantResponse(response))
      );
    }
    return this.http.put<ApiResponse<Tenant>>(`${this.API_URL}/organisation/tenant`, payload).pipe(
      map(response => this.normalizeTenantResponse(response))
    );
  }

  private attachSelectedTenant(data: Partial<Tenant> | FormData): Partial<Tenant> | FormData {
    const tenantId = this.authService.isSuperAdmin ? this.authService.selectedManagedTenantId : null;
    if (!tenantId) return data;

    if (data instanceof FormData) {
      if (!data.has('tenant_id')) {
        data.append('tenant_id', tenantId.toString());
      }
      return data;
    }

    const payload = data as Partial<Tenant> & { tenant_id?: number };
    return payload.tenant_id ? payload : ({ ...payload, tenant_id: tenantId } as Partial<Tenant>);
  }

  // Tenants CRUD (SUPER_ADMIN uniquement)
  getTenants(): Observable<ApiResponse<Tenant[]>> {
    return this.http.get<ApiResponse<Tenant[]>>(`${this.API_URL}/tenants`).pipe(
      map(response => this.normalizeTenantResponse(response))
    );
  }

  getTenant(id: number): Observable<ApiResponse<Tenant>> {
    return this.http.get<ApiResponse<Tenant>>(`${this.API_URL}/tenants/${id}`).pipe(
      map(response => this.normalizeTenantResponse(response))
    );
  }

  createTenant(tenant: Partial<Tenant> | FormData): Observable<ApiResponse<Tenant>> {
    return this.http.post<ApiResponse<Tenant>>(`${this.API_URL}/tenants`, tenant).pipe(
      map(response => this.normalizeTenantResponse(response))
    );
  }

  updateTenant(id: number, tenant: Partial<Tenant> | FormData): Observable<ApiResponse<Tenant>> {
    // Laravel ne lit pas les fichiers sur PUT multipart : on POST avec _method=PUT override.
    if (tenant instanceof FormData) {
      tenant.append('_method', 'PUT');
      return this.http.post<ApiResponse<Tenant>>(`${this.API_URL}/tenants/${id}`, tenant).pipe(
        map(response => this.normalizeTenantResponse(response))
      );
    }
    return this.http.put<ApiResponse<Tenant>>(`${this.API_URL}/tenants/${id}`, tenant).pipe(
      map(response => this.normalizeTenantResponse(response))
    );
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

  // Get all modules from database
  getModules(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.API_URL}/modules`);
  }

  private normalizeTenantResponse<T>(response: ApiResponse<T>): ApiResponse<T> {
    return this.normalizeUploadUrls(response) as ApiResponse<T>;
  }

  private normalizeUploadUrls(value: any): any {
    if (Array.isArray(value)) {
      return value.map(item => this.normalizeUploadUrls(item));
    }
    if (!value || typeof value !== 'object') {
      return value;
    }

    const normalized = { ...value };
    for (const [key, item] of Object.entries(normalized)) {
      if (typeof item === 'string' && key.endsWith('_url')) {
        (normalized as any)[key] = resolveUploadUrl(item);
      } else if (item && typeof item === 'object') {
        (normalized as any)[key] = this.normalizeUploadUrls(item);
      }
    }
    return normalized;
  }
}
