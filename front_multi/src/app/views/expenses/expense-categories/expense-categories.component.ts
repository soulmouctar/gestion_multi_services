import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  ButtonModule, CardModule, FormModule, BadgeModule,
  ModalModule, SpinnerModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-expense-categories',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, CardModule, FormModule, BadgeModule, ModalModule, SpinnerModule
  ],
  templateUrl: './expense-categories.component.html'
})
export class ExpenseCategoriesComponent implements OnInit {

  categories: any[] = [];
  loading = false;
  showModal = false;
  editMode = false;
  submitted = false;
  selectedCategory: any = null;
  form: FormGroup;

  colorOptions = [
    '#e74c3c','#e67e22','#f39c12','#2ecc71','#1abc9c',
    '#3498db','#9b59b6','#34495e','#95a5a6','#e91e63'
  ];

  iconOptions = [
    'cilHome','cilCart','cilRestaurant','cilTruck','cilMedicalCross',
    'cilEducation','cilEnvelopeOpen','cilPhone','cilSettings','cilStar',
    'cilBriefcase','cilCash','cilGift','cilGamepad','cilMusic'
  ];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      name:        ['', [Validators.required, Validators.maxLength(100)]],
      color:       ['#3498db', Validators.required],
      icon:        ['cilCart'],
      description: [''],
      is_active:   [true]
    });
  }

  ngOnInit(): void { this.loadCategories(); }

  loadCategories(): void {
    this.loading = true;
    this.apiService.get<any>('personal-expense-categories').subscribe({
      next: (r) => {
        this.categories = r.success ? (Array.isArray(r.data) ? r.data : (r.data?.data || [])) : [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  openNew(): void {
    this.editMode = false;
    this.submitted = false;
    this.selectedCategory = null;
    this.form.reset({ name: '', color: '#3498db', icon: 'cilCart', description: '', is_active: true });
    this.showModal = true;
  }

  openEdit(cat: any): void {
    this.editMode = true;
    this.submitted = false;
    this.selectedCategory = cat;
    this.form.patchValue({ name: cat.name, color: cat.color, icon: cat.icon || 'cilCart', description: cat.description || '', is_active: cat.is_active });
    this.showModal = true;
  }

  save(): void {
    this.submitted = true;
    if (this.form.invalid) return;

    const obs = this.editMode && this.selectedCategory
      ? this.apiService.put<any>(`personal-expense-categories/${this.selectedCategory.id}`, this.form.value)
      : this.apiService.post<any>('personal-expense-categories', this.form.value);

    obs.subscribe({
      next: (r) => {
        if (r.success) {
          Swal.fire({ icon: 'success', title: this.editMode ? 'Catégorie modifiée' : 'Catégorie créée', timer: 1800, showConfirmButton: false });
          this.showModal = false;
          this.loadCategories();
        }
      },
      error: (e) => Swal.fire({ icon: 'error', title: 'Erreur', text: e?.error?.message || 'Erreur' })
    });
  }

  delete(cat: any): void {
    Swal.fire({
      title: `Supprimer "${cat.name}" ?`,
      text: 'Les dépenses liées seront déplacées vers "Sans catégorie".',
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#d33', cancelButtonColor: '#6c757d',
      confirmButtonText: 'Supprimer', cancelButtonText: 'Annuler'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.apiService.delete<any>(`personal-expense-categories/${cat.id}`).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', timer: 1500, showConfirmButton: false, title: 'Supprimé' });
          this.loadCategories();
        },
        error: () => Swal.fire({ icon: 'error', title: 'Impossible de supprimer' })
      });
    });
  }

  fmt(v: number): string {
    return new Intl.NumberFormat('fr-GN', { minimumFractionDigits: 0 }).format(v || 0);
  }
}
