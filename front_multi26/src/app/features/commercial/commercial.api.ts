import { inject, Injectable } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { Client, CurrencyTotals, Page } from '../textile/textile.api';

/** Les deux familles de produits du commercial. */
export type FamilyKey = 'pneus' | 'cosmetique';

export interface Family {
  key: FamilyKey;
  label: string;
  /** Catégorie de produits correspondante côté serveur. */
  categoryId: number | null;
  /** Code de catégorie des achats fournisseurs. */
  purchaseCategory: string;
  /** Le cosmétique se vend en pièces et en cartons ; un pneu, à la pièce. */
  cartons: boolean;
}

export interface Product {
  id: number;
  name: string;
  image_url: string | null;
  product_category_id: number | null;
  purchase_price: string | null;
  selling_price: string | null;
  carton_selling_price: string | null;
  units_per_carton: number | null;
  stock_quantity: number;
  /** Pièces avariées, tenues à part du stock sain. */
  damaged_quantity: number;
  low_stock_threshold: number | null;
  status: string;
}

/** État du stock d'un produit, en pièces. */
export interface StockRow {
  id: number;
  name: string;
  image_url: string | null;
  units_per_carton: number;
  purchase_price: number;
  selling_price: number;
  low_stock_threshold: number;
  /** Entré par les fournisseurs et les conteneurs. */
  received: number;
  sold: number;
  sold_damaged: number;
  /** Sorti du stock sans être vendu : jeté, volé, cassé. */
  lost: number;
  /** Avarié encore en stock. */
  damaged: number;
  /** Stock sain restant. */
  stock: number;
}

export interface StockSummary {
  products: StockRow[];
  totals: { received: number; sold: number; sold_damaged: number; lost: number; damaged: number; stock: number };
}

export type AdjustmentType = 'AVARIE' | 'PERTE' | 'REMISE' | 'INVENTAIRE';

export interface StockCard {
  product: { id: number; name: string; units_per_carton: number };
  opening_stock: number;
  current_stock: number;
  current_damaged: number;
  total_in: number;
  total_out: number;
  rows: { date: string; party: string; reference: string | null; in: number; out: number; damaged: number; balance: number; damaged_balance: number }[];
}

export interface SupplierBalance {
  id: number;
  name: string;
  /** Activité du fournisseur : pneus, cosmétique, textile… */
  category: string | null;
  phone1: string | null;
  by_currency: Record<string, CurrencyTotals>;
}

export interface Purchase {
  id: number;
  purchase_number: string;
  designation: string;
  quantity: string;
  unit_price: string;
  total_amount: string;
  currency: string;
  exchange_rate: string;
  purchase_date: string;
  reference: string | null;
  /** Achat né d'un conteneur de pneus : il se corrige depuis ce conteneur. */
  tyre_container_id: number | null;
  product?: { id: number; name: string; units_per_carton: number | null } | null;
}

export interface SupplierHistory {
  supplier: { id: number; name: string; photo_url: string | null };
  summary: { by_currency: Record<string, CurrencyTotals>; currencies: string[] };
  arrivals: {
    id: number;
    arrival_date: string;
    container_number: string | null;
    total_quantity: number;
    purchase_price: number;
    currency: string;
  }[];
  payments: {
    id: number;
    date: string;
    amount: number;
    currency: string;
    target_currency: string;
    converted_amount: number;
    exchange_rate: number;
    payment_method: string;
    reference: string | null;
  }[];
}

export interface Invoice {
  id: number;
  invoice_number: string;
  total_amount: string;
  paid_amount: string;
  remaining_balance: number;
  currency: string;
  status: 'PAYE' | 'PARTIEL' | 'IMPAYE';
  created_at: string;
  notes: string | null;
  client: { id: number; name: string } | null;
  items: { product_id: number | null; description: string; quantity: string; sale_type: string; unit_price: string; line_total: string }[];
}

const FAMILY_DEFS: { key: FamilyKey; label: string; match: RegExp; purchaseCategory: string; cartons: boolean }[] = [
  { key: 'pneus', label: 'Pneus', match: /pneu/i, purchaseCategory: 'PNEUS', cartons: false },
  { key: 'cosmetique', label: 'Cosmétique', match: /cosm/i, purchaseCategory: 'COSMETIQUES', cartons: true },
];

/** Stock exprimé en cartons entiers et pièces restantes. */
export function cartonsOf(units: number, perCarton: number | null): { cartons: number; pieces: number } | null {
  const size = Number(perCarton) || 0;
  if (size <= 1) {
    return null;
  }
  const sign = units < 0 ? -1 : 1;
  const absolute = Math.abs(units);
  return { cartons: sign * Math.floor(absolute / size), pieces: sign * (absolute % size) };
}

@Injectable({ providedIn: 'root' })
export class CommercialApi {
  readonly #api = inject(ApiService);

  /** Familles et leur catégorie serveur ; chargées une fois. */
  readonly families$: Observable<Family[]> = this.#api
    .get<Page<{ id: number; name: string }>>('product-categories', { per_page: 200 })
    .pipe(
      map((page) =>
        FAMILY_DEFS.map(({ match, ...family }) => ({
          ...family,
          categoryId: page.data.find((category) => match.test(category.name))?.id ?? null,
        })),
      ),
      shareReplay(1),
    );

  products(categoryId: number | null): Observable<Product[]> {
    return this.#api
      .get<Page<Product>>('products', { per_page: 1000, category_id: categoryId, sort_by: 'name', sort_order: 'asc' })
      .pipe(map((page) => page.data));
  }

  saveProduct(id: number | null, body: Record<string, unknown>): Observable<Product> {
    return id ? this.#api.put<Product>(`products/${id}`, body) : this.#api.post<Product>('products', body);
  }

  /** Photo d'un produit ou d'un fournisseur ; `photo` est déjà allégée. */
  uploadPhoto(endpoint: string, field: string, photo: File): Observable<unknown> {
    const body = new FormData();
    body.append(field, photo);
    return this.#api.post(endpoint, body);
  }

  deleteProduct(id: number): Observable<unknown> {
    return this.#api.delete(`products/${id}`);
  }

  deleteSupplier(id: number): Observable<unknown> {
    return this.#api.delete(`suppliers/${id}`);
  }

  stockSummary(categoryId: number): Observable<StockSummary> {
    return this.#api.get<StockSummary>('stock/summary', { category_id: categoryId });
  }

  /** Avarie, perte, remise en état ou inventaire : toujours une écriture datée, jamais une retouche du stock. */
  adjustStock(productId: number, body: Record<string, unknown>): Observable<unknown> {
    return this.#api.post(`products/${productId}/adjustments`, body);
  }

  stockCard(productId: number): Observable<StockCard> {
    return this.#api.get<StockCard>(`products/${productId}/movements`);
  }

  suppliers(): Observable<SupplierBalance[]> {
    return this.#api.get<{ suppliers: SupplierBalance[] }>('suppliers/balance-summary').pipe(map((data) => data.suppliers));
  }

  createSupplier(name: string, phone1: string): Observable<{ id: number }> {
    return this.#api.post<{ id: number }>('suppliers', { name, phone1: phone1 || null, currency: 'GNF' });
  }

  supplierHistory(id: number): Observable<SupplierHistory> {
    return this.#api.get<SupplierHistory>(`suppliers/${id}/history`);
  }

  purchases(supplierId: number): Observable<Purchase[]> {
    return this.#api.get<Page<Purchase>>('supplier-purchases', { supplier_id: supplierId, per_page: 500 }).pipe(map((page) => page.data));
  }

  createPurchase(supplierId: number, body: Record<string, unknown>): Observable<Purchase> {
    return this.#api.post<Purchase>(`suppliers/${supplierId}/purchases`, body);
  }

  deletePurchase(id: number): Observable<unknown> {
    return this.#api.delete(`supplier-purchases/${id}`);
  }

  createSupplierPayment(supplierId: number, body: Record<string, unknown>): Observable<unknown> {
    return this.#api.post(`suppliers/${supplierId}/payments`, body);
  }

  deleteSupplierPayment(supplierId: number, paymentId: number): Observable<unknown> {
    return this.#api.delete(`suppliers/${supplierId}/payments/${paymentId}`);
  }

  invoices(): Observable<Invoice[]> {
    return this.#api.get<Page<Invoice>>('invoices', { per_page: 500 }).pipe(map((page) => page.data));
  }

  createInvoice(body: Record<string, unknown>): Observable<Invoice> {
    return this.#api.post<Invoice>('invoices', body);
  }

  cancelInvoice(id: number): Observable<unknown> {
    return this.#api.delete(`invoices/${id}`);
  }

  /** Encaissement d'un client sur une facture ; `target_currency` est la devise de la facture. */
  payInvoice(body: Record<string, unknown>): Observable<unknown> {
    return this.#api.post('payments', { type: 'CLIENT', ...body });
  }

  clients(): Observable<Client[]> {
    return this.#api.get<Page<Client>>('clients', { per_page: 1000 }).pipe(map((page) => page.data));
  }
}
