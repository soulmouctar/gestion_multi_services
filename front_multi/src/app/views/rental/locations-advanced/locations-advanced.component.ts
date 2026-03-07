import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule, TableModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-locations-advanced',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, TableModule
  ],
  templateUrl: './locations-advanced.component.html'
})
export class LocationsAdvancedComponent implements OnInit {
  locations: any[] = [];
  buildings: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  
  // Statistics
  locationStats: any = null;
  statsLoading = false;
  
  // Modal states
  showModal = false;
  showBuildingsModal = false;
  modalTitle = '';
  isEditing = false;
  currentLocation: any = null;
  selectedLocationBuildings: any[] = [];
  
  // Form
  locationForm: FormGroup;
  submitted = false;
  
  // Filters
  filterForm: FormGroup;
  
  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.locationForm = this.fb.group({
      name: ['', Validators.required],
      address: ['', Validators.required],
      city: [''],
      postal_code: [''],
      description: ['']
    });

    this.filterForm = this.fb.group({
      search: [''],
      city: ['']
    });
  }

  ngOnInit(): void {
    this.loadLocations();
    this.loadLocationStatistics();
  }

  loadLocations(page: number = 1): void {
    this.loading = true;
    const filters = this.filterForm.value;
    let url = `locations-public?page=${page}`;
    
    if (filters.search) {
      url += `&search=${encodeURIComponent(filters.search)}`;
    }
    if (filters.city) {
      url += `&city=${encodeURIComponent(filters.city)}`;
    }

    this.apiService.get<any>(url).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.locations = r.data.data || r.data;
          this.currentPage = r.data.current_page || 1;
          this.totalPages = r.data.last_page || 1;
          this.totalItems = r.data.total || 0;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Erreur lors du chargement des emplacements';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadLocationStatistics(): void {
    this.statsLoading = true;
    this.apiService.get<any>('locations-public/statistics?tenant_id=1').subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.locationStats = r.data;
        }
        this.statsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.statsLoading = false;
        console.error('Erreur lors du chargement des statistiques');
      }
    });
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadLocations(1);
  }

  clearFilters(): void {
    this.filterForm.reset();
    this.loadLocations(1);
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.modalTitle = 'Nouvel Emplacement';
    this.currentLocation = null;
    this.locationForm.reset();
    this.submitted = false;
    this.showModal = true;
  }

  openEditModal(location: any): void {
    this.isEditing = true;
    this.modalTitle = 'Modifier l\'Emplacement';
    this.currentLocation = location;
    this.locationForm.patchValue({
      name: location.name,
      address: location.address,
      city: location.city,
      postal_code: location.postal_code,
      description: location.description
    });
    this.submitted = false;
    this.showModal = true;
  }

  saveLocation(): void {
    this.submitted = true;
    if (this.locationForm.invalid) return;

    const data = {
      ...this.locationForm.value,
      tenant_id: 1
    };

    const request = this.isEditing 
      ? this.apiService.put<any>(`locations/${this.currentLocation.id}`, data)
      : this.apiService.post<any>('locations-public', data);

    request.subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = this.isEditing 
            ? 'Emplacement modifié avec succès'
            : 'Emplacement créé avec succès';
          this.showModal = false;
          this.loadLocations(this.currentPage);
          this.loadLocationStatistics();
          this.clearMessages();
        }
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur lors de l\'enregistrement';
      }
    });
  }

  deleteLocation(location: any): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer l'emplacement "${location.name}" ?`)) {
      this.apiService.delete<any>(`locations/${location.id}`).subscribe({
        next: (r) => {
          if (r.success) {
            this.successMessage = 'Emplacement supprimé avec succès';
            this.loadLocations(this.currentPage);
            this.loadLocationStatistics();
            this.clearMessages();
          }
        },
        error: (err) => {
          this.error = err?.error?.message || 'Erreur lors de la suppression';
        }
      });
    }
  }

  viewBuildings(location: any): void {
    this.currentLocation = location;
    this.loadLocationBuildings(location.id);
    this.showBuildingsModal = true;
  }

  loadLocationBuildings(locationId: number): void {
    this.apiService.get<any>(`buildings?location_id=${locationId}`).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.selectedLocationBuildings = r.data.data || r.data;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        console.error('Erreur lors du chargement des bâtiments');
      }
    });
  }

  getBuildingCount(location: any): number {
    return location.buildings?.length || 0;
  }

  getTotalUnits(location: any): number {
    if (!location.buildings) return 0;
    return location.buildings.reduce((total: number, building: any) => {
      return total + (building.total_units || 0);
    }, 0);
  }

  onPageChange(page: number): void {
    this.loadLocations(page);
  }

  private clearMessages(): void {
    setTimeout(() => {
      this.successMessage = null;
      this.error = null;
      this.cdr.detectChanges();
    }, 3000);
  }
}
