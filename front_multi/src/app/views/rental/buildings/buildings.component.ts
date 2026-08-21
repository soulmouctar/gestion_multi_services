import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-buildings',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './buildings.component.html'
})
export class BuildingsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  buildings: any[] = [];
  locations: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  currentPage = 1; totalPages = 1; totalItems = 0; itemsPerPage = 15;
  showFormModal = false; editMode = false; submitted = false;
  buildingForm: FormGroup;
  selectedItem: any = null;
  deleteModalOpen = false; itemToDelete: any = null;
  Math = Math;
  buildingTypes = [
    { value: 'IMMEUBLE', label: 'Immeuble à étages', floors: null },
    { value: 'MAISON_SIMPLE', label: 'Maison simple / plain-pied', floors: 0 },
    { value: 'ANNEXE', label: 'Annexe / dépendance', floors: 0 },
    { value: 'VILLA', label: 'Villa', floors: null },
    { value: 'COUR_COMMUNE', label: 'Cour commune', floors: 0 },
    { value: 'COMMERCIAL', label: 'Local commercial', floors: 0 },
    { value: 'MIXTE', label: 'Mixte', floors: null },
  ];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.buildingForm = this.fb.group({
      location_id: [null, Validators.required],
      name: ['', Validators.required],
      type: [''],
      total_floors: [null]
    });
  }

  ngOnInit(): void { this.loadData(); this.loadLocations(); }

  get canCreateBuildings(): boolean { return this.authService.hasModulePermission('RENTAL', 'create'); }
  get canEditBuildings(): boolean { return this.authService.hasModulePermission('RENTAL', 'edit'); }
  get canDeleteBuildings(): boolean { return this.authService.hasModulePermission('RENTAL', 'delete'); }

  loadLocations(): void {
    this.apiService.get<any>('locations?per_page=200').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { if (r.success && r.data) this.locations = r.data.data || []; }
    });
  }

  loadData(): void {
    this.loading = true; this.error = null;
    this.apiService.get<any>(`buildings?page=${this.currentPage}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          const p = r.data; this.buildings = p.data || [];
          this.currentPage = p.current_page || 1; this.totalPages = p.last_page || 1;
          this.totalItems = p.total || 0; this.itemsPerPage = p.per_page || 15;
        }
        this.loading = false; this.cdr.detectChanges();
      },
      error: () => { this.error = 'Erreur lors du chargement'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  onPageChange(page: number): void { if (page < 1 || page > this.totalPages) return; this.currentPage = page; this.loadData(); }
  openCreateModal(): void { if (!this.canCreateBuildings) return; this.editMode = false; this.submitted = false; this.buildingForm.reset({ location_id: null, name: '', type: 'IMMEUBLE', total_floors: 1 }); this.showFormModal = true; }
  openEditModal(item: any): void { if (!this.canEditBuildings) return; this.editMode = true; this.submitted = false; this.selectedItem = item; this.buildingForm.patchValue(item); this.showFormModal = true; }

  onTypeChange(): void {
    const selectedType = this.buildingTypes.find(type => type.value === this.buildingForm.get('type')?.value);
    if (selectedType?.floors !== null && selectedType?.floors !== undefined) {
      this.buildingForm.patchValue({ total_floors: selectedType.floors });
    }
  }

  save(): void {
    this.submitted = true; if (this.buildingForm.invalid) return;
    if (this.editMode ? !this.canEditBuildings : !this.canCreateBuildings) return;
    const data = this.buildingForm.value;
    const obs = this.editMode && this.selectedItem
      ? this.apiService.put<any>(`buildings/${this.selectedItem.id}`, data)
      : this.apiService.post<any>('buildings', data);
    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { if (r.success) { this.successMessage = this.editMode ? 'Bâtiment mis à jour' : 'Bâtiment créé'; this.showFormModal = false; this.loadData(); this.clearMessages(); } },
      error: (err) => { this.error = err.message || 'Erreur'; }
    });
  }

  confirmDelete(item: any): void { if (!this.canDeleteBuildings) return; this.itemToDelete = item; this.deleteModalOpen = true; }
  deleteItem(): void {
    if (!this.itemToDelete || !this.canDeleteBuildings) return;
    this.apiService.delete<any>(`buildings/${this.itemToDelete.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => { if (r.success) { this.successMessage = 'Bâtiment supprimé'; this.deleteModalOpen = false; this.itemToDelete = null; this.loadData(); this.clearMessages(); } },
      error: (err) => { this.error = err.message || 'Erreur'; this.deleteModalOpen = false; }
    });
  }

  getLocationName(id: number): string { const l = this.locations.find(loc => loc.id === id); return l ? l.name : `ID: ${id}`; }
  getTypeLabel(type: string): string {
    return this.buildingTypes.find(item => item.value === type)?.label || type || '—';
  }
  isNoFloorBuilding(): boolean {
    const type = this.buildingTypes.find(item => item.value === this.buildingForm.get('type')?.value);
    return type?.floors === 0;
  }
  getPages(): number[] { const p: number[] = []; for (let i = 1; i <= this.totalPages; i++) p.push(i); return p; }
  private clearMessages(): void { setTimeout(() => { this.successMessage = null; this.error = null; this.cdr.detectChanges(); }, 3000); }
  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }

}
