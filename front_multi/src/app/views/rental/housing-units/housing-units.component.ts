import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-housing-units',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './housing-units.component.html'
})
export class HousingUnitsComponent implements OnInit {
  housingUnits: any[] = [];
  floors: any[] = [];
  configurations: any[] = [];
  buildings: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  currentPage = 1; totalPages = 1; totalItems = 0; itemsPerPage = 15;
  showFormModal = false; editMode = false; submitted = false;
  unitForm: FormGroup;
  selectedItem: any = null;
  deleteModalOpen = false; itemToDelete: any = null;
  Math = Math;
  
  // Filter
  selectedBuildingId: number | null = null;
  selectedFloorId: number | null = null;
  filteredFloors: any[] = [];

  // Inline floor creation
  showInlineFloor = false;
  inlineFloorNumber: number | null = null;
  savingFloor = false;

  constructor(private fb: FormBuilder, private apiService: ApiService, private cdr: ChangeDetectorRef) {
    this.unitForm = this.fb.group({
      building_id: [null],
      floor_id: [null, Validators.required],
      unit_configuration_id: [null],
      rent_amount: [null, [Validators.required, Validators.min(0)]],
      status: ['LIBRE']
    });
  }

  ngOnInit(): void { 
    this.loadData(); 
    this.loadBuildings();
    this.loadFloors(); 
    this.loadConfigurations(); 
  }

  loadBuildings(): void {
    this.apiService.get<any>('buildings?per_page=200').subscribe({
      next: (r) => { 
        if (r.success && r.data) {
          this.buildings = r.data.data || r.data || [];
        }
        this.cdr.detectChanges();
      }
    });
  }

  loadFloors(): void {
    this.apiService.get<any>('floors?per_page=200').subscribe({
      next: (r) => { 
        if (r.success && r.data) {
          this.floors = r.data.data || r.data || [];
          this.filteredFloors = this.floors;
        }
        this.cdr.detectChanges();
      }
    });
  }

  loadConfigurations(): void {
    this.apiService.get<any>('unit-configurations?per_page=200').subscribe({
      next: (r) => { 
        if (r.success && r.data) {
          this.configurations = r.data.data || r.data || [];
        }
        this.cdr.detectChanges();
      }
    });
  }

  onBuildingChange(buildingId: any): void {
    const id = buildingId?.target?.value || buildingId;
    this.unitForm.patchValue({ floor_id: null });
    this.showInlineFloor = false;
    this.inlineFloorNumber = null;
    if (!id) {
      this.filteredFloors = this.floors;
    } else {
      this.filteredFloors = this.floors.filter(f => f.building_id == id);
    }
  }

  createFloorInline(): void {
    const buildingId = this.unitForm.get('building_id')?.value;
    if (!buildingId || !this.inlineFloorNumber) return;
    this.savingFloor = true;
    this.apiService.post<any>('floors', {
      building_id: buildingId,
      floor_number: this.inlineFloorNumber
    }).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.floors.push(r.data);
          this.filteredFloors = this.floors.filter(f => f.building_id == buildingId);
          this.unitForm.patchValue({ floor_id: r.data.id });
          this.showInlineFloor = false;
          this.inlineFloorNumber = null;
          this.successMessage = `Étage ${r.data.floor_number} créé avec succès`;
        }
        this.savingFloor = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur lors de la création de l\'étage';
        this.savingFloor = false;
        this.cdr.detectChanges();
      }
    });
  }

  onConfigurationChange(configId: any): void {
    const id = configId?.target?.value || configId;
    if (!id) return;
    const config = this.configurations.find(c => c.id == id);
    if (config && config.default_rent) {
      this.unitForm.patchValue({ rent_amount: config.default_rent });
    }
  }

  loadData(): void {
    this.loading = true; this.error = null;
    let url = `housing-units?page=${this.currentPage}`;
    if (this.selectedFloorId) url += `&floor_id=${this.selectedFloorId}`;
    
    this.apiService.get<any>(url).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          const p = r.data; this.housingUnits = p.data || [];
          this.currentPage = p.current_page || 1; this.totalPages = p.last_page || 1;
          this.totalItems = p.total || 0; this.itemsPerPage = p.per_page || 15;
        }
        this.loading = false; this.cdr.detectChanges();
      },
      error: () => { this.error = 'Erreur lors du chargement'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  applyFilter(): void {
    this.currentPage = 1;
    this.loadData();
  }

  resetFilter(): void {
    this.selectedBuildingId = null;
    this.selectedFloorId = null;
    this.currentPage = 1;
    this.loadData();
  }

  onPageChange(page: number): void { if (page < 1 || page > this.totalPages) return; this.currentPage = page; this.loadData(); }
  
  openCreateModal(): void {
    this.editMode = false;
    this.submitted = false;
    this.filteredFloors = this.floors;
    this.showInlineFloor = false;
    this.inlineFloorNumber = null;
    this.unitForm.reset({ building_id: null, floor_id: null, unit_configuration_id: null, rent_amount: null, status: 'LIBRE' });
    this.showFormModal = true;
  }
  
  openEditModal(item: any): void { 
    this.editMode = true; 
    this.submitted = false; 
    this.selectedItem = item;
    // Set building from floor
    const floor = this.floors.find(f => f.id === item.floor_id);
    const buildingId = floor ? floor.building_id : null;
    this.filteredFloors = buildingId ? this.floors.filter(f => f.building_id === buildingId) : this.floors;
    this.unitForm.patchValue({
      building_id: buildingId,
      floor_id: item.floor_id,
      unit_configuration_id: item.unit_configuration_id,
      rent_amount: item.rent_amount,
      status: item.status
    }); 
    this.showFormModal = true; 
  }

  save(): void {
    this.submitted = true; if (this.unitForm.invalid) return;
    const { building_id, ...data } = this.unitForm.value;
    const obs = this.editMode && this.selectedItem
      ? this.apiService.put<any>(`housing-units/${this.selectedItem.id}`, data)
      : this.apiService.post<any>('housing-units', data);
    obs.subscribe({
      next: (r) => { if (r.success) { this.successMessage = this.editMode ? 'Unité mise à jour' : 'Unité créée'; this.showFormModal = false; this.loadData(); this.clearMessages(); } },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; }
    });
  }

  confirmDelete(item: any): void { this.itemToDelete = item; this.deleteModalOpen = true; }
  deleteItem(): void {
    if (!this.itemToDelete) return;
    this.apiService.delete<any>(`housing-units/${this.itemToDelete.id}`).subscribe({
      next: (r) => { if (r.success) { this.successMessage = 'Unité supprimée'; this.deleteModalOpen = false; this.itemToDelete = null; this.loadData(); this.clearMessages(); } },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; this.deleteModalOpen = false; }
    });
  }

  getFloorLabel(id: number): string { 
    const f = this.floors.find(x => x.id === id); 
    if (!f) return `ID: ${id}`;
    const buildingName = f.building?.name || '';
    return `${buildingName} - Étage ${f.floor_number}`;
  }
  
  getConfigName(id: number): string { const c = this.configurations.find(x => x.id === id); return c ? c.name : '-'; }
  
  getConfigDetails(id: number): string {
    const c = this.configurations.find(x => x.id === id);
    if (!c) return '';
    const parts = [];
    if (c.bedrooms) parts.push(`${c.bedrooms} ch.`);
    if (c.living_rooms) parts.push(`${c.living_rooms} salon`);
    if (c.bathrooms) parts.push(`${c.bathrooms} sdb`);
    if (c.has_terrace) parts.push('terrasse');
    return parts.join(', ');
  }
  
  getBuildingName(floorId: number): string {
    const f = this.floors.find(x => x.id === floorId);
    return f?.building?.name || '-';
  }

  getStatusClass(s: string): string {
    const m: {[k: string]: string} = { 'LIBRE': 'success', 'OCCUPE': 'warning' };
    return m[s] || 'secondary';
  }
  getStatusLabel(s: string): string {
    const m: {[k: string]: string} = { 'LIBRE': 'Libre', 'OCCUPE': 'Occupé' };
    return m[s] || s;
  }

  getPages(): number[] { const p: number[] = []; for (let i = 1; i <= this.totalPages; i++) p.push(i); return p; }
  private clearMessages(): void { setTimeout(() => { this.successMessage = null; this.error = null; this.cdr.detectChanges(); }, 3000); }
}
