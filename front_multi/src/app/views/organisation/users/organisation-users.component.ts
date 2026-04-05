import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { UserService, UserProfile, ModulePermission } from '../../../core/services/user.service';
import { AlertService } from '../../../core/services/alert.service';

@Component({
  selector: 'app-organisation-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  styles: [`
    .page-header {
      background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%);
      border-radius: 16px;
      padding: 28px 32px;
      margin-bottom: 24px;
      color: white;
    }
    .page-header h2 { font-size: 1.6rem; font-weight: 700; margin: 0 0 4px; }
    .page-header p { margin: 0; opacity: 0.8; font-size: 0.9rem; }
    .stat-pill {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(255,255,255,0.15); border-radius: 50px;
      padding: 6px 16px; font-size: 0.85rem;
    }
    .kpi-row { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .kpi-card {
      flex: 1; min-width: 140px; background: white; border-radius: 12px;
      padding: 18px 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.07);
      border-left: 4px solid;
    }
    .kpi-card .kpi-label { font-size: 0.75rem; color: #6c757d; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-card .kpi-value { font-size: 1.8rem; font-weight: 700; line-height: 1; margin: 4px 0; }
    .main-card { background: white; border-radius: 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.07); overflow: hidden; }
    .card-header-bar {
      padding: 16px 24px; border-bottom: 1px solid #f0f0f0;
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
    }
    .card-header-bar h5 { margin: 0; font-weight: 600; font-size: 1rem; }
    .search-box {
      position: relative; flex: 1; max-width: 300px;
    }
    .search-box input {
      width: 100%; padding: 8px 12px 8px 36px; border: 1px solid #dee2e6;
      border-radius: 8px; font-size: 0.875rem; background: #f8f9fa;
    }
    .search-box .search-icon {
      position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
      color: #6c757d; font-size: 0.85rem;
    }
    .btn-create {
      background: linear-gradient(135deg, #1a237e, #3949ab);
      color: white; border: none; border-radius: 8px;
      padding: 8px 20px; font-size: 0.875rem; font-weight: 600; cursor: pointer;
      white-space: nowrap;
    }
    .btn-create:hover { opacity: 0.9; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f8f9fa; padding: 12px 16px; text-align: left; font-size: 0.75rem; font-weight: 600; color: #6c757d; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e9ecef; }
    td { padding: 14px 16px; border-bottom: 1px solid #f0f0f0; font-size: 0.875rem; vertical-align: middle; }
    tr:hover td { background: #fafafa; }
    .avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; color: white; flex-shrink: 0; }
    .user-info { display: flex; align-items: center; gap: 12px; }
    .user-name { font-weight: 600; color: #212529; }
    .user-email { font-size: 0.8rem; color: #6c757d; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 50px; font-size: 0.75rem; font-weight: 600; }
    .badge-admin { background: #fff3cd; color: #856404; }
    .badge-user { background: #cfe2ff; color: #0a58ca; }
    .badge-active { background: #d1e7dd; color: #0f5132; }
    .badge-inactive { background: #f8d7da; color: #842029; }
    .actions { display: flex; gap: 6px; }
    .btn-icon { background: none; border: 1px solid #dee2e6; border-radius: 8px; padding: 6px 10px; cursor: pointer; font-size: 0.8rem; color: #6c757d; transition: all 0.15s; }
    .btn-icon:hover { background: #f8f9fa; }
    .btn-icon.btn-edit:hover { border-color: #0d6efd; color: #0d6efd; }
    .btn-icon.btn-toggle:hover { border-color: #198754; color: #198754; }
    .btn-icon.btn-toggle.active:hover { border-color: #dc3545; color: #dc3545; }
    .btn-icon.btn-perm:hover { border-color: #6f42c1; color: #6f42c1; }
    .btn-icon.btn-pwd:hover { border-color: #fd7e14; color: #fd7e14; }
    .empty-state { text-align: center; padding: 60px 20px; color: #6c757d; }
    .empty-icon { font-size: 3rem; margin-bottom: 12px; }
    .loading-state { text-align: center; padding: 40px; color: #6c757d; }
    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center; z-index: 1050; padding: 20px;
    }
    .modal-box { background: white; border-radius: 16px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .modal-header { padding: 20px 24px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
    .modal-header h5 { margin: 0; font-weight: 700; font-size: 1.1rem; }
    .modal-body { padding: 24px; }
    .modal-footer { padding: 16px 24px; border-top: 1px solid #f0f0f0; display: flex; justify-content: flex-end; gap: 10px; }
    .form-label { font-size: 0.8rem; font-weight: 600; color: #495057; margin-bottom: 4px; display: block; }
    .form-control {
      width: 100%; padding: 9px 12px; border: 1px solid #dee2e6;
      border-radius: 8px; font-size: 0.875rem; box-sizing: border-box;
    }
    .form-control:focus { outline: none; border-color: #3949ab; box-shadow: 0 0 0 3px rgba(57,73,171,0.1); }
    .form-group { margin-bottom: 16px; }
    .error-text { font-size: 0.75rem; color: #dc3545; margin-top: 3px; }
    .btn-cancel { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 9px 20px; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
    .btn-save { background: linear-gradient(135deg, #1a237e, #3949ab); color: white; border: none; border-radius: 8px; padding: 9px 24px; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
    .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
    .section-title { font-size: 0.8rem; font-weight: 700; color: #495057; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #f0f0f0; }
    .module-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px; }
    .module-name { flex: 1; font-size: 0.875rem; font-weight: 500; }
    .toggle-switch { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .toggle-slider { position: absolute; cursor: pointer; inset: 0; background: #dee2e6; border-radius: 22px; transition: 0.3s; }
    .toggle-slider:before { position: absolute; content: ''; width: 16px; height: 16px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
    .toggle-switch input:checked + .toggle-slider { background: #3949ab; }
    .toggle-switch input:checked + .toggle-slider:before { transform: translateX(18px); }
    .perm-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
    .perm-pill { padding: 3px 10px; border-radius: 50px; font-size: 0.72rem; font-weight: 600; cursor: pointer; border: 1px solid; }
    .perm-pill.active { background: #cfe2ff; color: #0a58ca; border-color: #0a58ca; }
    .perm-pill.inactive { background: white; color: #adb5bd; border-color: #dee2e6; }
  `],
  template: `
    <div class="p-3 p-md-4">

      <!-- Header -->
      <div class="mb-4" style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:16px;padding:28px 32px;color:white;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <h2 style="font-size:1.6rem;font-weight:700;margin:0 0 4px;">Gestion des Utilisateurs</h2>
            <p style="margin:0;opacity:0.75;font-size:0.9rem;">Gerez les utilisateurs de votre organisation</p>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <span style="background:rgba(255,255,255,0.15);border-radius:50px;padding:5px 16px;font-size:0.85rem;">Total: <strong>{{ users.length }}</strong></span>
            <span style="background:rgba(16,185,129,0.25);border-radius:50px;padding:5px 16px;font-size:0.85rem;">Actifs: <strong>{{ activeCount }}</strong></span>
            <button class="btn-create" (click)="openModal()">+ Nouvel Utilisateur</button>
          </div>
        </div>
      </div>

      <!-- KPIs -->
      <div class="kpi-row">
        <div class="kpi-card" style="border-color:#3949ab">
          <div class="kpi-label">Total Utilisateurs</div>
          <div class="kpi-value" style="color:#3949ab">{{ users.length }}</div>
        </div>
        <div class="kpi-card" style="border-color:#198754">
          <div class="kpi-label">Actifs</div>
          <div class="kpi-value" style="color:#198754">{{ activeCount }}</div>
        </div>
        <div class="kpi-card" style="border-color:#dc3545">
          <div class="kpi-label">Desactives</div>
          <div class="kpi-value" style="color:#dc3545">{{ users.length - activeCount }}</div>
        </div>
      </div>

      <!-- Users Table Card -->
      <div class="main-card">
        <div class="card-header-bar">
          <h5>Liste des Utilisateurs</h5>
          <div class="search-box">
            <span class="search-icon" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#6c757d;font-size:0.85rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input type="text" placeholder="Rechercher..." [(ngModel)]="searchQuery" [ngModelOptions]="{standalone:true}" (input)="filterUsers()" />
          </div>
          <button class="btn-create" (click)="openModal()">+ Nouvel Utilisateur</button>
        </div>

        <div *ngIf="loading" class="loading-state">
          <div style="display:inline-block;width:24px;height:24px;border:3px solid #e9ecef;border-top-color:#3949ab;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
          <span style="margin-left:10px;">Chargement...</span>
        </div>

        <div *ngIf="!loading && filteredUsers.length === 0" class="empty-state">
          <svg style="width:2.5rem;height:2.5rem;color:#dee2e6;display:block;margin:0 auto 12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <p>Aucun utilisateur trouve</p>
        </div>

        <table *ngIf="!loading && filteredUsers.length > 0">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Role</th>
              <th>Statut</th>
              <th>Modules</th>
              <th>Cree le</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let user of filteredUsers">
              <td>
                <div class="user-info">
                  <div class="avatar" [style.background]="avatarBg(user)">{{ initials(user.name) }}</div>
                  <div>
                    <div class="user-name">{{ user.name }}</div>
                    <div class="user-email">{{ user.email }}</div>
                  </div>
                </div>
              </td>
              <td>
                <span [style.background]="user.role === 'ADMIN' ? '#fff3cd' : '#cfe2ff'"
                      [style.color]="user.role === 'ADMIN' ? '#856404' : '#0a58ca'"
                      style="display:inline-block;padding:4px 10px;border-radius:50px;font-size:0.75rem;font-weight:600;">
                  {{ user.role === 'ADMIN' ? 'Administrateur' : 'Utilisateur' }}
                </span>
              </td>
              <td>
                <span [style.background]="user.is_active !== false ? '#ECFDF5' : '#FEF2F2'"
                      [style.color]="user.is_active !== false ? '#10B981' : '#EF4444'"
                      style="display:inline-block;padding:4px 10px;border-radius:50px;font-size:0.75rem;font-weight:600;">
                  {{ user.is_active !== false ? 'Actif' : 'Inactif' }}
                </span>
              </td>
              <td>
                <span style="font-size:0.8rem;color:#6c757d;background:#f8f9fa;padding:3px 10px;border-radius:50px;">
                  {{ moduleCount(user) }} module(s)
                </span>
              </td>
              <td style="color:#6c757d;font-size:0.8rem;">{{ formatDate(user.created_at) }}</td>
              <td>
                <div class="actions">
                  <button class="btn-icon btn-edit" (click)="openModal(user)" title="Modifier">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn-icon btn-pwd" (click)="openPasswordModal(user)" title="Mot de passe">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </button>
                  <button class="btn-icon btn-perm" (click)="openPermModal(user)" title="Permissions">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </button>
                  <button class="btn-icon btn-toggle" [class.active]="user.is_active !== false"
                    (click)="toggleStatus(user)"
                    [title]="user.is_active !== false ? 'Desactiver' : 'Activer'">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create/Edit User Modal -->
    <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
      <div class="modal-box" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h5>{{ editingUser ? 'Modifier Utilisateur' : 'Nouvel Utilisateur' }}</h5>
          <button class="btn-icon" (click)="closeModal()" style="font-size:1rem;font-weight:700;">&times;</button>
        </div>
        <div class="modal-body">
          <form [formGroup]="userForm" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label class="form-label">Nom complet *</label>
              <input type="text" class="form-control" formControlName="name" placeholder="Prenom Nom" />
              <div class="error-text" *ngIf="f['name'].invalid && f['name'].touched">Le nom est requis</div>
            </div>
            <div class="form-group">
              <label class="form-label">Email *</label>
              <input type="email" class="form-control" formControlName="email" placeholder="email@exemple.com" />
              <div class="error-text" *ngIf="f['email'].invalid && f['email'].touched">Email invalide</div>
            </div>
            <div class="form-group" *ngIf="!editingUser">
              <label class="form-label">Mot de passe *</label>
              <input type="password" class="form-control" formControlName="password" placeholder="Minimum 8 caracteres" />
              <div class="error-text" *ngIf="f['password'].invalid && f['password'].touched">Minimum 8 caracteres</div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" (click)="closeModal()">Annuler</button>
          <button class="btn-save" (click)="onSubmit()" [disabled]="saving">
            {{ saving ? 'Enregistrement...' : (editingUser ? 'Modifier' : 'Creer') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Password Modal -->
    <div class="modal-overlay" *ngIf="showPasswordModal" (click)="closePasswordModal()">
      <div class="modal-box" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h5>Changer le Mot de Passe</h5>
          <button class="btn-icon" (click)="closePasswordModal()" style="font-size:1rem;font-weight:700;">&times;</button>
        </div>
        <div class="modal-body">
          <p style="color:#6c757d;margin-bottom:16px;font-size:0.875rem;">
            Utilisateur: <strong>{{ passwordUser?.name }}</strong>
          </p>
          <form [formGroup]="passwordForm">
            <div class="form-group">
              <label class="form-label">Nouveau mot de passe *</label>
              <input type="password" class="form-control" formControlName="password" placeholder="Minimum 8 caracteres" />
              <div class="error-text" *ngIf="pf['password'].invalid && pf['password'].touched">Minimum 8 caracteres</div>
            </div>
            <div class="form-group">
              <label class="form-label">Confirmer le mot de passe *</label>
              <input type="password" class="form-control" formControlName="password_confirmation" placeholder="Repetez le mot de passe" />
              <div class="error-text" *ngIf="passwordForm.hasError('mismatch') && pf['password_confirmation'].touched">Les mots de passe ne correspondent pas</div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" (click)="closePasswordModal()">Annuler</button>
          <button class="btn-save" (click)="changePassword()" [disabled]="saving">
            {{ saving ? 'Enregistrement...' : 'Changer le mot de passe' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Permissions Modal -->
    <div class="modal-overlay" *ngIf="showPermModal" (click)="closePermModal()">
      <div class="modal-box" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h5>Permissions Modules</h5>
          <button class="btn-icon" (click)="closePermModal()" style="font-size:1rem;font-weight:700;">&times;</button>
        </div>
        <div class="modal-body">
          <p style="color:#6c757d;margin-bottom:4px;font-size:0.875rem;">
            Utilisateur: <strong>{{ permUser?.name }}</strong>
          </p>
          <p style="color:#adb5bd;font-size:0.8rem;margin-bottom:16px;">Activez les modules et permissions pour cet utilisateur</p>

          <div *ngIf="loadingPerms" style="text-align:center;padding:20px;color:#6c757d;">Chargement des modules...</div>

          <div *ngIf="!loadingPerms">
            <div *ngFor="let module of editableModules" class="module-row">
              <div class="module-name">{{ module.module_name }}</div>
              <label class="toggle-switch">
                <input type="checkbox" [checked]="module.is_active" (change)="toggleModule(module)" />
                <span class="toggle-slider"></span>
              </label>
              <div class="perm-pills" *ngIf="module.is_active">
                <span *ngFor="let perm of availablePerms(module.module_code)"
                  class="perm-pill"
                  [ngClass]="module.permissions?.includes(perm) ? 'active' : 'inactive'"
                  (click)="togglePerm(module, perm)">
                  {{ permLabel(perm) }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" (click)="closePermModal()">Annuler</button>
          <button class="btn-save" (click)="savePermissions()" [disabled]="saving">
            {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class OrganisationUsersComponent implements OnInit {
  users: UserProfile[] = [];
  filteredUsers: UserProfile[] = [];
  loading = false;
  saving = false;
  loadingPerms = false;
  searchQuery = '';

  // User modal
  showModal = false;
  editingUser: UserProfile | null = null;
  userForm: FormGroup;

  // Password modal
  showPasswordModal = false;
  passwordUser: UserProfile | null = null;
  passwordForm: FormGroup;

  // Permissions modal
  showPermModal = false;
  permUser: UserProfile | null = null;
  editableModules: ModulePermission[] = [];

  get f() { return this.userForm.controls; }
  get pf() { return this.passwordForm.controls; }

  get activeCount(): number {
    return this.users.filter(u => u.is_active !== false).length;
  }

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private authService: AuthService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef
  ) {
    this.userForm = this.fb.group({
      name:  ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['']
    });

    this.passwordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', Validators.required]
    }, { validators: this.passwordMatch });
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  private passwordMatch(form: FormGroup) {
    const pw = form.get('password')?.value;
    const conf = form.get('password_confirmation')?.value;
    return pw && conf && pw !== conf ? { mismatch: true } : null;
  }

  loadUsers(): void {
    this.loading = true;
    this.cdr.detectChanges();
    this.userService.getUsers().subscribe({
      next: (response: any) => {
        const data = response?.data;
        this.users = data?.data ?? (Array.isArray(data) ? data : []);
        this.filterUsers();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.users = [];
        this.filteredUsers = [];
        this.loading = false;
        this.alertService.showError('Erreur', 'Impossible de charger les utilisateurs');
        this.cdr.detectChanges();
      }
    });
  }

  filterUsers(): void {
    const q = this.searchQuery.toLowerCase();
    this.filteredUsers = q
      ? this.users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      : [...this.users];
    this.cdr.detectChanges();
  }

  openModal(user?: UserProfile): void {
    this.editingUser = user || null;
    this.showModal = true;
    if (user) {
      this.userForm.patchValue({ name: user.name, email: user.email, password: '' });
      this.userForm.get('password')?.clearValidators();
    } else {
      this.userForm.reset({ name: '', email: '', password: '' });
      this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
    }
    this.userForm.get('password')?.updateValueAndValidity();
  }

  closeModal(): void {
    this.showModal = false;
    this.editingUser = null;
    this.userForm.reset();
  }

  onSubmit(): void {
    this.userForm.markAllAsTouched();
    if (this.userForm.invalid || this.saving) return;
    this.saving = true;

    if (this.editingUser) {
      const data: any = { name: this.userForm.value.name, email: this.userForm.value.email };
      this.userService.updateUser(this.editingUser.id, data).subscribe({
        next: (r: any) => {
          const updated = r.data;
          const idx = this.users.findIndex(u => u.id === this.editingUser!.id);
          if (idx !== -1) this.users[idx] = { ...this.users[idx], ...updated };
          this.filterUsers();
          this.saving = false;
          this.closeModal();
          this.alertService.showSuccess('Succès', 'Utilisateur modifié avec succès');
          this.cdr.detectChanges();
        },
        error: (e: any) => {
          this.saving = false;
          this.alertService.showError('Erreur', e?.error?.message || 'Erreur lors de la modification');
          this.cdr.detectChanges();
        }
      });
    } else {
      const data: any = {
        name: this.userForm.value.name,
        email: this.userForm.value.email,
        password: this.userForm.value.password,
        role: 'USER'
      };
      this.userService.createUser(data).subscribe({
        next: (r: any) => {
          this.users.push(r.data);
          this.filterUsers();
          this.saving = false;
          this.closeModal();
          this.alertService.showSuccess('Succès', 'Utilisateur créé avec succès');
          this.cdr.detectChanges();
        },
        error: (e: any) => {
          this.saving = false;
          const msg = e?.error?.errors?.email?.[0] || e?.error?.message || 'Erreur lors de la création';
          this.alertService.showError('Erreur', msg);
          this.cdr.detectChanges();
        }
      });
    }
  }

  // Password modal
  openPasswordModal(user: UserProfile): void {
    this.passwordUser = user;
    this.showPasswordModal = true;
    this.passwordForm.reset();
  }

  closePasswordModal(): void {
    this.showPasswordModal = false;
    this.passwordUser = null;
    this.passwordForm.reset();
  }

  changePassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid || !this.passwordUser || this.saving) return;
    this.saving = true;
    this.userService.updateUser(this.passwordUser.id, { password: this.passwordForm.value.password }).subscribe({
      next: () => {
        this.saving = false;
        this.closePasswordModal();
        this.alertService.showSuccess('Succès', 'Mot de passe modifié avec succès');
        this.cdr.detectChanges();
      },
      error: (e: any) => {
        this.saving = false;
        this.alertService.showError('Erreur', e?.error?.message || 'Erreur lors du changement de mot de passe');
        this.cdr.detectChanges();
      }
    });
  }

  // Toggle active status
  toggleStatus(user: UserProfile): void {
    const action = user.is_active !== false ? 'désactiver' : 'activer';
    this.alertService.showConfirmation(`Confirmer`, `Voulez-vous ${action} cet utilisateur ?`).then(r => {
      if (!r.isConfirmed) return;
      this.userService.toggleUserStatus(user.id).subscribe({
        next: (res: any) => {
          const idx = this.users.findIndex(u => u.id === user.id);
          if (idx !== -1) this.users[idx] = { ...this.users[idx], is_active: res.data.is_active };
          this.filterUsers();
          this.alertService.showSuccess('Succès', `Utilisateur ${res.data.is_active ? 'activé' : 'désactivé'}`);
          this.cdr.detectChanges();
        },
        error: (e: any) => {
          this.alertService.showError('Erreur', e?.error?.message || 'Erreur lors du changement de statut');
        }
      });
    });
  }

  // Permissions modal
  openPermModal(user: UserProfile): void {
    this.permUser = user;
    this.showPermModal = true;
    this.editableModules = [];
    this.loadingPerms = true;
    this.userService.getUserModulePermissions(user.id).subscribe({
      next: (r: any) => {
        this.editableModules = (r.data || this.userService.getAvailableModules()).map((m: any) => ({
          ...m,
          permissions: m.permissions ?? []
        }));
        this.loadingPerms = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.editableModules = this.userService.getAvailableModules();
        this.loadingPerms = false;
        this.cdr.detectChanges();
      }
    });
  }

  closePermModal(): void {
    this.showPermModal = false;
    this.permUser = null;
    this.editableModules = [];
  }

  toggleModule(module: ModulePermission): void {
    module.is_active = !module.is_active;
    if (!module.is_active) module.permissions = [];
    this.cdr.detectChanges();
  }

  togglePerm(module: ModulePermission, perm: string): void {
    if (!module.permissions) module.permissions = [];
    const idx = module.permissions.indexOf(perm);
    idx > -1 ? module.permissions.splice(idx, 1) : module.permissions.push(perm);
    this.cdr.detectChanges();
  }

  savePermissions(): void {
    if (!this.permUser || this.saving) return;
    this.saving = true;
    this.userService.updateUserModulePermissions(this.permUser.id, this.editableModules).subscribe({
      next: () => {
        this.saving = false;
        this.closePermModal();
        this.alertService.showSuccess('Succès', 'Permissions mises à jour');
        this.cdr.detectChanges();
      },
      error: (e: any) => {
        this.saving = false;
        this.alertService.showError('Erreur', e?.error?.message || 'Erreur lors de la mise à jour des permissions');
        this.cdr.detectChanges();
      }
    });
  }

  // Helpers
  initials(name: string): string {
    const parts = name?.split(' ') || [];
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : (name?.[0]?.toUpperCase() || 'U');
  }

  avatarBg(user: UserProfile): string {
    const colors = ['#3949ab','#1565c0','#283593','#6a1b9a','#00695c','#e53935'];
    return colors[user.id % colors.length];
  }

  moduleCount(user: UserProfile): number {
    return user.module_permissions?.filter(m => m.is_active).length ?? 0;
  }

  formatDate(date: string): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  availablePerms(moduleCode: string): string[] {
    const base = ['view', 'create', 'edit', 'delete'];
    const extra: Record<string, string[]> = {
      FINANCE: ['approve'],
      PRODUCTS_STOCK: ['manage_stock'],
      CONTAINERS: ['track'],
      RENTAL: ['manage_contracts'],
      TAXI: ['assign_drivers'],
      STATISTICS: ['export']
    };
    return [...base, ...(extra[moduleCode] ?? [])];
  }

  permLabel(perm: string): string {
    const labels: Record<string, string> = {
      view: 'Voir', create: 'Créer', edit: 'Modifier', delete: 'Supprimer',
      approve: 'Approuver', manage_stock: 'Stock', track: 'Suivre',
      manage_contracts: 'Contrats', assign_drivers: 'Chauffeurs', export: 'Exporter'
    };
    return labels[perm] ?? perm;
  }
}
