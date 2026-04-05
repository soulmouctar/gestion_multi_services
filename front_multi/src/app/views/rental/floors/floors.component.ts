import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-floors',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './floors.component.html'
})
export class FloorsComponent implements OnInit {
  floors: any[] = [];
  buildings: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  currentPage = 1; totalPages = 1; totalItems = 0; itemsPerPage = 15;
  showFormModal = false; editMode = false; submitted = false;
  floorForm: FormGroup;
  selectedItem: any = null;
  deleteModalOpen = false; itemToDelete: any = null;
  Math = Math;
  
  // Building filter
  selectedBuildingId: number | null = null;

  constructor(
    private fb: FormBuilder, 
    private apiService: ApiService, 
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute
  ) {
    this.floorForm = this.fb.group({
      building_id: [null, Validators.required],
      floor_number: [null, Validators.required]
    });
  }

  ngOnInit(): void { 
    this.loadBuildings();
    this.checkBuildingFilter();
    
    // Add valueChanges listener for building filter
    this.floorForm.get('building_id')?.valueChanges.subscribe(value => {
      this.selectedBuildingId = value;
      this.currentPage = 1;
      this.loadData();
    });
  }

  private checkBuildingFilter(): void {
    this.route.queryParams.subscribe(params => {
      if (params['building_id']) {
        this.selectedBuildingId = +params['building_id'];
        this.floorForm.patchValue({ building_id: this.selectedBuildingId });
      }
      this.loadData();
    });
  }

  loadBuildings(): void {
    this.apiService.get<any>('buildings?per_page=200').subscribe({
      next: (r) => { 
        if (r.success && r.data) {
          this.buildings = r.data.data || [];
        }
      }
    });
  }

  loadData(): void {
    this.loading = true; 
    this.error = null;
    
    let url = `floors?page=${this.currentPage}`;
    if (this.selectedBuildingId) {
      url += `&building_id=${this.selectedBuildingId}`;
    }
    
    this.apiService.get<any>(url).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          const p = r.data; 
          this.floors = p.data || [];
          this.currentPage = p.current_page || 1; 
          this.totalPages = p.last_page || 1;
          this.totalItems = p.total || 0; 
          this.itemsPerPage = p.per_page || 15;
        }
        this.loading = false; 
        this.cdr.detectChanges();
      },
      error: () => { 
        this.error = 'Erreur lors du chargement'; 
        this.loading = false; 
        this.cdr.detectChanges(); 
      }
    });
  }

  onBuildingChange(): void {
    this.selectedBuildingId = this.floorForm.get('building_id')?.value || null;
    this.currentPage = 1;
    this.loadData();
  }

  onPageChange(page: number): void { 
    if (page < 1 || page > this.totalPages) return; 
    this.currentPage = page; 
    this.loadData(); 
  }
  
  openCreateModal(): void { 
    this.editMode = false; 
    this.submitted = false; 
    this.floorForm.reset({ 
      building_id: this.selectedBuildingId, 
      floor_number: null 
    }); 
    this.showFormModal = true; 
  }
  
  openEditModal(item: any): void { 
    this.editMode = true; 
    this.submitted = false; 
    this.selectedItem = item; 
    this.floorForm.patchValue(item); 
    this.showFormModal = true; 
  }

  save(): void {
    this.submitted = true; 
    if (this.floorForm.invalid) return;
    const data = this.floorForm.value;
    const obs = this.editMode && this.selectedItem
      ? this.apiService.put<any>(`floors/${this.selectedItem.id}`, data)
      : this.apiService.post<any>('floors', data);
    obs.subscribe({
      next: (r) => { 
        if (r.success) { 
          this.successMessage = this.editMode ? 'Étage mis à jour' : 'Étage créé'; 
          this.showFormModal = false; 
          this.loadData(); 
          this.clearMessages(); 
        } 
      },
      error: (err) => { 
        this.error = err?.error?.message || 'Erreur'; 
      }
    });
  }

  confirmDelete(item: any): void { 
    this.itemToDelete = item; 
    this.deleteModalOpen = true; 
  }
  
  deleteItem(): void {
    if (!this.itemToDelete) return;
    this.apiService.delete<any>(`floors/${this.itemToDelete.id}`).subscribe({
      next: (r) => { 
        if (r.success) { 
          this.successMessage = 'Étage supprimé'; 
          this.deleteModalOpen = false; 
          this.itemToDelete = null; 
          this.loadData(); 
          this.clearMessages(); 
        } 
      },
      error: (err) => { 
        this.error = err?.error?.message || 'Erreur'; 
        this.deleteModalOpen = false; 
      }
    });
  }

  getBuildingName(id: number): string { 
    const b = this.buildings.find(x => x.id === id); 
    return b ? b.name : `ID: ${id}`; 
  }
  
  getPages(): number[] { 
    const p: number[] = []; 
    for (let i = 1; i <= this.totalPages; i++) p.push(i); 
    return p; 
  }
  
  private clearMessages(): void { 
    setTimeout(() => { 
      this.successMessage = null; 
      this.error = null; 
      this.cdr.detectChanges(); 
    }, 3000); 
  }
}
