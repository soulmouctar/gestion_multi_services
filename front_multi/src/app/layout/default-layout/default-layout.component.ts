import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NgScrollbar } from 'ngx-scrollbar';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import {
  ContainerComponent,
  ShadowOnScrollDirective,
  SidebarBrandComponent,
  SidebarComponent,
  SidebarFooterComponent,
  SidebarHeaderComponent,
  SidebarNavComponent,
  SidebarToggleDirective,
  SidebarTogglerDirective,
  INavData
} from '@coreui/angular';

import { DefaultFooterComponent, DefaultHeaderComponent } from './';
import { NavigationService } from '../../core/services/navigation.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantService } from '../../core/services/tenant.service';

@Component({
  selector: 'app-default-layout',
  templateUrl: './default-layout.component.html',
  styleUrls: ['./default-layout.component.scss'],
  imports: [
    CommonModule,
    SidebarComponent,
    SidebarHeaderComponent,
    SidebarBrandComponent,
    SidebarNavComponent,
    SidebarFooterComponent,
    SidebarToggleDirective,
    SidebarTogglerDirective,
    ContainerComponent,
    DefaultFooterComponent,
    DefaultHeaderComponent,
    NgScrollbar,
    RouterOutlet,
    RouterLink,
    ShadowOnScrollDirective
  ]
})
export class DefaultLayoutComponent implements OnInit, OnDestroy {
  public navItems: INavData[] = [];
  readonly defaultLogoUrl = '/assets/images/logo/logo_matkolla_2026.jpeg';
  public appLogoUrl = this.defaultLogoUrl;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private navigationService: NavigationService,
    private authService: AuthService,
    private tenantService: TenantService
  ) {}

  ngOnInit(): void {
    this.navigationService.getNavigationItems().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (items: INavData[]) => {
        this.navItems = items;
      },
      error: () => {
        this.navItems = [];
      }
    });

    this.authService.authState$.pipe(takeUntil(this.destroy$)).subscribe(state => {
      this.appLogoUrl = state.tenant?.logo_url || state.user?.tenant?.logo_url || this.defaultLogoUrl;
    });

    if (!this.authService.isSuperAdmin || this.authService.currentUser?.tenant_id) {
      this.tenantService.getMyTenant().pipe(takeUntil(this.destroy$)).subscribe({
        next: response => {
          if (response.data) {
            this.authService.updateCurrentTenant(response.data);
          }
        },
        error: () => {
          this.appLogoUrl = this.authService.currentTenant?.logo_url || this.defaultLogoUrl;
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
