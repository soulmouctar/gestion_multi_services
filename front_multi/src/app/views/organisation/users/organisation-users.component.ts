import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { TenantService, ApiResponse, Tenant } from '../../../core/services/tenant.service';
import { OrganisationFilterService } from '../../../core/services/organisation-filter.service';
import { 
  CardModule, 
  ButtonModule, 
  TableModule, 
  ModalModule, 
  FormModule, 
  BadgeModule,
  SpinnerModule,
  AlertModule,
  GridModule 
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

interface OrganisationUser {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

@Component({
  selector: 'app-organisation-users',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    TableModule,
    ModalModule,
    FormModule,
    BadgeModule,
    SpinnerModule,
    AlertModule,
    GridModule,
    IconDirective
  ],
  templateUrl: './organisation-users.component.html',
  styleUrls: ['./organisation-users.component.scss']
})
export class OrganisationUsersComponent implements OnInit {
  userForm: FormGroup;
  users: OrganisationUser[] = [];
  loading = false;
  saving = false;
  editingUser: OrganisationUser | null = null;
  showModal = false;
  
  // Organisation filtering
  selectedOrganisation: Tenant | null = null;
  availableOrganisations: Tenant[] = [];
  canSelectOrganisation = false;
  currentUserRole: string | null = null;

  roles = [
    { value: 'ADMIN', label: 'Administrateur', description: 'Accès complet à l\'organisation' },
    { value: 'USER', label: 'Utilisateur', description: 'Accès aux modules assignés' },
    { value: 'VIEWER', label: 'Lecteur', description: 'Accès en lecture seule' }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private userService: UserService,
    private tenantService: TenantService,
    private organisationFilterService: OrganisationFilterService,
    private cdr: ChangeDetectorRef
  ) {
    this.userForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      role: ['USER', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      password_confirmation: ['', Validators.required],
      is_active: [true]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.initializeOrganisationFilter();
    this.loadUsers();
  }

  private initializeOrganisationFilter(): void {
    this.currentUserRole = this.organisationFilterService.getCurrentUserRole();
    this.canSelectOrganisation = this.organisationFilterService.canSelectOrganisation();

    // S'abonner aux changements d'organisation
    this.organisationFilterService.selectedOrganisation$.subscribe(organisation => {
      this.selectedOrganisation = organisation;
      if (organisation) {
        this.loadUsers();
      }
    });

    this.organisationFilterService.availableOrganisations$.subscribe(organisations => {
      this.availableOrganisations = organisations;
      this.cdr.detectChanges();
    });
  }

  onOrganisationChange(organisationId: number): void {
    const organisation = this.availableOrganisations.find(org => org.id === organisationId);
    if (organisation) {
      this.organisationFilterService.selectOrganisation(organisation);
    }
  }

  onOrganisationSelectChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const organisationId = Number(target.value);
    this.onOrganisationChange(organisationId);
  }

  get f() {
    return this.userForm.controls;
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('password_confirmation');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    if (confirmPassword?.hasError('passwordMismatch')) {
      delete confirmPassword.errors!['passwordMismatch'];
      if (Object.keys(confirmPassword.errors!).length === 0) {
        confirmPassword.setErrors(null);
      }
    }
    
    return null;
  }

  loadUsers(): void {
    if (!this.selectedOrganisation) {
      console.warn('No organisation selected');
      return;
    }

    this.loading = true;
    
    // Simuler le chargement des utilisateurs selon l'organisation sélectionnée
    setTimeout(() => {
      // Données simulées basées sur l'organisation
      const mockUsers: { [key: number]: OrganisationUser[] } = {
        1: [
          {
            id: 1,
            name: 'Admin Organisation 1',
            email: 'admin@org1.com',
            role: 'ADMIN',
            is_active: true,
            last_login: '2024-01-13T10:30:00Z',
            created_at: '2024-01-01T00:00:00Z'
          },
          {
            id: 2,
            name: 'Utilisateur Org 1',
            email: 'user@org1.com',
            role: 'USER',
            is_active: true,
            last_login: null,
            created_at: '2024-01-10T00:00:00Z'
          }
        ],
        2: [
          {
            id: 3,
            name: 'Admin Organisation 2',
            email: 'admin@org2.com',
            role: 'ADMIN',
            is_active: true,
            last_login: '2024-01-12T14:20:00Z',
            created_at: '2024-01-05T00:00:00Z'
          }
        ]
      };

      this.users = mockUsers[this.selectedOrganisation!.id] || [];
      this.loading = false;
      this.cdr.detectChanges();
    }, 1000);
  }

  openModal(user?: OrganisationUser): void {
    this.editingUser = user || null;
    this.showModal = true;
    
    if (user) {
      this.userForm.patchValue({
        name: user.name,
        email: user.email,
        role: user.role,
        is_active: user.is_active
      });
      // Remove password requirement for editing
      this.userForm.get('password')?.clearValidators();
      this.userForm.get('password_confirmation')?.clearValidators();
    } else {
      this.userForm.reset({
        name: '',
        email: '',
        role: 'USER',
        password: '',
        password_confirmation: '',
        is_active: true
      });
      // Add password requirement for new users
      this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.userForm.get('password_confirmation')?.setValidators([Validators.required]);
    }
    
    this.userForm.get('password')?.updateValueAndValidity();
    this.userForm.get('password_confirmation')?.updateValueAndValidity();
  }

  closeModal(): void {
    this.showModal = false;
    this.editingUser = null;
    this.userForm.reset();
  }

  onSubmit(): void {
    if (this.userForm.invalid || this.saving) {
      return;
    }

    this.saving = true;
    const formData = this.userForm.value;
    
    if (this.editingUser) {
      this.updateUser(this.editingUser.id, formData);
    } else {
      this.createUser(formData);
    }
  }

  createUser(userData: any): void {
    // Simuler la création d'un utilisateur
    setTimeout(() => {
      const newUser: OrganisationUser = {
        id: Math.max(...this.users.map(u => u.id)) + 1,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        is_active: userData.is_active,
        last_login: null,
        created_at: new Date().toISOString()
      };
      
      this.users.push(newUser);
      this.saving = false;
      this.closeModal();
      this.cdr.detectChanges();
    }, 1000);
  }

  updateUser(userId: number, userData: any): void {
    // Simuler la mise à jour d'un utilisateur
    setTimeout(() => {
      const index = this.users.findIndex(u => u.id === userId);
      if (index !== -1) {
        this.users[index] = {
          ...this.users[index],
          name: userData.name,
          email: userData.email,
          role: userData.role,
          is_active: userData.is_active
        };
      }
      
      this.saving = false;
      this.closeModal();
      this.cdr.detectChanges();
    }, 1000);
  }

  toggleUserStatus(user: OrganisationUser): void {
    user.is_active = !user.is_active;
    // Simuler la mise à jour du statut
    console.log(`User ${user.name} status changed to: ${user.is_active ? 'Active' : 'Inactive'}`);
  }

  deleteUser(user: OrganisationUser): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${user.name} ?`)) {
      const index = this.users.findIndex(u => u.id === user.id);
      if (index !== -1) {
        this.users.splice(index, 1);
        this.cdr.detectChanges();
      }
    }
  }

  getRoleColor(role: string): string {
    const colors: { [key: string]: string } = {
      'ADMIN': 'danger',
      'USER': 'primary',
      'VIEWER': 'secondary'
    };
    return colors[role] || 'secondary';
  }

  getRoleLabel(role: string): string {
    const roleObj = this.roles.find(r => r.value === role);
    return roleObj?.label || role;
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return 'Jamais';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getRoleDescription(roleValue: string): string {
    const role = this.roles.find(r => r.value === roleValue);
    return role?.description || '';
  }
}
