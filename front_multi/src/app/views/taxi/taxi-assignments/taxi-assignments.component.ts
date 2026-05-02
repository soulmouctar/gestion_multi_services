import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  selector: 'app-taxi-assignments',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, TableModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './taxi-assignments.component.html'
})
export class TaxiAssignmentsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  assignments: any[] = [];
  taxis: any[] = [];
  drivers: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  
  // Modal states
  showModal = false;
  modalTitle = '';
  isEditing = false;
  currentAssignment: any = null;
  
  // Form
  assignmentForm: FormGroup;
  submitted = false;
  
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
    this.assignmentForm = this.fb.group({
      taxi_id: ['', Validators.required],
      driver_id: ['', Validators.required],
      start_date: ['', Validators.required],
      end_date: ['']
    });
  }

  ngOnInit(): void {
    this.loadAssignments();
    this.loadTaxis();
    this.loadDrivers();
  }

  loadAssignments(page: number = 1): void {
    this.loading = true;
    this.apiService.get<any>(`taxi-assignments?page=${page}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.assignments = r.data.data || r.data;
          this.currentPage = r.data.current_page || 1;
          this.totalPages = r.data.last_page || 1;
          this.totalItems = r.data.total || 0;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Erreur lors du chargement des affectations';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadTaxis(): void {
    this.apiService.get<any>('taxis').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.taxis = r.data.data || r.data;
        }
      },
      error: () => {
      }
    });
  }

  loadDrivers(): void {
    this.apiService.get<any>('drivers').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.drivers = r.data.data || r.data;
        }
      },
      error: () => {
      }
    });
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.modalTitle = 'Nouvelle Affectation';
    this.currentAssignment = null;
    this.assignmentForm.reset();
    this.submitted = false;
    this.showModal = true;
  }

  openEditModal(assignment: any): void {
    this.isEditing = true;
    this.modalTitle = 'Modifier l\'Affectation';
    this.currentAssignment = assignment;
    this.assignmentForm.patchValue({
      taxi_id: assignment.taxi_id,
      driver_id: assignment.driver_id,
      start_date: assignment.start_date,
      end_date: assignment.end_date
    });
    this.submitted = false;
    this.showModal = true;
  }

  saveAssignment(): void {
    this.submitted = true;
    if (this.assignmentForm.invalid) return;

    const data = this.assignmentForm.value;
    const request = this.isEditing 
      ? this.apiService.put<any>(`taxi-assignments/${this.currentAssignment.id}`, data)
      : this.apiService.post<any>('taxi-assignments', data);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (r.success) {
          this.successMessage = this.isEditing 
            ? 'Affectation modifiée avec succès'
            : 'Affectation créée avec succès';
          this.showModal = false;
          this.loadAssignments(this.currentPage);
          this.clearMessages();
        }
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur lors de l\'enregistrement';
      }
    });
  }

  deleteAssignment(assignment: any): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer cette affectation ?`)) {
      this.apiService.delete<any>(`taxi-assignments/${assignment.id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (r) => {
          if (r.success) {
            this.successMessage = 'Affectation supprimée avec succès';
            this.loadAssignments(this.currentPage);
            this.clearMessages();
          }
        },
        error: (err) => {
          this.error = err?.error?.message || 'Erreur lors de la suppression';
        }
      });
    }
  }

  getAssignmentStatus(assignment: any): string {
    const now = new Date();
    const startDate = new Date(assignment.start_date);
    const endDate = assignment.end_date ? new Date(assignment.end_date) : null;

    if (now < startDate) return 'À venir';
    if (endDate && now > endDate) return 'Terminée';
    return 'Active';
  }

  getStatusColor(assignment: any): string {
    const status = this.getAssignmentStatus(assignment);
    switch (status) {
      case 'Active': return 'success';
      case 'À venir': return 'warning';
      case 'Terminée': return 'secondary';
      default: return 'primary';
    }
  }

  onPageChange(page: number): void {
    this.loadAssignments(page);
  }

  private clearMessages(): void {
    setTimeout(() => {
      this.successMessage = null;
      this.error = null;
      this.cdr.detectChanges();
    }, 3000);
  }
  trackById(_index: number, item: any): any {
    return item?.id ?? _index;
  }

}
