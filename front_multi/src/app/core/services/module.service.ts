import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Module {
  id: number;
  name: string;
  code: string;
  description: string;
  icon: string;
  is_active: boolean;
  permissions: string[];
  route?: string;
  version?: string;
  category?: string;
  dependencies?: string[];
  config?: any;
  created_at?: string;
  updated_at?: string;
}

export interface ModulePermission {
  id: number;
  module_id: number;
  name: string;
  description: string;
  code: string;
  module?: Module;
  created_at?: string;
  updated_at?: string;
}

export interface ModuleCategory {
  id: number;
  name: string;
  description: string;
  icon: string;
  modules?: Module[];
  created_at?: string;
  updated_at?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ModuleService {
  private API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Modules
  getModules(): Observable<ApiResponse<Module[]>> {
    return this.http.get<ApiResponse<Module[]>>(`${this.API_URL}/modules-public`);
  }

  getModule(id: number): Observable<ApiResponse<Module>> {
    return this.http.get<ApiResponse<Module>>(`${this.API_URL}/modules/${id}`);
  }

  createModule(module: Partial<Module>): Observable<ApiResponse<Module>> {
    return this.http.post<ApiResponse<Module>>(`${this.API_URL}/modules`, module);
  }

  updateModule(id: number, module: Partial<Module>): Observable<ApiResponse<Module>> {
    return this.http.put<ApiResponse<Module>>(`${this.API_URL}/modules/${id}`, module);
  }

  deleteModule(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API_URL}/modules/${id}`);
  }

  // Module status management
  activateModule(id: number): Observable<ApiResponse<Module>> {
    return this.http.post<ApiResponse<Module>>(`${this.API_URL}/modules/${id}/activate`, {});
  }

  deactivateModule(id: number): Observable<ApiResponse<Module>> {
    return this.http.post<ApiResponse<Module>>(`${this.API_URL}/modules/${id}/deactivate`, {});
  }

  setMaintenanceMode(id: number): Observable<ApiResponse<Module>> {
    return this.http.post<ApiResponse<Module>>(`${this.API_URL}/modules/${id}/maintenance`, {});
  }

  // Module Permissions
  getModulePermissions(moduleId?: number): Observable<ApiResponse<ModulePermission[]>> {
    const url = moduleId ? `${this.API_URL}/module-permissions?module_id=${moduleId}` : `${this.API_URL}/module-permissions`;
    return this.http.get<ApiResponse<ModulePermission[]>>(url);
  }

  getModulePermission(id: number): Observable<ApiResponse<ModulePermission>> {
    return this.http.get<ApiResponse<ModulePermission>>(`${this.API_URL}/module-permissions/${id}`);
  }

  createModulePermission(permission: Partial<ModulePermission>): Observable<ApiResponse<ModulePermission>> {
    return this.http.post<ApiResponse<ModulePermission>>(`${this.API_URL}/module-permissions`, permission);
  }

  updateModulePermission(id: number, permission: Partial<ModulePermission>): Observable<ApiResponse<ModulePermission>> {
    return this.http.put<ApiResponse<ModulePermission>>(`${this.API_URL}/module-permissions/${id}`, permission);
  }

  deleteModulePermission(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API_URL}/module-permissions/${id}`);
  }

  // Module Categories
  getModuleCategories(): Observable<ApiResponse<ModuleCategory[]>> {
    return this.http.get<ApiResponse<ModuleCategory[]>>(`${this.API_URL}/module-categories`);
  }

  getModuleCategory(id: number): Observable<ApiResponse<ModuleCategory>> {
    return this.http.get<ApiResponse<ModuleCategory>>(`${this.API_URL}/module-categories/${id}`);
  }

  createModuleCategory(category: Partial<ModuleCategory>): Observable<ApiResponse<ModuleCategory>> {
    return this.http.post<ApiResponse<ModuleCategory>>(`${this.API_URL}/module-categories`, category);
  }

  updateModuleCategory(id: number, category: Partial<ModuleCategory>): Observable<ApiResponse<ModuleCategory>> {
    return this.http.put<ApiResponse<ModuleCategory>>(`${this.API_URL}/module-categories/${id}`, category);
  }

  deleteModuleCategory(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API_URL}/module-categories/${id}`);
  }

  // Utility methods
  getActiveModules(): Observable<ApiResponse<Module[]>> {
    return this.http.get<ApiResponse<Module[]>>(`${this.API_URL}/modules?status=ACTIVE`);
  }

  getInactiveModules(): Observable<ApiResponse<Module[]>> {
    return this.http.get<ApiResponse<Module[]>>(`${this.API_URL}/modules?status=INACTIVE`);
  }

  getModulesInMaintenance(): Observable<ApiResponse<Module[]>> {
    return this.http.get<ApiResponse<Module[]>>(`${this.API_URL}/modules?status=MAINTENANCE`);
  }

  getModulesByCategory(categoryId: number): Observable<ApiResponse<Module[]>> {
    return this.http.get<ApiResponse<Module[]>>(`${this.API_URL}/modules?category_id=${categoryId}`);
  }

  installModule(moduleData: any): Observable<ApiResponse<Module>> {
    return this.http.post<ApiResponse<Module>>(`${this.API_URL}/modules/install`, moduleData);
  }

  uninstallModule(id: number): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.API_URL}/modules/${id}/uninstall`, {});
  }

  updateModuleConfig(id: number, config: any): Observable<ApiResponse<Module>> {
    return this.http.put<ApiResponse<Module>>(`${this.API_URL}/modules/${id}/config`, { config });
  }

  getModuleConfig(id: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.API_URL}/modules/${id}/config`);
  }

  checkModuleDependencies(id: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.API_URL}/modules/${id}/dependencies`);
  }
}
