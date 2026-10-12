import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { AuthService } from '../core/auth.service';
import { DayPipe } from './format';
import { PdfService } from './pdf.service';
import { Modal } from './modal';
import { ButtonIcon } from './button-icon';

export interface ReceiptLine {
  label: string;
  value: string;
  /** Ligne mise en avant : le montant principal du reçu. */
  main?: boolean;
}

/** Imprime la fenêtre ouverte seule : la classe masque le reste de l'écran le temps de l'impression. */
export function printModal(): void {
  const body = document.body;
  body.classList.add('print-modal');
  window.addEventListener('afterprint', () => body.classList.remove('print-modal'), { once: true });
  window.print();
}

/** Reçu imprimable : même mise en page pour un encaissement client ou un paiement fournisseur. */
@Component({
  selector: 'app-receipt',
  imports: [Modal, DayPipe, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="title()" (closed)="closed.emit()">
      <div class="receipt">
        <header>
          <strong>{{ organisation() }}</strong>
          <span>{{ title() }} n° {{ number() }} · {{ date() | day }}</span>
        </header>
        <dl>
          @for (line of lines(); track line.label) {
            <dt>{{ line.label }}</dt>
            <dd class="num" [class.amount]="line.main">{{ line.value }}</dd>
          }
        </dl>
        <footer>
          <span>{{ leftSignature() }}</span>
          <span>Signature et cachet</span>
        </footer>
      </div>
      <ng-container modal-footer>
        <button class="btn" type="button" (click)="closed.emit()">Fermer</button>
        <button class="btn btn-primary" type="button" (click)="print()">Imprimer</button>
      </ng-container>
    </app-modal>
  `,
})
export class Receipt {
  protected readonly organisation = inject(AuthService).tenantName;
  readonly #pdf = inject(PdfService);

  protected print(): void {
    this.#pdf.receipt({ title: this.title(), number: this.number(), date: this.date(), lines: this.lines(), leftSignature: this.leftSignature() });
  }

  readonly title = input('Reçu');
  readonly number = input.required<string | number>();
  readonly date = input.required<string>();
  readonly lines = input.required<ReceiptLine[]>();
  readonly leftSignature = input('Signature du client');
  readonly closed = output<void>();
}
