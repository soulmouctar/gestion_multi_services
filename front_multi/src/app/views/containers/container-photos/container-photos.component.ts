import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-container-photos',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './container-photos.component.html'
})
export class ContainerPhotosComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  
  containerPhotos: any[] = [];
  containers: any[] = [];
  products: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  currentPage = 1; totalPages = 1; totalItems = 0; itemsPerPage = 15;
  showFormModal = false; editMode = false; submitted = false;
  photoForm: FormGroup;
  selectedItem: any = null;
  deleteModalOpen = false; itemToDelete: any = null;
  selectedFile: File | null = null;
  Math = Math;
  previewModalOpen = false;
  previewItem: any = null;
  
  // Base URL for images (Laravel storage)
  readonly storageBaseUrl = environment.urlBase + '/storage/';

  constructor(private fb: FormBuilder, private apiService: ApiService, private cdr: ChangeDetectorRef) {
    this.photoForm = this.fb.group({
      container_id: [null, Validators.required],
      product_id: [null],
      description: ['', [Validators.maxLength(500)]],
      image_path: ['', Validators.required]
    });
  }

  ngOnInit(): void { this.loadData(); this.loadContainers(); this.loadProducts(); }

  loadContainers(): void {
    this.apiService.get<any>('containers-public?per_page=200').subscribe({
      next: (r) => { 
        if (r.success && r.data) {
          this.containers = Array.isArray(r.data) ? r.data : (r.data.data || []);
        }
      },
      error: (err) => {
        console.error('Error loading containers:', err);
        this.containers = [];
      }
    });
  }

  loadProducts(): void {
    this.apiService.get<any>('products-public?per_page=200').subscribe({
      next: (r) => { 
        if (r.success && r.data) {
          this.products = Array.isArray(r.data) ? r.data : (r.data.data || []);
        }
      },
      error: (err) => {
        console.error('Error loading products:', err);
        this.products = [];
      }
    });
  }

  loadData(): void {
    this.loading = true; this.error = null;
    this.apiService.get<any>(`container-photos-public?page=${this.currentPage}`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const p = response.data;
          this.containerPhotos = p.data || [];
          this.currentPage = p.current_page || 1; this.totalPages = p.last_page || 1;
          this.totalItems = p.total || 0; this.itemsPerPage = p.per_page || 15;
        }
        this.loading = false; this.cdr.detectChanges();
      },
      error: (err) => { 
        console.error('Error loading container photos:', err);
        this.error = 'Erreur lors du chargement'; 
        this.loading = false; 
        this.cdr.detectChanges(); 
      }
    });
  }

  onPageChange(page: number): void { if (page < 1 || page > this.totalPages) return; this.currentPage = page; this.loadData(); }

  openAddModal(): void { 
    this.editMode = false; this.submitted = false; this.selectedItem = null; this.selectedFile = null;
    this.error = null;
    this.photoForm.reset({ container_id: null, product_id: null, description: '', image_path: '' }); 
    this.showFormModal = true;
    
    // Reset file input after modal opens
    setTimeout(() => {
      const fileInput = document.getElementById('imageFile') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    }, 100);
  }

  openEditModal(item: any): void { 
    this.editMode = true; this.submitted = false; this.selectedItem = item; this.selectedFile = null;
    this.photoForm.patchValue({ 
      container_id: item.container_id, 
      product_id: item.product_id || null,
      description: item.description || '',
      image_path: item.image_path 
    }); 
    this.showFormModal = true; 
  }

  onFileSelected(event: any): void {
    console.log('File selection event triggered:', event);
    const file = event.target.files && event.target.files[0];
    console.log('Selected file:', file);
    
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        this.error = 'Format de fichier non supporté. Utilisez JPEG, PNG, JPG ou GIF.';
        this.selectedFile = null;
        this.photoForm.patchValue({ image_path: '' });
        this.cdr.detectChanges();
        return;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        this.error = 'Le fichier est trop volumineux. Taille maximum: 5MB.';
        this.selectedFile = null;
        this.photoForm.patchValue({ image_path: '' });
        this.cdr.detectChanges();
        return;
      }
      
      this.selectedFile = file;
      this.photoForm.patchValue({ image_path: file.name });
      this.error = null;
      console.log('File successfully selected:', file.name, file.size);
      this.cdr.detectChanges();
    } else {
      console.log('No file selected');
      this.selectedFile = null;
      this.photoForm.patchValue({ image_path: '' });
    }
  }

  triggerFileInput(): void {
    // Create a temporary file input element dynamically
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/jpg,image/gif';
    input.style.display = 'none';
    
    input.onchange = (event: any) => {
      const file = event.target.files && event.target.files[0];
      console.log('Dynamic file input - file selected:', file);
      
      if (file) {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
          this.error = 'Format de fichier non supporté. Utilisez JPEG, PNG, JPG ou GIF.';
          this.selectedFile = null;
          this.photoForm.patchValue({ image_path: '' });
          this.cdr.detectChanges();
          document.body.removeChild(input);
          return;
        }
        
        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
          this.error = 'Le fichier est trop volumineux. Taille maximum: 5MB.';
          this.selectedFile = null;
          this.photoForm.patchValue({ image_path: '' });
          this.cdr.detectChanges();
          document.body.removeChild(input);
          return;
        }
        
        this.selectedFile = file;
        this.photoForm.patchValue({ image_path: file.name });
        this.error = null;
        console.log('File successfully selected:', file.name, file.size);
        this.cdr.detectChanges();
      }
      
      // Clean up
      document.body.removeChild(input);
    };
    
    // Append to body and trigger click
    document.body.appendChild(input);
    input.click();
  }

  save(): void {
    this.submitted = true; 
    if (this.photoForm.invalid) return;
    
    const formData = new FormData();
    formData.append('container_id', this.photoForm.get('container_id')?.value);
    formData.append('tenant_id', '1'); // Fixed for testing
    
    // Add product_id if selected
    const productId = this.photoForm.get('product_id')?.value;
    if (productId) {
      formData.append('product_id', productId);
    }
    
    // Add description if provided
    const description = this.photoForm.get('description')?.value;
    if (description) {
      formData.append('description', description);
    }
    
    if (this.selectedFile) {
      formData.append('image', this.selectedFile);
    } else if (this.editMode) {
      formData.append('image_path', this.photoForm.get('image_path')?.value);
    }

    console.log('Uploading container photo with data:', {
      container_id: this.photoForm.get('container_id')?.value,
      product_id: productId,
      description: description,
      file: this.selectedFile?.name,
      tenant_id: 1
    });

    const obs = this.editMode && this.selectedItem
      ? this.apiService.put<any>(`container-photos-public/${this.selectedItem.id}`, formData)
      : this.apiService.post<any>('container-photos-public', formData);
    
    obs.subscribe({
      next: (r) => { 
        if (r.success) { 
          this.successMessage = this.editMode ? 'Photo mise à jour' : 'Photo ajoutée'; 
          this.showFormModal = false; this.loadData(); this.clearMessages(); 
        } 
      },
      error: (err) => { 
        console.error('Container photo save error:', err);
        this.error = err?.error?.message || err?.message || 'Erreur lors de la sauvegarde'; 
      }
    });
  }

  confirmDelete(item: any): void { this.itemToDelete = item; this.deleteModalOpen = true; }

  deleteItem(): void {
    if (!this.itemToDelete) return;
    this.apiService.delete<any>(`container-photos/${this.itemToDelete.id}`).subscribe({
      next: (r) => { 
        if (r.success) { 
          this.successMessage = 'Photo supprimée'; this.deleteModalOpen = false; 
          this.itemToDelete = null; this.loadData(); this.clearMessages(); 
        } 
      },
      error: (err) => { this.error = err?.error?.message || 'Erreur'; this.deleteModalOpen = false; }
    });
  }

  getContainerNumber(id: number): string { 
    const c = this.containers.find(x => x.id === id); 
    return c ? c.container_number : `ID: ${id}`; 
  }

  getImageUrl(imagePath: string): string {
    if (!imagePath) return 'assets/img/placeholder.png';
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    // Build the full URL to Laravel storage
    return this.storageBaseUrl + imagePath;
  }

  previewImage(item: any): void {
    this.previewItem = item;
    this.previewModalOpen = true;
  }

  getPages(): number[] { const p: number[] = []; for (let i = 1; i <= this.totalPages; i++) p.push(i); return p; }
  private clearMessages(): void { setTimeout(() => { this.successMessage = null; this.error = null; this.cdr.detectChanges(); }, 3000); }
}
