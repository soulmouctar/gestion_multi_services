import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'success' | 'error';
  text: string;
}

/** Messages brefs en bas d'écran : confirmation d'une action ou échec. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  #next = 1;

  success(text: string): void {
    this.#push('success', text, 3500);
  }

  error(text: string): void {
    this.#push('error', text, 6000);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }

  #push(kind: Toast['kind'], text: string, duration: number): void {
    const id = this.#next++;
    this.toasts.update((list) => [...list, { id, kind, text }]);
    setTimeout(() => this.dismiss(id), duration);
  }
}
