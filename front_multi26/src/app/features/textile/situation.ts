import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Avatar } from '../../shared/avatar';
import { apiError, DayPipe, formatMoney, formatNumber, MoneyPipe, NumberPipe, today } from '../../shared/format';
import { compressImage } from '../../shared/image-compression';
import { Modal } from '../../shared/modal';
import { PageHeader } from '../../shared/page-header';
import { PdfService } from '../../shared/pdf.service';
import { Pager, paginate } from '../../shared/pager';
import { ToastService } from '../../shared/toast.service';
import { ClientSituation, CURRENCIES, Ledger, TextileApi } from './textile.api';
import { ButtonIcon } from '../../shared/button-icon';

/** Situation de chaque client : un compte par devise, et le relevé détaillé. */
@Component({
  selector: 'app-textile-situation',
  imports: [ReactiveFormsModule, PageHeader, Modal, Avatar, MoneyPipe, NumberPipe, DayPipe, Pager, ButtonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './situation.html',
})
export class Situation {
  readonly #api = inject(TextileApi);
  readonly #toast = inject(ToastService);

  /** Fourni par la route : clients du textile, ou ceux du commercial (pneus et cosmétique). */
  readonly scope = input<'textile' | 'commercial'>('textile');

  protected readonly loading = signal(true);
  protected readonly search = signal('');
  protected readonly debtorsOnly = signal(false);
  readonly #all = signal<ClientSituation[]>([]);
  readonly #clients = computed(() =>
    this.#all().filter((client) => {
      // Textile : les clients de ce type, et tout client ayant acheté sur un conteneur
      const textile = client.client_type === 'TEXTILE' || Number(client.container_charged) > 0;
      return this.scope() === 'textile' ? textile : client.client_type !== 'TEXTILE';
    }),
  );

  /** Devises présentes dans les comptes, le GNF en premier. */
  protected readonly currencies = computed(() => {
    const codes = new Set<string>(['GNF', 'USD']);
    for (const client of this.#clients()) {
      Object.keys(client.by_currency ?? {}).forEach((code) => codes.add(code));
    }
    return [...codes].sort((a, b) => (a === 'GNF' ? -1 : b === 'GNF' ? 1 : a.localeCompare(b)));
  });
  protected readonly clients = computed(() => {
    const term = this.search().trim().toLowerCase();
    const debtorsOnly = this.debtorsOnly();
    return this.#clients().filter(
      (client) =>
        (!term || client.name.toLowerCase().includes(term)) &&
        (!debtorsOnly || this.currencies().some((currency) => this.balance(client, currency) > 0)),
    );
  });
  protected readonly pager = paginate(this.clients);
  /** Total dû par devise : seuls les soldes débiteurs comptent, une avance ne réduit pas la dette d'un autre. */
  protected readonly totals = computed(() =>
    this.currencies().map((currency) => ({
      currency,
      due: this.#clients().reduce((sum, client) => sum + Math.max(0, this.balance(client, currency)), 0),
      debtors: this.#clients().filter((client) => this.balance(client, currency) > 0).length,
    })),
  );

  // --- Relevé d'un client ---------------------------------------------------
  protected readonly viewing = signal<ClientSituation | null>(null);
  protected readonly ledger = signal<Ledger | null>(null);
  protected readonly ledgerLoading = signal(false);
  protected readonly period = inject(FormBuilder).nonNullable.group({ from: [''], to: [''] });

  // --- Nouveau client -------------------------------------------------------
  protected readonly creating = signal(false);
  protected readonly savingClient = signal(false);
  protected readonly clientForm = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    phone: [''],
    address: [''],
    type: ['PNEUS'],
  });

  protected openClient(): void {
    this.clientForm.reset({ type: this.scope() === 'textile' ? 'TEXTILE' : 'PNEUS' });
    this.creating.set(true);
  }

  protected saveClient(): void {
    if (this.clientForm.invalid || this.savingClient()) {
      this.clientForm.markAllAsTouched();
      return;
    }
    const { name, phone, address, type } = this.clientForm.getRawValue();
    this.savingClient.set(true);
    this.#api.createClient(name.trim(), phone.trim(), type, address.trim()).subscribe({
      next: () => {
        this.savingClient.set(false);
        this.creating.set(false);
        this.#toast.success('Client ajouté.');
        this.reload();
      },
      error: (error) => {
        this.savingClient.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }

  // --- Intérêts -------------------------------------------------------------
  protected readonly allCurrencies = CURRENCIES;
  protected readonly addingInterest = signal(false);
  protected readonly savingInterest = signal(false);
  protected readonly interestForm = inject(FormBuilder).nonNullable.group({
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    currency: ['GNF'],
    date: [today(), Validators.required],
    notes: [''],
  });

  constructor() {
    this.reload();
  }

  protected reload(): void {
    this.#api.situation().subscribe({
      next: (clients) => {
        this.#all.set(clients);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.#toast.error(apiError(error, 'La situation des clients n\'a pas pu être chargée.'));
      },
    });
  }

  protected value(client: ClientSituation, currency: string, field: 'total_debit' | 'total_credit'): number {
    return Number(client.by_currency?.[currency]?.[field]) || 0;
  }

  protected balance(client: ClientSituation, currency: string): number {
    return Number(client.by_currency?.[currency]?.final_balance) || 0;
  }

  protected open(client: ClientSituation): void {
    this.period.reset();
    this.viewing.set(client);
    this.loadLedger();
  }

  protected loadLedger(): void {
    const client = this.viewing();
    if (!client) {
      return;
    }
    const { from, to } = this.period.getRawValue();
    this.ledgerLoading.set(true);
    this.#api.ledger(client.id, from, to).subscribe({
      next: (ledger) => {
        this.ledger.set(ledger);
        this.ledgerLoading.set(false);
      },
      error: (error) => {
        this.ledgerLoading.set(false);
        this.#toast.error(apiError(error, 'Le relevé n\'a pas pu être chargé.'));
      },
    });
  }

  readonly #pdf = inject(PdfService);

  /** Relevé du client : un tableau par devise, avec le solde après chaque opération. */
  protected print(): void {
    const ledger = this.ledger();
    const client = this.viewing();
    if (!ledger || !client) {
      return;
    }
    const { from, to } = this.period.getRawValue();
    const period = from || to ? `Du ${from || 'début'} au ${to || 'aujourd\'hui'}` : 'Toute la période';
    this.#pdf.tables(
      `Relevé de compte — ${client.name}`,
      [client.phone1, period].filter(Boolean).join(' · '),
      ledger.summary.currencies.map((currency) => {
        const totals = ledger.summary.by_currency[currency];
        const rows = ledger.rows.filter((row) => row.currency === currency);
        return {
          title: `Compte ${currency}`,
          subtitle: `Solde : ${formatMoney(totals.final_balance, currency)}${totals.final_balance < 0 ? ' (en avance)' : ''}`,
          columns: [
            { header: 'Date', width: 58 },
            { header: 'Opération' },
            { header: 'Qté', align: 'right' as const },
            { header: 'Taux', align: 'right' as const },
            { header: 'Débit', align: 'right' as const },
            { header: 'Crédit', align: 'right' as const },
            { header: 'Solde', align: 'right' as const },
          ],
          rows: rows.map((row) => [
            row.date.slice(8, 10) + '/' + row.date.slice(5, 7) + '/' + row.date.slice(0, 4),
            [row.type_label, row.designation, row.reference].filter(Boolean).join(' — '),
            row.quantity ? formatNumber(row.quantity) : '',
            row.exchange_rate && row.exchange_rate > 1 ? formatNumber(row.exchange_rate) : '',
            row.debit ? formatNumber(row.debit) : '',
            row.credit ? formatNumber(row.credit) : '',
            formatNumber(row.balance),
          ]),
          totals: [['', 'Totaux', '', '', formatNumber(totals.total_debit), formatNumber(totals.total_credit), formatNumber(totals.final_balance)]],
        };
      }),
    );
  }

  /** Situation de tous les clients affichés, compte par compte. */
  protected printList(): void {
    const currencies = this.currencies();
    this.#pdf.table({
      title: this.scope() === 'textile' ? 'Situation des clients — Textile' : 'Situation des clients',
      subtitle: 'Solde positif : le client doit. Solde négatif : il est en avance.',
      landscape: currencies.length > 1,
      facts: this.totals().map((total) => ({ label: `Reste à payer en ${total.currency}`, value: formatMoney(total.due, total.currency) })),
      columns: [{ header: 'Client' }, { header: 'Téléphone', width: 80 }, ...currencies.flatMap((currency) => [{ header: `Débit ${currency}`, align: 'right' as const }, { header: `Crédit ${currency}`, align: 'right' as const }, { header: `Solde ${currency}`, align: 'right' as const }])],
      rows: this.clients().map((client) => [
        client.name,
        client.phone1 ?? '',
        ...currencies.flatMap((currency) => [formatNumber(this.value(client, currency, 'total_debit')), formatNumber(this.value(client, currency, 'total_credit')), formatNumber(this.balance(client, currency))]),
      ]),
    });
  }

  protected async setPhoto(client: ClientSituation, input: HTMLInputElement): Promise<void> {
    const picked = input.files?.[0];
    input.value = '';
    if (!picked) {
      return;
    }
    const photo = await compressImage(picked);
    this.#api.uploadClientPhoto(client.id, photo).subscribe({
      next: () => {
        this.#toast.success(`Photo de ${client.name} enregistrée.`);
        this.reload();
      },
      error: (error) => this.#toast.error(apiError(error)),
    });
  }

  protected saveInterest(): void {
    const client = this.viewing();
    if (!client || this.interestForm.invalid || this.savingInterest()) {
      this.interestForm.markAllAsTouched();
      return;
    }
    const { amount, currency, date, notes } = this.interestForm.getRawValue();
    this.savingInterest.set(true);
    this.#api.addInterest(client.id, Number(amount), currency, date, notes).subscribe({
      next: () => {
        this.savingInterest.set(false);
        this.addingInterest.set(false);
        this.interestForm.reset({ currency: 'GNF', date: today() });
        this.#toast.success('Intérêt ajouté au débit du compte.');
        this.loadLedger();
        this.reload();
      },
      error: (error) => {
        this.savingInterest.set(false);
        this.#toast.error(apiError(error));
      },
    });
  }

  protected close(): void {
    this.viewing.set(null);
    this.ledger.set(null);
  }
}
