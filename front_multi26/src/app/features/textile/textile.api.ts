import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiService } from '../../core/api.service';

export interface Page<T> {
  data: T[];
  total: number;
  current_page: number;
  last_page: number;
}

export interface Container {
  id: number;
  container_number: string;
  shipping_number: string;
  bl_number: string | null;
  capacity: number | null;
  delivery_status: 'LIVRE' | 'NON_LIVRE';
  entry_port: string | null;
  entry_date: string | null;
  expected_delivery_date: string | null;
}

export interface Photo {
  id: number;
  container_id: number;
  container_arrival_id: number | null;
  image_url: string;
  description: string | null;
}

export interface Arrival {
  id: number;
  arrival_number: string;
  container_id: number;
  supplier_id: number | null;
  arrival_date: string;
  /** Dette envers le fournisseur, dans `currency`. */
  purchase_price: number;
  currency: string;
  /** Prix tel que saisi, quand il l'a été dans une autre devise que la dette. */
  price_currency: string | null;
  unit_price: number | null;
  price_total: number | null;
  price_rate: number | null;
  total_quantity: number;
  bale_quantity: number | null;
  remaining_quantity: number;
  status: string;
  container?: Container;
  supplier?: { id: number; name: string } | null;
  photos?: Photo[];
}

export interface Client {
  id: number;
  name: string;
  phone1: string | null;
  client_type: string;
}

export interface Sale {
  id: number;
  container_arrival_id: number;
  client_id: number;
  quantity_sold: number;
  sale_price: string;
  currency: string;
  exchange_rate: string;
  amount_paid: string;
  remaining_amount: string;
  sale_date: string;
  status: 'EN_COURS' | 'PAYE_PARTIEL' | 'PAYE_TOTAL' | 'ANNULE';
  notes: string | null;
  container_arrival?: Arrival;
  client?: Client;
}

export interface Payment {
  id: number;
  container_sale_id: number;
  client_id: number;
  amount: string;
  amount_gnf: string | null;
  currency: string;
  exchange_rate: string;
  payment_method: string;
  payment_date: string;
  reference: string | null;
  payment_type: string | null;
  container_sale?: Sale;
  client?: Client;
}

export interface PaymentsSummary {
  payments_count: number;
  by_currency: { currency: string; payments_count: number; total_amount: number }[];
}

export interface CurrencyTotals {
  total_debit: number;
  total_credit: number;
  final_balance: number;
}

export interface ClientSituation {
  id: number;
  name: string;
  phone1: string | null;
  client_type: string;
  photo_url: string | null;
  container_charged: number;
  by_currency: Record<string, CurrencyTotals>;
}

export interface LedgerRow {
  date: string;
  type_label: string;
  designation: string | null;
  quantity: number | null;
  currency: string;
  debit: number;
  credit: number;
  balance: number;
  exchange_rate: number | null;
  reference: string | null;
}

export interface Ledger {
  client: { id: number; name: string; phone1: string | null };
  summary: { currencies: string[]; by_currency: Record<string, CurrencyTotals & { opening_balance: number }> };
  rows: LedgerRow[];
}

/** Devises acceptées. Le GNF est la monnaie de référence des taux. */
export const CURRENCIES = ['GNF', 'USD', 'EUR'];

export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'ESPECES', label: 'Espèces' },
  { value: 'VIREMENT', label: 'Virement' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'MOBILE_MONEY', label: 'Mobile money' },
];

export const SALE_STATUS: Record<Sale['status'], { label: string; tone: string }> = {
  EN_COURS: { label: 'Non payée', tone: 'is-warning' },
  PAYE_PARTIEL: { label: 'Payée en partie', tone: 'is-info' },
  PAYE_TOTAL: { label: 'Soldée', tone: 'is-success' },
  ANNULE: { label: 'Annulée', tone: 'is-danger' },
};

/**
 * Devise étrangère d'une conversion entre deux devises, celle dont il faut le taux en GNF.
 * `null` : aucune conversion (même devise). `undefined` : deux devises étrangères, non géré.
 */
export function rateCurrency(from: string, to: string): string | null | undefined {
  if (from === to) {
    return null;
  }
  if (from === 'GNF') {
    return to;
  }
  return to === 'GNF' ? from : undefined;
}

/** Convertit entre le GNF et une devise ; `rate` = nombre de GNF pour 1 unité de la devise. */
export function convert(amount: number, from: string, to: string, rate: number): number {
  if (from === to) {
    return amount;
  }
  if (!(rate > 0)) {
    return 0;
  }
  const converted = from === 'GNF' ? amount / rate : amount * rate;
  return to === 'GNF' ? Math.round(converted) : Math.round(converted * 100) / 100;
}

@Injectable({ providedIn: 'root' })
export class TextileApi {
  readonly #api = inject(ApiService);

  containers(): Observable<Container[]> {
    return this.#api.get<Page<Container>>('containers', { per_page: 200 }).pipe(map((page) => page.data));
  }

  createContainer(body: Partial<Container> & { expected_product_category_id?: number | null }): Observable<Container> {
    return this.#api.post<Container>('containers', body);
  }

  updateContainer(id: number, body: Partial<Container>): Observable<Container> {
    return this.#api.put<Container>(`containers/${id}`, body);
  }

  arrivals(): Observable<Arrival[]> {
    return this.#api.get<Page<Arrival>>('container-arrivals', { per_page: 200 }).pipe(map((page) => page.data));
  }

  createArrival(body: Record<string, unknown>): Observable<Arrival> {
    return this.#api.post<Arrival>('container-arrivals', body);
  }

  updateArrival(id: number, body: Record<string, unknown>): Observable<Arrival> {
    return this.#api.put<Arrival>(`container-arrivals/${id}`, body);
  }

  uploadPhoto(arrival: Arrival, file: File): Observable<Photo> {
    const form = new FormData();
    form.append('container_id', String(arrival.container_id));
    form.append('container_arrival_id', String(arrival.id));
    form.append('image', file);
    return this.#api.post<Photo>('container-photos', form);
  }

  deletePhoto(id: number): Observable<unknown> {
    return this.#api.delete(`container-photos/${id}`);
  }

  sales(query: Record<string, string | number | null> = {}): Observable<Sale[]> {
    return this.#api.get<Page<Sale>>('container-sales', { per_page: 500, ...query }).pipe(map((page) => page.data));
  }

  createSale(body: Record<string, unknown>): Observable<Sale> {
    return this.#api.post<Sale>('container-sales', body);
  }

  /** Corrige le total d'une vente ; le reste à payer est recalculé depuis les versements. */
  updateSalePrice(id: number, salePrice: number): Observable<Sale> {
    return this.#api.put<Sale>(`container-sales/${id}`, { sale_price: salePrice });
  }

  cancelSale(id: number): Observable<Sale> {
    return this.#api.put<Sale>(`container-sales/${id}`, { status: 'ANNULE' });
  }

  payments(query: Record<string, string | number | null> = {}): Observable<Page<Payment>> {
    return this.#api.get<Page<Payment>>('container-sale-payments', query);
  }

  paymentsSummary(query: Record<string, string | number | null>): Observable<PaymentsSummary> {
    return this.#api.get<PaymentsSummary>('container-sale-payments/summary', query);
  }

  createPayment(body: Record<string, unknown>): Observable<Payment> {
    return this.#api.post<Payment>('container-sale-payments', body);
  }

  deletePayment(id: number): Observable<unknown> {
    return this.#api.delete(`container-sale-payments/${id}`);
  }

  clients(): Observable<Client[]> {
    return this.#api.get<Page<Client>>('clients', { per_page: 1000 }).pipe(map((page) => page.data));
  }

  createClient(name: string, phone1: string, type = 'TEXTILE', address = ''): Observable<Client> {
    return this.#api.post<Client>('clients', { name, phone1: phone1 || null, address: address || null, client_type: type });
  }

  suppliers(): Observable<{ id: number; name: string }[]> {
    return this.#api.get<Page<{ id: number; name: string }>>('suppliers', { per_page: 500 }).pipe(map((page) => page.data));
  }

  /** Taux configurés (GNF pour 1 unité). Un taux ≤ 1 signifie « non configuré ». */
  rates(): Observable<Record<string, number>> {
    return this.#api.get<{ code: string; exchange_rate: string }[]>('currencies').pipe(
      map((list) =>
        Object.fromEntries(
          list.map((currency) => [currency.code.toUpperCase(), Number(currency.exchange_rate)] as const).filter(([, rate]) => rate > 1),
        ),
      ),
    );
  }

  textileCategoryId(): Observable<number | null> {
    return this.#api
      .get<Page<{ id: number; name: string }>>('product-categories', { per_page: 200 })
      .pipe(map((page) => page.data.find((category) => /textile/i.test(category.name))?.id ?? null));
  }

  situation(): Observable<ClientSituation[]> {
    return this.#api.get<{ clients: ClientSituation[] }>('clients/financial-overview').pipe(map((data) => data.clients));
  }

  uploadClientPhoto(clientId: number, photo: File): Observable<unknown> {
    const body = new FormData();
    body.append('photo', photo);
    return this.#api.post(`clients/${clientId}/photo`, body);
  }

  /** Frais d'intérêts portés au débit du compte du client. */
  addInterest(clientId: number, amount: number, currency: string, date: string, notes: string): Observable<unknown> {
    return this.#api.post('client-interest-charges', { client_id: clientId, amount, currency, charge_date: date, notes: notes || null });
  }

  ledger(clientId: number, from: string, to: string): Observable<Ledger> {
    return this.#api.get<Ledger>(`clients/${clientId}/ledger`, { from, to });
  }
}
