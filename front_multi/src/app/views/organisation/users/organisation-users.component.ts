import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
    .btn-icon.btn-role:hover { border-color: #0891b2; color: #0891b2; }
    .role-option { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 2px solid #e9ecef; border-radius: 10px; cursor: pointer; margin-bottom: 10px; transition: all 0.15s; }
    .role-option:hover { border-color: #c7d2fe; background: #f5f7ff; }
    .role-option.selected { border-color: #3949ab; background: #eef2ff; }
    .role-option input { display: none; }
    .role-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0; }
    .role-title { font-weight: 700; font-size: 0.9rem; color: #1e293b; }
    .role-desc { font-size: 0.78rem; color: #64748b; margin-top: 2px; }
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

    /* ─── Modal Permissions (V2) ─── */
    .modal-box.perm-modal { max-width: 900px; }
    .perm-hero {
      padding: 18px 24px;
      background: linear-gradient(135deg,#1a1a2e 0%,#0f3460 100%);
      color: #fff;
    }
    .perm-hero .user-pill {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(255,255,255,0.15);
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .perm-hero .stats-line {
      margin-top: 10px;
      font-size: 0.85rem;
      opacity: .85;
    }
    .perm-toolbar {
      padding: 14px 20px;
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      border-bottom: 1px solid #f0f0f0;
      background: #fafbfc;
    }
    .perm-toolbar .search-wrap {
      position: relative; flex: 1; min-width: 200px;
    }
    .perm-toolbar .search-wrap input {
      width: 100%;
      padding: 8px 12px 8px 34px;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      font-size: 0.85rem;
      background: #fff;
    }
    .perm-toolbar .search-wrap .icon {
      position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
      color: #94a3b8;
    }
    .perm-toolbar .bulk-btn {
      background: #fff;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 7px 14px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: .15s ease;
    }
    .perm-toolbar .bulk-btn:hover { border-color: #0f3460; color: #0f3460; }
    .perm-toolbar .bulk-btn.danger { color: #dc3545; border-color: #fecaca; }
    .perm-toolbar .bulk-btn.danger:hover { background: #fef2f2; }

    .perm-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      padding: 16px 20px;
      max-height: 60vh;
      overflow-y: auto;
    }
    @media (min-width: 900px) {
      .perm-grid { grid-template-columns: 1fr 1fr; }
    }
    .mod-card {
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      background: #fff;
      overflow: hidden;
      transition: border-color .15s ease, box-shadow .15s ease;
    }
    .mod-card.is-active {
      border-color: transparent;
      box-shadow: 0 0 0 2px rgba(79,70,229,0.15);
    }
    .mod-head {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px;
    }
    .mod-icon {
      width: 42px; height: 42px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.25rem;
      color: #fff;
      flex-shrink: 0;
    }
    .mod-info { flex: 1; min-width: 0; }
    .mod-name {
      font-weight: 700; color: #0f172a;
      font-size: 0.92rem;
      display: flex; align-items: center; gap: 6px;
    }
    .mod-code {
      font-family: ui-monospace, monospace;
      font-size: 10px;
      color: #64748b;
      background: #f1f5f9;
      padding: 1px 6px;
      border-radius: 4px;
    }
    .mod-desc {
      font-size: 0.75rem; color: #64748b; margin-top: 2px;
    }
    .mod-body {
      padding: 12px 14px 14px;
      background: #fafbfc;
      border-top: 1px solid #f0f2f5;
    }
    .perm-group + .perm-group { margin-top: 10px; }
    .perm-group-head {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 6px;
    }
    .perm-group-title {
      font-size: 10px; text-transform: uppercase; letter-spacing: .06em;
      font-weight: 700; color: #475569;
    }
    .perm-group-actions {
      display: flex; gap: 4px;
    }
    .perm-mini-btn {
      background: transparent; border: none; padding: 2px 6px;
      font-size: 10px; font-weight: 600; color: #4f46e5; cursor: pointer;
    }
    .perm-mini-btn:hover { text-decoration: underline; }
    .perm-mini-btn.danger { color: #dc3545; }

    .perm-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 10px;
      border-radius: 8px;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid;
      transition: .15s ease;
      margin: 3px 4px 3px 0;
    }
    .perm-chip.active {
      background: #EEF2FF;
      color: #4338CA;
      border-color: #C7D2FE;
    }
    .perm-chip.active:hover { background: #E0E7FF; }
    .perm-chip.inactive {
      background: #fff;
      color: #94a3b8;
      border-color: #e2e8f0;
    }
    .perm-chip.inactive:hover { color: #475569; border-color: #cbd5e1; }
    .perm-chip .dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #cbd5e1;
    }
    .perm-chip.active .dot { background: #4338CA; }

    .perm-empty {
      text-align: center;
      padding: 40px 12px;
      color: #94a3b8;
      font-size: 0.85rem;
    }
    .perm-footer-summary {
      display: flex; align-items: center; gap: 12px; flex: 1;
      font-size: 0.82rem; color: #475569;
    }
    .perm-footer-summary .badge-count {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      background: #EEF2FF;
      color: #4338CA;
      font-weight: 700;
      font-size: 0.78rem;
    }
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
            <button *ngIf="canCreateUsers" class="btn-create" (click)="openModal()">+ Nouvel Utilisateur</button>
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
          <button *ngIf="canCreateUsers" class="btn-create" (click)="openModal()">+ Nouvel Utilisateur</button>
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
                  <div class="avatar" [style.background]="avatarBg(user)" style="overflow:hidden;">
                    <img *ngIf="user.avatar_url" [src]="user.avatar_url" alt="Avatar"
                         style="width:100%;height:100%;object-fit:cover;" />
                    <span *ngIf="!user.avatar_url">{{ initials(user.name) }}</span>
                  </div>
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
                  <button *ngIf="canEditUsers" class="btn-icon btn-edit" (click)="openModal(user)" title="Modifier">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button *ngIf="canChangePasswords" class="btn-icon btn-pwd" (click)="openPasswordModal(user)" title="Mot de passe">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </button>
                  <button *ngIf="canChangeRoles && !isSuperAdminUser(user)" class="btn-icon btn-role" (click)="openRoleModal(user)" title="Changer le rôle">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/><path d="M18 8l2 2-2 2"/><path d="M22 10h-4"/></svg>
                  </button>
                  <button *ngIf="canManagePermissions" class="btn-icon btn-perm" (click)="openPermModal(user)" title="Permissions">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </button>
                  <button *ngIf="canToggleStatus" class="btn-icon btn-toggle" [class.active]="user.is_active !== false"
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
              <label class="form-label">Photo de profil</label>
              <input #photoInput type="file" accept="image/jpeg,image/png,image/jpg,image/gif,image/webp"
                     (change)="onPhotoSelected($event)" style="display:none" />
              <div style="display:flex;align-items:center;gap:14px;padding:12px;border:1px solid #e9ecef;border-radius:10px;background:#f8f9fa;">
                <div (click)="triggerPhotoInput(photoInput)"
                     style="width:64px;height:64px;border-radius:50%;overflow:hidden;cursor:pointer;display:flex;align-items:center;justify-content:center;border:2px dashed #c7d2fe;background:#eef2ff;flex-shrink:0;">
                  <img *ngIf="photoPreview" [src]="photoPreview" alt="Aperçu" style="width:100%;height:100%;object-fit:cover;" />
                  <span *ngIf="!photoPreview" style="font-size:1.2rem;">📷</span>
                </div>
                <div>
                  <div style="font-size:.85rem;font-weight:600;color:#1e293b;margin-bottom:4px;">
                    {{ selectedPhoto ? selectedPhoto.name : (photoPreview ? 'Photo actuelle' : 'Aucune photo sélectionnée') }}
                  </div>
                  <div style="font-size:.75rem;color:#6c757d;margin-bottom:8px;">Formats : JPG, PNG, GIF, WebP — max 4 MB</div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button type="button" class="btn-icon" (click)="triggerPhotoInput(photoInput)">Choisir</button>
                    <button *ngIf="photoPreview" type="button" class="btn-icon" (click)="removePhoto()" style="color:#dc3545;border-color:#fecaca;">Retirer</button>
                  </div>
                </div>
              </div>
            </div>
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

    <!-- Role Modal -->
    <div class="modal-overlay" *ngIf="showRoleModal" (click)="closeRoleModal()">
      <div class="modal-box" style="max-width:420px;" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h5>Changer le Rôle</h5>
          <button class="btn-icon" (click)="closeRoleModal()" style="font-size:1rem;font-weight:700;">&times;</button>
        </div>
        <div class="modal-body">
          <p style="font-size:0.875rem;color:#6c757d;margin-bottom:16px;">
            Utilisateur : <strong>{{ roleUser?.name }}</strong>
          </p>

          <label class="role-option" [class.selected]="selectedRole === 'USER'" (click)="selectedRole = 'USER'">
            <input type="radio" name="role" value="USER" [checked]="selectedRole === 'USER'" />
            <div class="role-icon" style="background:#dbeafe;">👤</div>
            <div>
              <div class="role-title">Utilisateur</div>
              <div class="role-desc">Accès limité aux modules activés par l'administrateur</div>
            </div>
          </label>

          <label class="role-option" [class.selected]="selectedRole === 'ADMIN'" (click)="selectedRole = 'ADMIN'">
            <input type="radio" name="role" value="ADMIN" [checked]="selectedRole === 'ADMIN'" />
            <div class="role-icon" style="background:#fef3c7;">🛡️</div>
            <div>
              <div class="role-title">Administrateur</div>
              <div class="role-desc">Gère l'organisation, les utilisateurs et les modules</div>
            </div>
          </label>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" (click)="closeRoleModal()">Annuler</button>
          <button class="btn-save" (click)="saveRole()" [disabled]="saving || selectedRole === roleUser?.role">
            {{ saving ? 'Enregistrement...' : 'Confirmer' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Permissions Modal (V2 : gestion pro) -->
    <div class="modal-overlay" *ngIf="showPermModal" (click)="closePermModal()">
      <div class="modal-box perm-modal" (click)="$event.stopPropagation()">
        <div class="perm-hero">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
            <div>
              <div style="font-size:1.1rem;font-weight:700;letter-spacing:.02em;">Modules & permissions</div>
              <div style="opacity:.75;font-size:.82rem;margin-top:3px;">Active les modules dont a besoin l'employé, puis affine ses actions autorisées.</div>
            </div>
            <button class="btn-icon" (click)="closePermModal()"
                    style="background:rgba(255,255,255,0.15);border-color:transparent;color:#fff;font-size:1rem;font-weight:700;">&times;</button>
          </div>
          <div style="margin-top:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <span class="user-pill">
              <span style="width:22px;height:22px;border-radius:50%;background:#fff;color:#0f3460;display:inline-flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;">
                {{ initials(permUser?.name || '') }}
              </span>
              {{ permUser?.name }}
            </span>
            <div class="stats-line" style="margin-top:0;">
              <b>{{ activeModulesCount }}</b> module(s) actif(s) ·
              <b>{{ totalPermsCount }}</b> permission(s) au total
            </div>
          </div>
        </div>

        <div class="perm-toolbar">
          <div class="search-wrap">
            <span class="icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input type="text" placeholder="Rechercher un module..." [(ngModel)]="permSearchQuery" [ngModelOptions]="{standalone:true}" />
          </div>
          <button class="bulk-btn" (click)="toggleAllModules(true)" [disabled]="loadingPerms">✓ Tout activer</button>
          <button class="bulk-btn danger" (click)="toggleAllModules(false)" [disabled]="loadingPerms">✕ Tout désactiver</button>
        </div>

        <div *ngIf="loadingPerms" class="perm-empty">Chargement des modules…</div>

        <div *ngIf="!loadingPerms && filteredModules.length === 0" class="perm-empty">
          Aucun module ne correspond à la recherche.
        </div>

        <div *ngIf="!loadingPerms && filteredModules.length > 0" class="perm-grid">
          <div *ngFor="let module of filteredModules; trackBy: trackById"
               class="mod-card" [class.is-active]="module.is_active"
               [style.border-color]="module.is_active ? moduleColor(module.module_code) : ''">
            <div class="mod-head">
              <div class="mod-icon" [style.background]="moduleColor(module.module_code)">
                {{ moduleIcon(module.module_code) }}
              </div>
              <div class="mod-info">
                <div class="mod-name">
                  {{ module.module_name }}
                  <span class="mod-code">{{ module.module_code }}</span>
                </div>
                <div class="mod-desc">{{ moduleDescription(module.module_code) }}</div>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" [checked]="module.is_active" (change)="toggleModule(module)" />
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="mod-body" *ngIf="module.is_active">
              <!-- Actions de base -->
              <div class="perm-group" *ngIf="basicPermsFor(module.module_code).length > 0">
                <div class="perm-group-head">
                  <span class="perm-group-title">Actions de base</span>
                  <div class="perm-group-actions">
                    <button class="perm-mini-btn"
                            *ngIf="!isAllPermsSelected(module)"
                            (click)="selectAllPermsFor(module)">Tout cocher</button>
                    <button class="perm-mini-btn danger"
                            *ngIf="module.permissions.length"
                            (click)="clearPermsFor(module)">Tout décocher</button>
                  </div>
                </div>
                <div>
                  <span *ngFor="let perm of basicPermsFor(module.module_code)"
                        class="perm-chip"
                        [ngClass]="module.permissions.includes(perm) ? 'active' : 'inactive'"
                        (click)="togglePerm(module, perm)">
                    <span class="dot"></span>
                    {{ permLabel(perm) }}
                  </span>
                </div>
              </div>

              <!-- Actions spécialisées -->
              <div class="perm-group" *ngIf="advancedPermsFor(module.module_code).length > 0">
                <div class="perm-group-head">
                  <span class="perm-group-title">Actions spécialisées</span>
                </div>
                <div>
                  <span *ngFor="let perm of advancedPermsFor(module.module_code)"
                        class="perm-chip"
                        [ngClass]="module.permissions.includes(perm) ? 'active' : 'inactive'"
                        (click)="togglePerm(module, perm)">
                    <span class="dot"></span>
                    {{ permLabel(perm) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <div class="perm-footer-summary">
            <span class="badge-count">{{ activeModulesCount }} module(s)</span>
            <span class="badge-count" style="background:#ECFDF5;color:#065F46;">{{ totalPermsCount }} permission(s)</span>
          </div>
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
  private readonly destroyRef = inject(DestroyRef);

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
  selectedPhoto: File | null = null;
  photoPreview: string | null = null;

  // Password modal
  showPasswordModal = false;
  passwordUser: UserProfile | null = null;
  passwordForm: FormGroup;

  // Role modal
  showRoleModal = false;
  roleUser: UserProfile | null = null;
  selectedRole = 'USER';

  // Permissions modal
  showPermModal = false;
  permUser: UserProfile | null = null;
  editableModules: ModulePermission[] = [];
  permSearchQuery = '';

  get f() { return this.userForm.controls; }
  get pf() { return this.passwordForm.controls; }

  get activeCount(): number {
    return this.users.filter(u => u.is_active !== false).length;
  }

  get canViewUsers(): boolean { return this.authService.hasModuleAccess('USERS'); }
  get canCreateUsers(): boolean { return this.authService.hasModulePermission('USERS', 'create'); }
  get canEditUsers(): boolean { return this.authService.hasModulePermission('USERS', 'edit'); }
  get canDeleteUsers(): boolean { return this.authService.hasModulePermission('USERS', 'delete'); }
  get canChangePasswords(): boolean { return this.authService.hasModulePermission('USERS', 'change_password'); }
  get canManagePermissions(): boolean { return this.authService.hasModulePermission('USERS', 'manage_permissions'); }
  get canToggleStatus(): boolean { return this.authService.hasModulePermission('USERS', 'toggle_status'); }
  get canChangeRoles(): boolean { return this.authService.isSuperAdmin || this.authService.isTenantAdmin; }
  get isSuperAdmin(): boolean { return this.authService.isSuperAdmin; }

  isSuperAdminUser(user: UserProfile): boolean {
    const role = user.role ?? (user as any).roles?.[0]?.name;
    return role === 'SUPER_ADMIN';
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
    this.userService.getUsers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    if (user ? !this.canEditUsers : !this.canCreateUsers) return;
    this.editingUser = user || null;
    this.showModal = true;
    this.selectedPhoto = null;
    this.photoPreview = user?.avatar_url || null;
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
    this.selectedPhoto = null;
    this.photoPreview = null;
    this.userForm.reset();
  }

  triggerPhotoInput(input: HTMLInputElement): void {
    input.click();
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.alertService.showError('Erreur', 'Format non accepté. Utilisez JPEG, PNG, GIF ou WebP.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      this.alertService.showError('Erreur', 'La photo ne doit pas dépasser 4 MB.');
      return;
    }

    this.selectedPhoto = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.photoPreview = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  removePhoto(): void {
    this.selectedPhoto = null;
    this.photoPreview = this.editingUser?.avatar_url || null;
    this.cdr.detectChanges();
  }

  onSubmit(): void {
    this.userForm.markAllAsTouched();
    if (this.userForm.invalid || this.saving) return;
    this.saving = true;

    if (this.editingUser) {
      const data: any = { name: this.userForm.value.name, email: this.userForm.value.email };
      this.userService.updateUser(this.editingUser.id, data, this.selectedPhoto).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (r: any) => {
          const updated = r.data;
          const idx = this.users.findIndex(u => u.id === this.editingUser!.id);
          if (idx !== -1) this.users[idx] = { ...this.users[idx], ...updated };
          if (String(updated.id) === String(this.authService.currentUser?.id)) {
            this.authService.updateCurrentUser(updated as any);
          }
          this.filterUsers();
          this.saving = false;
          this.closeModal();
          this.alertService.showSuccess('Succès', 'Utilisateur modifié avec succès');
          this.cdr.detectChanges();
        },
        error: (e: any) => {
          this.saving = false;
          this.alertService.showError('Erreur', e?.message || 'Erreur lors de la modification');
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
      this.userService.createUser(data, this.selectedPhoto).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
          const msg = e?.message || 'Erreur lors de la création';
          this.alertService.showError('Erreur', msg);
          this.cdr.detectChanges();
        }
      });
    }
  }

  // Password modal
  openPasswordModal(user: UserProfile): void {
    if (!this.canChangePasswords) return;
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
    if (!this.canChangePasswords) return;
    this.saving = true;
    this.userService.changePassword(
      this.passwordUser.id,
      this.passwordForm.value.password,
      this.passwordForm.value.password_confirmation
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving = false;
        this.closePasswordModal();
        this.alertService.showSuccess('Succès', 'Mot de passe modifié avec succès');
        this.cdr.detectChanges();
      },
      error: (e: any) => {
        this.saving = false;
        this.alertService.showError('Erreur', e?.message || 'Erreur lors du changement de mot de passe');
        this.cdr.detectChanges();
      }
    });
  }

  // Toggle active status
  toggleStatus(user: UserProfile): void {
    if (!this.canToggleStatus) return;
    const action = user.is_active !== false ? 'désactiver' : 'activer';
    this.alertService.showConfirmation(`Confirmer`, `Voulez-vous ${action} cet utilisateur ?`).then(r => {
      if (!r.isConfirmed) return;
      this.userService.toggleUserStatus(user.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res: any) => {
          const idx = this.users.findIndex(u => u.id === user.id);
          if (idx !== -1) this.users[idx] = { ...this.users[idx], is_active: res.data.is_active };
          this.filterUsers();
          this.alertService.showSuccess('Succès', `Utilisateur ${res.data.is_active ? 'activé' : 'désactivé'}`);
          this.cdr.detectChanges();
        },
        error: (e: any) => {
          this.alertService.showError('Erreur', e?.message || 'Erreur lors du changement de statut');
        }
      });
    });
  }

  // Role modal
  openRoleModal(user: UserProfile): void {
    if (!this.canChangeRoles || this.isSuperAdminUser(user)) return;
    this.roleUser = user;
    this.selectedRole = user.role ?? (user as any).roles?.[0]?.name ?? 'USER';
    this.showRoleModal = true;
  }

  closeRoleModal(): void {
    this.showRoleModal = false;
    this.roleUser = null;
  }

  saveRole(): void {
    if (!this.roleUser || this.saving) return;
    if (this.selectedRole === this.roleUser.role) { this.closeRoleModal(); return; }
    this.saving = true;
    this.userService.assignRole(this.roleUser.id, this.selectedRole)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          const updated = res.data;
          const newRole = updated?.roles?.[0]?.name ?? this.selectedRole;
          const idx = this.users.findIndex(u => u.id === this.roleUser!.id);
          if (idx !== -1) this.users[idx] = { ...this.users[idx], role: newRole };
          this.filterUsers();
          this.saving = false;
          this.closeRoleModal();
          this.alertService.showSuccess('Succès', `Rôle changé en ${newRole === 'ADMIN' ? 'Administrateur' : 'Utilisateur'}`);
          this.cdr.detectChanges();
        },
        error: (e: any) => {
          this.saving = false;
          this.alertService.showError('Erreur', e?.message || 'Erreur lors du changement de rôle');
          this.cdr.detectChanges();
        }
      });
  }

  // Permissions modal
  openPermModal(user: UserProfile): void {
    if (!this.canManagePermissions) return;
    this.permUser = user;
    this.showPermModal = true;
    this.editableModules = [];
    this.loadingPerms = true;
    this.userService.getUserModulePermissions(user.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    if (!this.canManagePermissions) return;
    this.saving = true;
    const userId = this.permUser.id;
    // Snapshot local pour rafraîchir la colonne "Modules" immédiatement,
    // sans attendre un rechargement complet de la liste.
    const snapshot = this.editableModules.map(m => ({
      module_code: m.module_code,
      module_name: m.module_name,
      permissions: [...(m.permissions || [])],
      is_active:   !!m.is_active,
    }));
    this.userService.updateUserModulePermissions(userId, this.editableModules).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving = false;
        const idx = this.users.findIndex(u => u.id === userId);
        if (idx !== -1) {
          this.users[idx] = { ...this.users[idx], module_permissions: snapshot as any };
        }
        this.filterUsers();
        this.closePermModal();
        this.alertService.showSuccess('Succès', 'Permissions mises à jour');
        this.cdr.detectChanges();
      },
      error: (e: any) => {
        this.saving = false;
        this.alertService.showError('Erreur', e?.message || 'Erreur lors de la mise à jour des permissions');
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
    // Seules les permissions réellement branchées sur l'UI sont exposées.
    // Les autres (approve, track, manage_contracts, assign_drivers, export, view_users)
    // ont été retirées car elles étaient déclaratives sans effet.
    const extra: Record<string, string[]> = {
      CLIENTS_SUPPLIERS: [
        'view_clients_general',
        'view_clients_pneus',
        'view_clients_textile',
        'view_clients_cosmetiques',
        'view_clients_conteneurs_pagne',
        'view_suppliers'
      ],
      USERS: ['manage_permissions', 'change_password', 'toggle_status'],
    };
    return [...base, ...(extra[moduleCode] ?? [])];
  }

  // ── Nouvelles helpers pour le modal Permissions pro ───────────────
  get filteredModules(): ModulePermission[] {
    const q = (this.permSearchQuery || '').trim().toLowerCase();
    if (!q) return this.editableModules;
    return this.editableModules.filter(m =>
      String(m.module_name || '').toLowerCase().includes(q) ||
      String(m.module_code || '').toLowerCase().includes(q)
    );
  }

  get activeModulesCount(): number {
    return this.editableModules.filter(m => m.is_active).length;
  }

  get totalPermsCount(): number {
    return this.editableModules.reduce((s, m) => s + (m.is_active ? (m.permissions?.length || 0) : 0), 0);
  }

  moduleIcon(code: string): string {
    const map: Record<string, string> = {
      COMMERCIAL: '🛒',
      FINANCE: '💰',
      CLIENTS_SUPPLIERS: '👥',
      PRODUCTS_STOCK: '📦',
      CONTAINERS: '🚚',
      RENTAL: '🏠',
      TAXI: '🚕',
      STATISTICS: '📊',
      USERS: '👤',
      BANKING: '🏦',
      EXPENSES: '💳',
    };
    return map[code] || '⚙️';
  }

  moduleColor(code: string): string {
    const map: Record<string, string> = {
      COMMERCIAL: '#2563EB',
      FINANCE: '#10B981',
      CLIENTS_SUPPLIERS: '#8B5CF6',
      PRODUCTS_STOCK: '#F59E0B',
      CONTAINERS: '#EA580C',
      RENTAL: '#0891B2',
      TAXI: '#DC2626',
      STATISTICS: '#7C3AED',
      USERS: '#4F46E5',
      BANKING: '#059669',
      EXPENSES: '#D97706',
    };
    return map[code] || '#6B7280';
  }

  moduleDescription(code: string): string {
    const map: Record<string, string> = {
      COMMERCIAL: 'Ventes, produits, catégories, unités',
      FINANCE: 'Versements, factures, devises, marges',
      CLIENTS_SUPPLIERS: 'Fiches clients & fournisseurs',
      PRODUCTS_STOCK: 'Gestion des stocks & inventaire',
      CONTAINERS: 'Arrivages, ventes conteneurs, avances',
      RENTAL: 'Locations, contrats, unités',
      TAXI: 'Véhicules, chauffeurs, versements',
      STATISTICS: 'Rapports et tableaux de bord',
      USERS: 'Utilisateurs de l\'organisation',
      BANKING: 'Comptes bancaires & mouvements',
      EXPENSES: 'Dépenses personnelles',
    };
    return map[code] || 'Module métier';
  }

  private static readonly BASIC_PERMS = ['view', 'create', 'edit', 'delete'];

  basicPermsFor(code: string): string[] {
    const all = this.availablePerms(code);
    return OrganisationUsersComponent.BASIC_PERMS.filter(p => all.includes(p));
  }

  advancedPermsFor(code: string): string[] {
    const all = this.availablePerms(code);
    return all.filter(p => !OrganisationUsersComponent.BASIC_PERMS.includes(p));
  }

  toggleAllModules(activate: boolean): void {
    for (const m of this.editableModules) {
      m.is_active = activate;
      if (!activate) m.permissions = [];
    }
    this.cdr.detectChanges();
  }

  selectAllPermsFor(module: ModulePermission): void {
    module.permissions = [...this.availablePerms(module.module_code)];
    this.cdr.detectChanges();
  }

  clearPermsFor(module: ModulePermission): void {
    module.permissions = [];
    this.cdr.detectChanges();
  }

  isAllPermsSelected(module: ModulePermission): boolean {
    const all = this.availablePerms(module.module_code);
    return all.length > 0 && all.every(p => module.permissions?.includes(p));
  }

  permLabel(perm: string): string {
    const labels: Record<string, string> = {
      view: 'Voir', create: 'Créer', edit: 'Modifier', delete: 'Supprimer',
      view_clients_general: 'Clients généraux',
      view_clients_pneus: 'Clients pneus',
      view_clients_textile: 'Clients textile',
      view_clients_cosmetiques: 'Clients cosmétiques',
      view_clients_conteneurs_pagne: 'Clients pagne',
      view_suppliers: 'Fournisseurs',
      manage_permissions: 'Permissions',
      change_password: 'Mot de passe',
      toggle_status: 'Statut'
    };
    return labels[perm] ?? perm;
  }
  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }

}
