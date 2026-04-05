import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import { environment } from '../../../../environments/environment';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-container-detail',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    ModalModule, AlertModule, SpinnerModule, RowComponent, ColComponent, ContainerComponent
  ],
  templateUrl: './container-detail.component.html'
})
export class ContainerDetailComponent implements OnInit {
  container: any = null;
  containerPhotos: any[] = [];
  products: any[] = [];
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  containerId: number | null = null;
  
  // Photo upload
  showPhotoModal = false;
  photoForm: FormGroup;
  selectedFile: File | null = null;
  uploadingPhoto = false;
  
  // Pagination for photos
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  itemsPerPage = 12;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    this.photoForm = this.fb.group({
      product_id: [null],
      description: ['', [Validators.maxLength(255)]]
    });
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.containerId = +params['id'];
        this.loadContainerDetails();
        this.loadContainerPhotos();
        this.loadProducts();
      }
    });
  }

  loadContainerDetails(): void {
    if (!this.containerId) return;
    
    this.loading = true;
    this.apiService.get<any>(`containers/${this.containerId}`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.container = response.data;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Erreur lors du chargement du conteneur';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadContainerPhotos(): void {
    if (!this.containerId) return;
    
    this.apiService.get<any>(`container-photos?container_id=${this.containerId}&page=${this.currentPage}`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const p = response.data;
          this.containerPhotos = p.data || [];
          this.currentPage = p.current_page || 1;
          this.totalPages = p.last_page || 1;
          this.totalItems = p.total || 0;
          this.itemsPerPage = p.per_page || 12;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.containerPhotos = [];
        this.cdr.detectChanges();
      }
    });
  }

  loadProducts(): void {
    this.apiService.get<any>('products?per_page=100').subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.products = response.data.data || [];
        }
        this.cdr.detectChanges();
      },
      error: () => { this.products = []; }
    });
  }

  openPhotoModal(): void {
    this.photoForm.reset();
    this.selectedFile = null;
    this.showPhotoModal = true;
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.error = 'Format non supporté. Utilisez JPEG, PNG, GIF ou WebP.';
      return;
    }

    this.error = null;
    this.compressImage(file).then(compressed => {
      this.selectedFile = compressed;
      this.cdr.detectChanges();
    }).catch(() => {
      // Fallback to original if compression fails
      this.selectedFile = file;
      this.cdr.detectChanges();
    });
  }

  private compressImage(file: File, maxWidth = 1200, quality = 0.82): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('Compression échouée')); return; }
            const name = file.name.replace(/\.[^.]+$/, '.jpg');
            resolve(new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }));
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Chargement image échoué')); };
      img.src = objectUrl;
    });
  }

  uploadPhoto(): void {
    if (!this.selectedFile || !this.containerId) return;
    
    this.uploadingPhoto = true;
    this.error = null;
    
    const formData = new FormData();
    formData.append('container_id', this.containerId.toString());
    formData.append('image', this.selectedFile);
    
    const productId = this.photoForm.get('product_id')?.value;
    if (productId) {
      formData.append('product_id', productId);
    }
    
    const description = this.photoForm.get('description')?.value;
    if (description) {
      formData.append('description', description);
    }

    this.apiService.post<any>('container-photos', formData).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = 'Photo ajoutée avec succès';
          this.showPhotoModal = false;
          this.loadContainerPhotos();
          this.clearMessages();
        }
        this.uploadingPhoto = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur lors de l\'upload de la photo';
        this.uploadingPhoto = false;
        this.cdr.detectChanges();
      }
    });
  }

  deletePhoto(photo: any): void {
    Swal.fire({
      title: 'Confirmer la suppression',
      text: 'Êtes-vous sûr de vouloir supprimer cette photo ?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler'
    }).then((result) => {
      if (result.isConfirmed) {
        this.apiService.delete<any>(`container-photos/${photo.id}`).subscribe({
          next: (response) => {
            if (response.success) {
              Swal.fire({ title: 'Supprimé !', text: 'La photo a été supprimée avec succès.', icon: 'success', timer: 2000, showConfirmButton: false });
              this.loadContainerPhotos();
            }
          },
          error: () => {
            Swal.fire({ title: 'Erreur', text: 'Erreur lors de la suppression de la photo', icon: 'error' });
          }
        });
      }
    });
  }

  getPhotoUrl(imagePath: string): string {
    if (!imagePath) return 'assets/img/placeholder.png';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    return `${environment.urlBase}/storage/${imagePath}`;
  }

  getProductName(productId: number): string {
    if (!productId) return 'Produit général';
    const product = this.products.find(p => p.id === productId);
    return product ? product.name : `Produit #${productId}`;
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadContainerPhotos();
  }

  goBack(): void {
    this.router.navigate(['/containers/list']);
  }

  getPages(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  private clearMessages(): void {
    setTimeout(() => {
      this.successMessage = null;
      this.error = null;
      this.cdr.detectChanges();
    }, 3000);
  }
}
