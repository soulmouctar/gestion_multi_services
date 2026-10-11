import { NgTemplateOutlet, CommonModule } from '@angular/common';
import { Component, computed, inject, input, NgZone, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { RouterLink } from '@angular/router';

import {
  BreadcrumbRouterComponent,
  ContainerComponent,
  DropdownComponent,
  DropdownDividerDirective,
  DropdownHeaderDirective,
  DropdownItemDirective,
  DropdownMenuDirective,
  DropdownToggleDirective,
  HeaderComponent,
  HeaderNavComponent,
  HeaderTogglerDirective,
  SidebarToggleDirective
} from '@coreui/angular';

import { IconDirective } from '@coreui/icons-angular';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeMode, ThemeService } from '../../../core/services/theme.service';
import { ApiService } from '../../../core/services/api.service';
import { resolveUploadUrl } from '../../../core/utils/upload-url.util';

@Component({
  selector: 'app-default-header',
  templateUrl: './default-header.component.html',
  styleUrls: ['./default-header.component.scss'],
  imports: [CommonModule, FormsModule, ContainerComponent, HeaderTogglerDirective, SidebarToggleDirective, IconDirective, HeaderNavComponent, RouterLink, NgTemplateOutlet, BreadcrumbRouterComponent, DropdownComponent, DropdownToggleDirective, DropdownMenuDirective, DropdownHeaderDirective, DropdownItemDirective, DropdownDividerDirective]
})
export class DefaultHeaderComponent extends HeaderComponent implements OnInit, OnDestroy {

  readonly #themeService = inject(ThemeService);
  readonly colorMode = this.#themeService.mode;
  readonly #authService = inject(AuthService);
  readonly #apiService = inject(ApiService);
  readonly #ngZone = inject(NgZone);
  readonly #cdr = inject(ChangeDetectorRef);

  // Modules navigation
  loadingTenants = false;
  managedTenants: any[] = [];
  selectedManagedTenantId: number | null = null;
  avatarLoadFailed = false;

  currentUser = this.#authService.currentUser;
  private _authSub?: Subscription;

  readonly colorModes: { name: ThemeMode; text: string; icon: string }[] = [
    { name: 'light', text: 'Clair', icon: 'cilSun' },
    { name: 'dark', text: 'Sombre', icon: 'cilMoon' },
    { name: 'auto', text: 'Automatique', icon: 'cilContrast' }
  ];

  setColorMode(mode: ThemeMode): void {
    this.#themeService.setMode(mode);
  }

  readonly icons = computed(() => {
    const currentMode = this.colorMode();
    return this.colorModes.find(mode => mode.name === currentMode)?.icon ?? 'cilSun';
  });

  constructor() {
    super();
  }

  get userRole() {
    const user = this.currentUser as any;
    if (user?.roles && Array.isArray(user.roles) && user.roles.length > 0) {
      return user.roles[0].name as string;
    }
    return user?.role || null;
  }

  get userRoleTitle() {
    const role = this.userRole;
    switch (role) {
      case 'SUPER_ADMIN':
        return 'Super Administrateur';
      case 'ADMIN':
        return 'Administrateur';
      case 'USER':
        return 'Utilisateur';
      default:
        return 'Utilisateur';
    }
  }

  get userInitials() {
    const name = this.currentUser?.name;
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
  }

  get userAvatarUrl(): string | undefined {
    const avatar = (this.currentUser as any)?.avatar_url || (this.currentUser as any)?.avatar;
    if (!avatar || this.avatarLoadFailed) {
      return undefined;
    }

    if (typeof avatar !== 'string') {
      return undefined;
    }

    return resolveUploadUrl(avatar);
  }

  ngOnInit(): void {
    this._authSub = this.#authService.authState$.subscribe(state => {
      this.currentUser = state.user;
      this.avatarLoadFailed = false;
      this.selectedManagedTenantId = this.#authService.selectedManagedTenantId;
      if (this.userRole === 'SUPER_ADMIN') {
        this.loadManagedTenants();
      }
      this.#cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this._authSub?.unsubscribe();
  }

  sidebarId = input('sidebar1');

  loadManagedTenants(): void {
    // Une seule fois : l'état d'authentification est réémis à chaque mise à jour
    // du profil ou de l'organisation, ce qui rechargeait la liste à chaque page.
    if (this.loadingTenants || this.managedTenants.length > 0) {
      return;
    }

    this.loadingTenants = true;
    this.#apiService.get<any>('tenants?per_page=200').subscribe({
      next: (response) => {
        const tenants = response.success ? (response.data?.data || response.data || []) : [];
        this.managedTenants = Array.isArray(tenants) ? tenants : [];

        if (!this.selectedManagedTenantId && this.managedTenants.length > 0) {
          this.selectedManagedTenantId = this.#authService.selectedManagedTenantId ?? this.managedTenants[0].id;
          this.#authService.setSelectedManagedTenantId(this.selectedManagedTenantId);
        }

        this.loadingTenants = false;
        this.#cdr.detectChanges();
      },
      error: () => {
        this.loadingTenants = false;
        this.#cdr.detectChanges();
      }
    });
  }

  onManagedTenantChange(): void {
    this.#authService.setSelectedManagedTenantId(this.selectedManagedTenantId);
    window.location.reload();
  }

  onAvatarError(): void {
    this.avatarLoadFailed = true;
    this.#cdr.detectChanges();
  }

  logout(): void {
    // Use NgZone to ensure proper logout without Angular errors
    this.#ngZone.runOutsideAngular(() => {
      this.#ngZone.run(() => {
        this.#authService.logout();
      });
    });
  }

}
