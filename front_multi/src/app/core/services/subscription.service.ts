import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SubscriptionPlan {
  id: number;
  name: string;
  duration_months: number;
  price: number;
  features: string[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Subscription {
  id: number;
  tenant_id: number;
  plan_id: number;
  start_date: string;
  end_date: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED';
  auto_renew: boolean;
  tenant?: {
    id: number;
    name: string;
    domain: string;
  };
  plan?: SubscriptionPlan;
  payments?: SubscriptionPayment[];
  created_at?: string;
  updated_at?: string;
}

export interface SubscriptionPayment {
  id: number;
  subscription_id: number;
  amount: number;
  payment_method: string;
  reference: string;
  payment_date: string;
  subscription?: Subscription;
  created_at?: string;
  updated_at?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Subscription Plans
  getSubscriptionPlans(): Observable<ApiResponse<SubscriptionPlan[]>> {
    return this.http.get<ApiResponse<SubscriptionPlan[]>>(`${this.API_URL}/subscription-plans-public`);
  }

  getSubscriptionPlan(id: number): Observable<ApiResponse<SubscriptionPlan>> {
    return this.http.get<ApiResponse<SubscriptionPlan>>(`${this.API_URL}/subscription-plans/${id}`);
  }

  createSubscriptionPlan(plan: Partial<SubscriptionPlan>): Observable<ApiResponse<SubscriptionPlan>> {
    return this.http.post<ApiResponse<SubscriptionPlan>>(`${this.API_URL}/subscription-plans`, plan);
  }

  updateSubscriptionPlan(id: number, plan: Partial<SubscriptionPlan>): Observable<ApiResponse<SubscriptionPlan>> {
    return this.http.put<ApiResponse<SubscriptionPlan>>(`${this.API_URL}/subscription-plans/${id}`, plan);
  }

  deleteSubscriptionPlan(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API_URL}/subscription-plans/${id}`);
  }

  // Subscriptions
  getSubscriptions(tenantId?: number): Observable<ApiResponse<Subscription[]>> {
    const url = tenantId ? `${this.API_URL}/subscriptions-public?tenant_id=${tenantId}` : `${this.API_URL}/subscriptions-public`;
    return this.http.get<ApiResponse<Subscription[]>>(url);
  }

  getSubscription(id: number): Observable<ApiResponse<Subscription>> {
    return this.http.get<ApiResponse<Subscription>>(`${this.API_URL}/subscriptions/${id}`);
  }

  createSubscription(subscription: Partial<Subscription>): Observable<ApiResponse<Subscription>> {
    return this.http.post<ApiResponse<Subscription>>(`${this.API_URL}/subscriptions`, subscription);
  }

  updateSubscription(id: number, subscription: Partial<Subscription>): Observable<ApiResponse<Subscription>> {
    return this.http.put<ApiResponse<Subscription>>(`${this.API_URL}/subscriptions/${id}`, subscription);
  }

  deleteSubscription(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API_URL}/subscriptions/${id}`);
  }

  // Subscription Payments
  getSubscriptionPayments(): Observable<ApiResponse<SubscriptionPayment[]>> {
    return this.http.get<ApiResponse<SubscriptionPayment[]>>(`${this.API_URL}/subscription-payments`);
  }

  getSubscriptionPayment(id: number): Observable<ApiResponse<SubscriptionPayment>> {
    return this.http.get<ApiResponse<SubscriptionPayment>>(`${this.API_URL}/subscription-payments/${id}`);
  }

  createSubscriptionPayment(payment: Partial<SubscriptionPayment>): Observable<ApiResponse<SubscriptionPayment>> {
    return this.http.post<ApiResponse<SubscriptionPayment>>(`${this.API_URL}/subscription-payments`, payment);
  }

  updateSubscriptionPayment(id: number, payment: Partial<SubscriptionPayment>): Observable<ApiResponse<SubscriptionPayment>> {
    return this.http.put<ApiResponse<SubscriptionPayment>>(`${this.API_URL}/subscription-payments/${id}`, payment);
  }

  deleteSubscriptionPayment(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API_URL}/subscription-payments/${id}`);
  }

  // Utility methods
  getActiveSubscriptions(): Observable<ApiResponse<Subscription[]>> {
    return this.http.get<ApiResponse<Subscription[]>>(`${this.API_URL}/subscriptions?status=ACTIVE`);
  }

  getExpiredSubscriptions(): Observable<ApiResponse<Subscription[]>> {
    return this.http.get<ApiResponse<Subscription[]>>(`${this.API_URL}/subscriptions?status=EXPIRED`);
  }

  renewSubscription(id: number): Observable<ApiResponse<Subscription>> {
    return this.http.post<ApiResponse<Subscription>>(`${this.API_URL}/subscriptions/${id}/renew`, {});
  }

  cancelSubscription(id: number): Observable<ApiResponse<Subscription>> {
    return this.http.post<ApiResponse<Subscription>>(`${this.API_URL}/subscriptions/${id}/cancel`, {});
  }
}
