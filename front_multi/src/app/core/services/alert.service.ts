import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon, SweetAlertResult } from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class AlertService {

  constructor() { }

  // Success messages
  showSuccess(title: string, text?: string, timer: number = 3000): Promise<SweetAlertResult> {
    return Swal.fire({
      title: title,
      text: text,
      icon: 'success',
      timer: timer,
      timerProgressBar: true,
      showConfirmButton: false,
      toast: true,
      position: 'top-end',
      showClass: {
        popup: 'animate__animated animate__fadeInRight'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutRight'
      }
    });
  }

  // Error messages
  showError(title: string, text?: string): Promise<SweetAlertResult> {
    return Swal.fire({
      title: title,
      text: text,
      icon: 'error',
      confirmButtonText: 'OK',
      confirmButtonColor: '#dc3545',
      showClass: {
        popup: 'animate__animated animate__shakeX'
      }
    });
  }

  // Warning messages
  showWarning(title: string, text?: string): Promise<SweetAlertResult> {
    return Swal.fire({
      title: title,
      text: text,
      icon: 'warning',
      confirmButtonText: 'OK',
      confirmButtonColor: '#ffc107'
    });
  }

  // Info messages
  showInfo(title: string, text?: string): Promise<SweetAlertResult> {
    return Swal.fire({
      title: title,
      text: text,
      icon: 'info',
      confirmButtonText: 'OK',
      confirmButtonColor: '#0dcaf0'
    });
  }

  // Confirmation dialogs
  showConfirmation(
    title: string, 
    text: string, 
    confirmButtonText: string = 'Oui, confirmer!',
    cancelButtonText: string = 'Annuler',
    icon: SweetAlertIcon = 'warning'
  ): Promise<SweetAlertResult> {
    return Swal.fire({
      title: title,
      text: text,
      icon: icon,
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: confirmButtonText,
      cancelButtonText: cancelButtonText,
      reverseButtons: true,
      focusCancel: true
    });
  }

  // Delete confirmation
  showDeleteConfirmation(itemName: string, itemType: string = 'élément'): Promise<SweetAlertResult> {
    return this.showConfirmation(
      'Êtes-vous sûr?',
      `Voulez-vous vraiment supprimer ${itemType} "${itemName}"? Cette action est irréversible!`,
      'Oui, supprimer!',
      'Annuler',
      'warning'
    );
  }

  // Loading dialog
  showLoading(title: string = 'Chargement...', text?: string): void {
    Swal.fire({
      title: title,
      text: text,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
  }

  // Close loading
  closeLoading(): void {
    Swal.close();
  }

  // Custom toast notification
  showToast(
    title: string, 
    icon: SweetAlertIcon = 'success', 
    position: any = 'top-end',
    timer: number = 3000
  ): Promise<SweetAlertResult> {
    return Swal.fire({
      title: title,
      icon: icon,
      toast: true,
      position: position,
      showConfirmButton: false,
      timer: timer,
      timerProgressBar: true,
      showClass: {
        popup: 'animate__animated animate__fadeInDown'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp'
      }
    });
  }

  // Question dialog
  showQuestion(title: string, text: string): Promise<SweetAlertResult> {
    return Swal.fire({
      title: title,
      text: text,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0d6efd',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Oui',
      cancelButtonText: 'Non'
    });
  }

  // Input dialog
  showInput(
    title: string, 
    inputPlaceholder: string = '',
    inputType: any = 'text',
    inputValue: string = ''
  ): Promise<SweetAlertResult> {
    return Swal.fire({
      title: title,
      input: inputType,
      inputPlaceholder: inputPlaceholder,
      inputValue: inputValue,
      showCancelButton: true,
      confirmButtonText: 'Valider',
      cancelButtonText: 'Annuler',
      inputValidator: (value: string) => {
        if (!value) {
          return 'Vous devez saisir une valeur!';
        }
        return null;
      }
    });
  }

  // Progress dialog
  showProgress(title: string, text: string, progress: number): void {
    Swal.fire({
      title: title,
      text: text,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      html: `
        <div class="progress" style="height: 20px;">
          <div class="progress-bar bg-primary" role="progressbar" 
               style="width: ${progress}%" 
               aria-valuenow="${progress}" 
               aria-valuemin="0" 
               aria-valuemax="100">
            ${progress}%
          </div>
        </div>
      `
    });
  }
}
