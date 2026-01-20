import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from './tenant.service';
import { environment } from '../../../environments/environment';

export interface Role {
  id: number;
  name: string;
  guard_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface Permission {
  id: number;
  name: string;
  guard_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  tenant_id?: number;
  tenant?: {
    id: number;
    name: string;
    email: string;
  };
  role: 'SUPER_ADMIN' | 'ADMIN' | 'USER';
  module_permissions?: ModulePermission[];
  created_at: string;
  updated_at: string;
}

export interface ModulePermission {
  module_code: string;
  module_name: string;
  permissions: string[];
  is_active: boolean;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  tenant_id?: number;
  role?: string;
  module_permissions?: ModulePermission[];
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  password?: string;
  tenant_id?: number;
  role?: string;
  module_permissions?: ModulePermission[];
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // CRUD Operations
  getUsers(tenantId?: number): Observable<ApiResponse<any>> {
    const params = tenantId ? `?tenant_id=${tenantId}` : '';
    return this.http.get<ApiResponse<any>>(`${this.API_URL}/users-public${params}`);
  }

  getUser(id: number): Observable<ApiResponse<UserProfile>> {
    return this.http.get<ApiResponse<UserProfile>>(`${this.API_URL}/users/${id}`, {
      headers: this.getAuthHeaders()
    });
  }

  createUser(userData: CreateUserRequest): Observable<ApiResponse<UserProfile>> {
    return this.http.post<ApiResponse<UserProfile>>(`${this.API_URL}/users`, userData, {
      headers: this.getAuthHeaders()
    });
  }

  updateUser(id: number, userData: UpdateUserRequest): Observable<ApiResponse<UserProfile>> {
    return this.http.put<ApiResponse<UserProfile>>(`${this.API_URL}/users/${id}`, userData, {
      headers: this.getAuthHeaders()
    });
  }

  deleteUser(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.API_URL}/users/${id}`, {
      headers: this.getAuthHeaders()
    });
  }

  // Role Management
  assignRole(userId: number, role: string): Observable<ApiResponse<UserProfile>> {
    return this.http.post<ApiResponse<UserProfile>>(`${this.API_URL}/users/${userId}/assign-role`, 
      { role }, 
      { headers: this.getAuthHeaders() }
    );
  }

  removeRole(userId: number, role: string): Observable<ApiResponse<UserProfile>> {
    return this.http.post<ApiResponse<UserProfile>>(`${this.API_URL}/users/${userId}/remove-role`, 
      { role }, 
      { headers: this.getAuthHeaders() }
    );
  }

  // Get available roles
  getRoles(): Observable<ApiResponse<Role[]>> {
    return this.http.get<ApiResponse<Role[]>>(`${this.API_URL}/roles-public`);
  }

  // Get available permissions
  getPermissions(): Observable<ApiResponse<Permission[]>> {
    return this.http.get<ApiResponse<Permission[]>>(`${this.API_URL}/permissions-public`);
  }

  // Module-based permissions
  getUserModulePermissions(userId: number): Observable<ApiResponse<ModulePermission[]>> {
    return this.http.get<ApiResponse<ModulePermission[]>>(`${this.API_URL}/users/${userId}/module-permissions-public`);
  }

  updateUserModulePermissions(userId: number, modulePermissions: ModulePermission[]): Observable<ApiResponse<any>> {
    // Ensure is_active is boolean and permissions is array
    const sanitizedPermissions = modulePermissions.map(module => ({
      ...module,
      is_active: Boolean(module.is_active),
      permissions: Array.isArray(module.permissions) ? module.permissions : []
    }));
    
    const payload = { module_permissions: sanitizedPermissions };
    
    // Debug: Log the exact payload being sent
    console.log('UserService - Sending payload:', JSON.stringify(payload, null, 2));
    console.log('UserService - URL:', `${this.API_URL}/users/${userId}/module-permissions-public`);
    
    return this.http.post<ApiResponse<any>>(`${this.API_URL}/users/${userId}/module-permissions-public`, payload);
  }

  // Available modules (from tenant component)
  getAvailableModules(): ModulePermission[] {
    return [
      {
        module_code: 'COMMERCIAL',
        module_name: 'Gestion Commerciale',
        permissions: ['view', 'create', 'edit', 'delete'],
        is_active: false
      },
      {
        module_code: 'FINANCE',
        module_name: 'Gestion Financière',
        permissions: ['view', 'create', 'edit', 'delete', 'approve'],
        is_active: false
      },
      {
        module_code: 'CLIENTS_SUPPLIERS',
        module_name: 'Clients & Fournisseurs',
        permissions: ['view', 'create', 'edit', 'delete'],
        is_active: false
      },
      {
        module_code: 'PRODUCTS_STOCK',
        module_name: 'Produits & Stock',
        permissions: ['view', 'create', 'edit', 'delete', 'manage_stock'],
        is_active: false
      },
      {
        module_code: 'CONTAINERS',
        module_name: 'Conteneurs',
        permissions: ['view', 'create', 'edit', 'delete', 'track'],
        is_active: false
      },
      {
        module_code: 'RENTAL',
        module_name: 'Location Immobilière',
        permissions: ['view', 'create', 'edit', 'delete', 'manage_contracts'],
        is_active: false
      },
      {
        module_code: 'TAXI',
        module_name: 'Gestion Taxi',
        permissions: ['view', 'create', 'edit', 'delete', 'assign_drivers'],
        is_active: false
      },
      {
        module_code: 'STATISTICS',
        module_name: 'Statistiques',
        permissions: ['view', 'export'],
        is_active: false
      }
    ];
  }

  // Utility methods
  getAvailableRoles(): string[] {
    return ['SUPER_ADMIN', 'ADMIN', 'USER', 'VIEWER'];
  }

  getRoleDisplayName(role: string): string {
    const roleNames: { [key: string]: string } = {
      'SUPER_ADMIN': 'Super Administrateur',
      'ADMIN': 'Administrateur',
      'USER': 'Utilisateur',
      'VIEWER': 'Lecteur'
    };
    return roleNames[role] || role;
  }

  getPermissionDisplayName(permission: string): string {
    const permissionNames: { [key: string]: string } = {
      'view': 'Consulter',
      'create': 'Créer',
      'edit': 'Modifier',
      'delete': 'Supprimer',
      'approve': 'Approuver',
      'manage_stock': 'Gérer Stock',
      'track': 'Suivre',
      'manage_contracts': 'Gérer Contrats',
      'assign_drivers': 'Assigner Chauffeurs',
      'export': 'Exporter'
    };
    return permissionNames[permission] || permission;
  }
}
