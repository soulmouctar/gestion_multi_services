import { NgTemplateOutlet, CommonModule } from '@angular/common';
import { Component, computed, inject, input, NgZone, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { environment } from '../../../../environments/environment';

import {
  AvatarComponent,
  BadgeComponent,
  BreadcrumbRouterComponent,
  ColorModeService,
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
  NavItemComponent,
  NavLinkDirective,
  SidebarToggleDirective
} from '@coreui/angular';

import { IconDirective } from '@coreui/icons-angular';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { ModuleService, Module } from '../../../core/services/module.service';
import { PermissionService, UserModulePermission } from '../../../core/services/permission.service';

@Component({
  selector: 'app-default-header',
  templateUrl: './default-header.component.html',
  styleUrls: ['./default-header.component.scss'],
  imports: [CommonModule, FormsModule, ContainerComponent, HeaderTogglerDirective, SidebarToggleDirective, IconDirective, HeaderNavComponent, NavItemComponent, NavLinkDirective, RouterLink, RouterLinkActive, NgTemplateOutlet, BreadcrumbRouterComponent, DropdownComponent, DropdownToggleDirective, AvatarComponent, DropdownMenuDirective, DropdownHeaderDirective, DropdownItemDirective, BadgeComponent, DropdownDividerDirective]
})
export class DefaultHeaderComponent extends HeaderComponent implements OnInit, OnDestroy {

  readonly #colorModeService = inject(ColorModeService);
  readonly colorMode = this.#colorModeService.colorMode;
  readonly #authService = inject(AuthService);
  readonly #apiService = inject(ApiService);
  readonly #moduleService = inject(ModuleService);
  readonly #permissionService = inject(PermissionService);
  readonly #ngZone = inject(NgZone);
  readonly #cdr = inject(ChangeDetectorRef);

  // Modules navigation
  activeModules: Module[] = [];
  loadingModules = false;
  loadingTenants = false;
  managedTenants: any[] = [];
  selectedManagedTenantId: number | null = null;
  avatarLoadFailed = false;

  currentUser = this.#authService.currentUser;
  private _authSub?: Subscription;
  private readonly backendBaseUrl = environment.apiUrl.replace(/\/api\/?$/, '');

  readonly colorModes = [
    { name: 'light', text: 'Light', icon: 'cilSun' },
    { name: 'dark', text: 'Dark', icon: 'cilMoon' },
    { name: 'auto', text: 'Auto', icon: 'cilContrast' }
  ];

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

    if (/^https?:\/\//i.test(avatar) || avatar.startsWith('data:')) {
      return avatar;
    }

    if (avatar.startsWith('/')) {
      return `${this.backendBaseUrl}${avatar}`;
    }

    return `${this.backendBaseUrl}/${avatar.replace(/^\/+/, '')}`;
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
    setTimeout(() => { this.loadActiveModules(); }, 0);
  }

  ngOnDestroy(): void {
    this._authSub?.unsubscribe();
  }

  sidebarId = input('sidebar1');

  loadManagedTenants(): void {
    if (this.loadingTenants) {
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

  loadActiveModules(): void {
    // Get modules based on user permissions
    this.#permissionService.getNavigationModules().subscribe({
      next: (userModules: UserModulePermission[]) => {
        // Convert user modules to Module format for display
        this.activeModules = userModules.map((userModule: UserModulePermission) => ({
          id: 0, // Will be set by backend
          name: userModule.module_name ?? userModule.module_code,
          code: userModule.module_code,
          description: userModule.module_name ?? '',
          icon: this.getModuleIcon(userModule.module_code) || '',
          is_active: userModule.is_active,
          permissions: userModule.permissions ?? [],
          route: this.getModuleRoute(userModule.module_code)
        }));
        this.loadingModules = false;
        this.#cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading user modules:', error);
        this.activeModules = [];
        this.loadingModules = false;
        this.#cdr.detectChanges();
      }
    });
  }

  public newMessages = [
    {
      id: 0,
      from: 'Jessica Williams',
      avatar: '7.jpg',
      status: 'success',
      title: 'Urgent: System Maintenance Tonight',
      time: 'Just now',
      link: 'apps/email/inbox/message',
      message: 'Attention team, we\'ll be conducting critical system maintenance tonight from 10 PM to 2 AM. Plan accordingly...'
    },
    {
      id: 1,
      from: 'Richard Johnson',
      avatar: '6.jpg',
      status: 'warning',
      title: 'Project Update: Milestone Achieved',
      time: '5 minutes ago',
      link: 'apps/email/inbox/message',
      message: 'Kudos on hitting sales targets last quarter! Let\'s keep the momentum. New goals, new victories ahead...'
    },
    {
      id: 2,
      from: 'Angela Rodriguez',
      avatar: '5.jpg',
      status: 'danger',
      title: 'Social Media Campaign Launch',
      time: '1:52 PM',
      link: 'apps/email/inbox/message',
      message: 'Exciting news! Our new social media campaign goes live tomorrow. Brace yourselves for engagement...'
    },
    {
      id: 3,
      from: 'Jane Lewis',
      avatar: '4.jpg',
      status: 'info',
      title: 'Inventory Checkpoint',
      time: '4:03 AM',
      link: 'apps/email/inbox/message',
      message: 'Team, it\'s time for our monthly inventory check. Accurate counts ensure smooth operations. Let\'s nail it...'
    },
    {
      id: 4,
      from: 'Ryan Miller',
      avatar: '3.jpg',
      status: 'info',
      title: 'Customer Feedback Results',
      time: '3 days ago',
      link: 'apps/email/inbox/message',
      message: 'Our latest customer feedback is in. Let\'s analyze and discuss improvements for an even better service...'
    }
  ];

  public newNotifications = [
    { id: 0, title: 'New user registered', icon: 'cilUserFollow', color: 'success' },
    { id: 1, title: 'User deleted', icon: 'cilUserUnfollow', color: 'danger' },
    { id: 2, title: 'Sales report is ready', icon: 'cilChartPie', color: 'info' },
    { id: 3, title: 'New client', icon: 'cilBasket', color: 'primary' },
    { id: 4, title: 'Server overloaded', icon: 'cilSpeedometer', color: 'warning' }
  ];

  public newStatus = [
    { id: 0, title: 'CPU Usage', value: 25, color: 'info', details: '348 Processes. 1/4 Cores.' },
    { id: 1, title: 'Memory Usage', value: 70, color: 'warning', details: '11444GB/16384MB' },
    { id: 2, title: 'SSD 1 Usage', value: 90, color: 'danger', details: '243GB/256GB' }
  ];

  public newTasks = [
    { id: 0, title: 'Upgrade NPM', value: 0, color: 'info' },
    { id: 1, title: 'ReactJS Version', value: 25, color: 'danger' },
    { id: 2, title: 'VueJS Version', value: 50, color: 'warning' },
    { id: 3, title: 'Add new layouts', value: 75, color: 'info' },
    { id: 4, title: 'Angular Version', value: 100, color: 'success' }
  ];

  getModuleRoute(moduleCode: string): string {
    // Générer la route basée sur le code du module
    const routeMap: { [key: string]: string } = {
      'MODULES': '/admin/modules',
      'SUBSCRIPTION_PLANS': '/admin/subscription-plans',
      'SUBSCRIPTIONS': '/admin/subscriptions',
      'USERS': '/organisation/users',
      'ROLES': '/admin/roles',
      'TENANTS': '/admin/tenants',
      'COMMERCIAL': '/commercial',
      'FINANCE': '/finance',
      'CLIENTS': '/clients',
      'CLIENTS_SUPPLIERS': '/clients',
      'PRODUCTS_STOCK': '/products',
      'CONTAINERS': '/containers',
      'RENTAL': '/rental',
      'TAXI': '/taxi',
      'STATISTICS': '/statistics',
      'EXPENSES': '/expenses',
      'BANKING': '/banking'
    };
    
    return routeMap[moduleCode] || `/module/${moduleCode.toLowerCase()}`;
  }

  getModuleIcon(moduleCode: string): string {
    // Mapper les icônes basées sur le code du module
    const iconMap: { [key: string]: string } = {
      'MODULES': 'cilPuzzle',
      'SUBSCRIPTION_PLANS': 'cilCreditCard',
      'SUBSCRIPTIONS': 'cilUser',
      'USERS': 'cilPeople',
      'ROLES': 'cilShieldAlt',
      'TENANTS': 'cilApplicationsSettings',
      'COMMERCIAL': 'cilBasket',
      'FINANCE': 'cilDollar',
      'CLIENTS': 'cilPeople',
      'PRODUCTS_STOCK': 'cilGrid',
      'CONTAINERS': 'cilLayers',
      'RENTAL': 'cilHome',
      'TAXI': 'cilLocationPin',
      'STATISTICS': 'cilChart'
    };
    
    return iconMap[moduleCode] || 'cilApps';
  }

  // Template helper methods to avoid ExpressionChangedAfterItHasBeenCheckedError
  shouldShowModulesDropdown(): boolean {
    return this.activeModules.length > 0 || this.loadingModules;
  }

  isLoadingModules(): boolean {
    return this.loadingModules;
  }

  hasActiveModules(): boolean {
    return this.activeModules.length > 0;
  }

  getActiveModules(): Module[] {
    return this.activeModules;
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
