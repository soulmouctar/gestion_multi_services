import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Role {
  id: number;
  name: string;
  guard_name: string;
  permissions?: Permission[];
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

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class RoleService {
  private API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Role CRUD operations
  getRoles(): Observable<ApiResponse<Role[]>> {
    return this.http.get<ApiResponse<Role[]>>(`${this.API_URL}/roles-public`);
  }

  getRole(id: number): Observable<ApiResponse<Role>> {
    return this.http.get<ApiResponse<Role>>(`${this.API_URL}/roles-public/${id}`);
  }

  createRole(role: Partial<Role>): Observable<ApiResponse<Role>> {
    return this.http.post<ApiResponse<Role>>(`${this.API_URL}/roles-public`, role);
  }

  updateRole(id: number, role: Partial<Role>): Observable<ApiResponse<Role>> {
    return this.http.put<ApiResponse<Role>>(`${this.API_URL}/roles-public/${id}`, role);
  }

  deleteRole(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API_URL}/roles-public/${id}`);
  }

  // Permission operations
  getPermissions(): Observable<ApiResponse<Permission[]>> {
    return this.http.get<ApiResponse<Permission[]>>(`${this.API_URL}/permissions-public`);
  }

  createPermission(permission: Partial<Permission>): Observable<ApiResponse<Permission>> {
    return this.http.post<ApiResponse<Permission>>(`${this.API_URL}/permissions-public`, permission);
  }

  deletePermission(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API_URL}/permissions-public/${id}`);
  }

  // Utility methods
  getRoleDisplayName(roleName: string): string {
    const roleNames: { [key: string]: string } = {
      'SUPER_ADMIN': 'Super Administrateur',
      'ADMIN': 'Administrateur',
      'USER': 'Utilisateur',
      'VIEWER': 'Lecteur'
    };
    return roleNames[roleName] || roleName;
  }

  getPermissionDisplayName(permissionName: string): string {
    const parts = permissionName.split('.');
    if (parts.length === 2) {
      const [module, action] = parts;
      const moduleNames: { [key: string]: string } = {
        'tenant': 'Tenant',
        'user': 'Utilisateur',
        'module': 'Module',
        'subscription': 'Abonnement',
        'product': 'Produit',
        'client': 'Client',
        'supplier': 'Fournisseur',
        'invoice': 'Facture',
        'payment': 'Paiement',
        'container': 'Conteneur',
        'location': 'Location',
        'building': 'Bâtiment',
        'housing_unit': 'Logement',
        'driver': 'Chauffeur',
        'taxi': 'Taxi'
      };
      
      const actionNames: { [key: string]: string } = {
        'view': 'Consulter',
        'create': 'Créer',
        'update': 'Modifier',
        'delete': 'Supprimer'
      };
      
      const moduleName = moduleNames[module] || module;
      const actionName = actionNames[action] || action;
      
      return `${moduleName} - ${actionName}`;
    }
    return permissionName;
  }

  getAvailableRoles(): string[] {
    return ['SUPER_ADMIN', 'ADMIN', 'USER', 'VIEWER'];
  }
}
