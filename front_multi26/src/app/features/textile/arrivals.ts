import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { catchError, concatMap, from, of, toArray } from 'rxjs';

import { apiError, DayPipe, NumberPipe } from '../../shared/format';
import { compressImage } from '../../shared/image-compression';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { ToastService } from '../../shared/toast.service';
import { Arrival, Photo, TextileApi } from './textile.api';
import { ButtonIcon } from '../../shared/button-icon';

/** Limite du serveur, vérifiée après allègement. */
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/** Photos de chaque arrivage : ajout, consultation, suppression. */
@Component({
  selector: 'app-textile-arrivals',
  imports: [PageHeader, Modal, DayPipe, NumberPipe, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './arrivals.html',
  styleUrl: './arrivals.scss',
})
export class Arrivals {
  readonly #api = inject(TextileApi);
  readonly #toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly arrivals = signal<Arrival[]>([]);
  /** Arrivage en cours d'envoi de photos. */
  protected readonly uploadingFor = signal<number | null>(null);
  protected readonly viewing = signal<Photo | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.#api.arrivals().subscribe({
      next: (arrivals) => {
        this.arrivals.set(arrivals);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.#toast.error(apiError(error, 'Les arrivages n\'ont pas pu être chargés.'));
      },
    });
  }

  protected addPhotos(arrival: Arrival, input: HTMLInputElement): void {
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) {
      return;
    }

    this.uploadingFor.set(arrival.id);
    // Une photo à la fois, allégée avant l'envoi : un échec n'empêche pas les suivantes
    from(files)
      .pipe(
        concatMap((file) =>
          from(compressImage(file)).pipe(
            concatMap((light) => (light.size > MAX_PHOTO_BYTES ? of(null) : this.#api.uploadPhoto(arrival, light))),
            catchError(() => of(null)),
          ),
        ),
        toArray(),
      )
      .subscribe((results) => {
        const sent = results.filter(Boolean).length;
        this.uploadingFor.set(null);
        if (sent) {
          this.#toast.success(`${sent} photo(s) ajoutée(s) à l'arrivage ${arrival.arrival_number}.`);
        }
        if (sent < results.length) {
          this.#toast.error(`${results.length - sent} photo(s) non envoyée(s) : format non reconnu ou fichier trop lourd.`);
        }
        this.load();
      });
  }

  protected remove(photo: Photo): void {
    this.#api.deletePhoto(photo.id).subscribe({
      next: () => {
        this.viewing.set(null);
        this.#toast.success('Photo supprimée.');
        this.load();
      },
      error: (error) => this.#toast.error(apiError(error)),
    });
  }
}
