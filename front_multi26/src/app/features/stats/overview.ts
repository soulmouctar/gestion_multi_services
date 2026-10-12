import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../core/api.service';

/** Vue d'ensemble chiffrée de l'organisation, en GNF. */
export interface Overview {
  period: { from: string; months: number };
  monthly: { month: string; sales: number; collected: number; expenses: number }[];
  totals: { sales: number; collected: number; expenses: number };
  families: { name: string; total: number }[];
  top_products: { name: string; total: number; quantity: number }[];
  top_clients: { name: string; total: number }[];
  top_debtors: { name: string; currency: string; balance: number }[];
}

@Injectable({ providedIn: 'root' })
export class OverviewApi {
  readonly #api = inject(ApiService);

  load(months: number): Observable<Overview> {
    return this.#api.get<Overview>('statistics/overview', { months });
  }
}
