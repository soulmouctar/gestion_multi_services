import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { TenantService, Tenant, ApiResponse } from './tenant.service';

@Injectable({
  providedIn: 'root'
})
export class OrganisationFilterService {
  private selectedOrganisationSubject = new BehaviorSubject<Tenant | null>(null);
  private availableOrganisationsSubject = new BehaviorSubject<Tenant[]>([]);

  public selectedOrganisation$ = this.selectedOrganisationSubject.asObservable();
  public availableOrganisations$ = this.availableOrganisationsSubject.asObservable();

  constructor(
    private authService: AuthService,
    private tenantService: TenantService
  ) {
    this.initializeOrganisationFilter();
  }

  private initializeOrganisationFilter(): void {
    const user = this.authService.currentUser;
    
    if (!user) return;

    const userRoles = user.roles?.map((role: any) => role.name || role) || [];

    if (userRoles.includes('SUPER_ADMIN')) {
      // SUPER_ADMIN peut voir toutes les organisations
      this.loadAllOrganisations();
    } else if (userRoles.includes('ADMIN')) {
      // ADMIN ne peut voir que son organisation
      if (user.tenant) {
        this.availableOrganisationsSubject.next([user.tenant]);
        this.selectedOrganisationSubject.next(user.tenant);
      }
    }
  }

  private loadAllOrganisations(): void {
    this.tenantService.getTenants().subscribe({
      next: (response: ApiResponse<any>) => {
        let organisations: Tenant[] = [];
        
        if (response.data && response.data.data && Array.isArray(response.data.data)) {
          organisations = response.data.data;
        } else if (Array.isArray(response.data)) {
          organisations = response.data;
        }
        
        this.availableOrganisationsSubject.next(organisations);
        
        // Sélectionner la première organisation par défaut si aucune n'est sélectionnée
        if (organisations.length > 0 && !this.selectedOrganisationSubject.value) {
          this.selectedOrganisationSubject.next(organisations[0]);
        }
      },
      error: (error) => {
        console.error('Error loading organisations:', error);
        this.availableOrganisationsSubject.next([]);
      }
    });
  }

  public selectOrganisation(organisation: Tenant): void {
    this.selectedOrganisationSubject.next(organisation);
  }

  public getSelectedOrganisation(): Tenant | null {
    return this.selectedOrganisationSubject.value;
  }

  public getAvailableOrganisations(): Tenant[] {
    return this.availableOrganisationsSubject.value;
  }

  public canSelectOrganisation(): boolean {
    const user = this.authService.currentUser;
    const userRoles = user?.roles?.map((role: any) => role.name || role) || [];
    return userRoles.includes('SUPER_ADMIN');
  }

  public getCurrentUserRole(): string | null {
    const user = this.authService.currentUser;
    const userRoles = user?.roles?.map((role: any) => role.name || role) || [];
    
    if (userRoles.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
    if (userRoles.includes('ADMIN')) return 'ADMIN';
    if (userRoles.includes('USER')) return 'USER';
    if (userRoles.includes('VIEWER')) return 'VIEWER';
    
    return null;
  }

  public hasRole(role: string): boolean {
    const user = this.authService.currentUser;
    const userRoles = user?.roles?.map((role: any) => role.name || role) || [];
    return userRoles.includes(role);
  }

  public canManageUsers(): boolean {
    return this.hasRole('SUPER_ADMIN') || this.hasRole('ADMIN');
  }

  public canManageSettings(): boolean {
    return this.hasRole('SUPER_ADMIN') || this.hasRole('ADMIN');
  }

  public canViewAllOrganisations(): boolean {
    return this.hasRole('SUPER_ADMIN');
  }
}
