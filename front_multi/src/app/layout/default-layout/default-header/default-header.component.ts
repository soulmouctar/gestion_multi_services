import { NgTemplateOutlet, CommonModule } from '@angular/common';
import { Component, computed, inject, input, NgZone, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

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
import { ModuleService, Module } from '../../../core/services/module.service';
import { PermissionService, UserModulePermission } from '../../../core/services/permission.service';

@Component({
  selector: 'app-default-header',
  templateUrl: './default-header.component.html',
  imports: [CommonModule, ContainerComponent, HeaderTogglerDirective, SidebarToggleDirective, IconDirective, HeaderNavComponent, NavItemComponent, NavLinkDirective, RouterLink, RouterLinkActive, NgTemplateOutlet, BreadcrumbRouterComponent, DropdownComponent, DropdownToggleDirective, AvatarComponent, DropdownMenuDirective, DropdownHeaderDirective, DropdownItemDirective, BadgeComponent, DropdownDividerDirective]
})
export class DefaultHeaderComponent extends HeaderComponent implements OnInit {

  readonly #colorModeService = inject(ColorModeService);
  readonly colorMode = this.#colorModeService.colorMode;
  readonly #authService = inject(AuthService);
  readonly #moduleService = inject(ModuleService);
  readonly #permissionService = inject(PermissionService);
  readonly #ngZone = inject(NgZone);
  readonly #cdr = inject(ChangeDetectorRef);

  // Modules navigation
  activeModules: Module[] = [];
  loadingModules = false;

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

  get currentUser() {
    return this.#authService.currentUser;
  }

  get userRole() {
    return this.#authService.userRole;
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
    const user = this.currentUser;
    if (!user || !user.name) return 'U';
    const names = user.name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return user.name[0].toUpperCase();
  }

  ngOnInit(): void {
    // Defer loading to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.loadActiveModules();
    }, 0);
  }

  sidebarId = input('sidebar1');

  loadActiveModules(): void {
    // Get modules based on user permissions
    this.#permissionService.getNavigationModules().subscribe({
      next: (userModules: UserModulePermission[]) => {
        // Convert user modules to Module format for display
        this.activeModules = userModules.map((userModule: UserModulePermission) => ({
          id: 0, // Will be set by backend
          name: userModule.module_name,
          code: userModule.module_code,
          description: userModule.module_name,
          icon: this.getModuleIcon(userModule.module_code) || '',
          is_active: userModule.is_active,
          permissions: userModule.permissions,
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
      'USERS': '/admin/users',
      'ROLES': '/admin/roles',
      'TENANTS': '/admin/tenants',
      'COMMERCIAL': '/commercial',
      'FINANCE': '/finance',
      'CLIENTS': '/clients',
      'PRODUCTS_STOCK': '/products',
      'CONTAINERS': '/containers',
      'RENTAL': '/rental',
      'TAXI': '/taxi',
      'STATISTICS': '/statistics'
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
