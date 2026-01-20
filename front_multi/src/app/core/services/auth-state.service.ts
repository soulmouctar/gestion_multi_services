import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map, filter, distinctUntilChanged } from 'rxjs';
import { AuthService } from './auth.service';
import { PermissionService } from './permission.service';

@Injectable({
  providedIn: 'root'
})
export class AuthStateService {
  private _isFullyInitialized = new BehaviorSubject<boolean>(false);
  
  constructor(
    private authService: AuthService,
    private permissionService: PermissionService
  ) {
    this.initializeAuthState();
  }

  private initializeAuthState(): void {
    // Listen for auth state changes
    combineLatest([
      this.authService.authState$,
      this.permissionService.userPermissions$
    ]).pipe(
      map(([authState, permissions]) => {
        // User is fully initialized when:
        // 1. They are authenticated AND have permissions loaded
        // 2. OR they are not authenticated (no permissions needed)
        return !authState.isAuthenticated || 
               (authState.isAuthenticated && permissions !== null);
      }),
      distinctUntilChanged()
    ).subscribe(isInitialized => {
      this._isFullyInitialized.next(isInitialized);
    });
  }

  get isFullyInitialized$(): Observable<boolean> {
    return this._isFullyInitialized.asObservable();
  }

  get isFullyInitialized(): boolean {
    return this._isFullyInitialized.value;
  }

  /**
   * Wait for the auth state to be fully initialized
   */
  waitForInitialization(): Observable<boolean> {
    return this.isFullyInitialized$.pipe(
      filter(initialized => initialized === true)
    );
  }

  /**
   * Force reload of permissions and navigation
   */
  forceReload(): void {
    // Simply trigger a reload by clearing and reloading the auth state
    if (this.authService.isAuthenticated) {
      window.location.reload();
    }
  }
}
