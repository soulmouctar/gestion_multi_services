import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, catchError, throwError } from 'rxjs';
import { Currency, ExchangeRate, ApiResponse } from '../models';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private readonly API_URL = 'http://localhost:8000/api';
  
  // Current exchange rates
  private exchangeRates = new BehaviorSubject<Map<string, number>>(new Map());
  exchangeRates$ = this.exchangeRates.asObservable();
  
  // Last update time
  private lastUpdate = new BehaviorSubject<Date | null>(null);
  lastUpdate$ = this.lastUpdate.asObservable();
  
  // Default currencies
  readonly SUPPORTED_CURRENCIES: Currency[] = [
    { id: '1', code: 'USD', name: 'US Dollar' },
    { id: '2', code: 'GNF', name: 'Guinean Franc' }
  ];
  
  readonly DEFAULT_CURRENCY = 'USD';
  readonly LOCAL_CURRENCY = 'GNF';
  
  constructor(private http: HttpClient) {
    this.loadExchangeRates();
  }
  
  // Load exchange rates from API
  loadExchangeRates(): void {
    this.getExchangeRates().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.updateExchangeRates(response.data);
        }
      },
      error: (error) => {
        console.error('Failed to load exchange rates:', error);
        // Set default rates if API fails
        this.setDefaultRates();
      }
    });
  }
  
  // Get exchange rates from API
  getExchangeRates(): Observable<ApiResponse<ExchangeRate[]>> {
    return this.http.get<ApiResponse<ExchangeRate[]>>(`${this.API_URL}/exchange-rates`).pipe(
      catchError(error => this.handleError(error))
    );
  }
  
  // Update exchange rate
  updateExchangeRate(currencyCode: string, rate: number): Observable<ApiResponse<ExchangeRate>> {
    return this.http.post<ApiResponse<ExchangeRate>>(`${this.API_URL}/exchange-rates`, {
      currencyCode,
      rate,
      rateDate: new Date()
    }).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.updateSingleRate(response.data);
        }
      }),
      catchError(error => this.handleError(error))
    );
  }
  
  // Convert amount from one currency to another
  convert(amount: number, fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) {
      return amount;
    }
    
    const rates = this.exchangeRates.value;
    const fromRate = rates.get(fromCurrency) || 1;
    const toRate = rates.get(toCurrency) || 1;
    
    // Convert to base currency (USD) first, then to target currency
    const amountInUSD = fromCurrency === 'USD' ? amount : amount / fromRate;
    const result = toCurrency === 'USD' ? amountInUSD : amountInUSD * toRate;
    
    return Math.round(result * 100) / 100; // Round to 2 decimal places
  }
  
  // Format amount with currency symbol
  formatAmount(amount: number, currency: string): string {
    const formatted = this.formatNumber(amount, currency);
    return `${formatted} ${currency}`;
  }
  
  // Format number based on currency
  formatNumber(amount: number, currency: string): string {
    if (currency === 'GNF') {
      // GNF doesn't use decimal places
      return Math.round(amount).toLocaleString('fr-FR');
    } else {
      // USD uses 2 decimal places
      return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }
  }
  
  // Get current rate for a currency
  getExchangeRate(currencyCode: string): number {
    return this.exchangeRates.value.get(currencyCode) || 1;
  }
  
  // Check if exchange rates are recent (less than 24 hours old)
  areRatesRecent(): boolean {
    const lastUpdate = this.lastUpdate.value;
    if (!lastUpdate) return false;
    
    const now = new Date();
    const hoursDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    return hoursDiff < 24;
  }
  
  // Calculate exchange rate difference
  calculateRateDifference(oldRate: number, newRate: number): number {
    return ((newRate - oldRate) / oldRate) * 100;
  }
  
  // Get currency symbol
  getCurrencySymbol(currencyCode: string): string {
    const symbols: Record<string, string> = {
      'USD': '$',
      'GNF': 'GNF'
    };
    return symbols[currencyCode] || currencyCode;
  }
  
  // Validate amount for currency
  validateAmount(amount: number, currency: string): boolean {
    if (currency === 'GNF') {
      // GNF should be whole numbers
      return Number.isInteger(amount) && amount > 0;
    } else {
      // USD can have decimals
      return amount > 0;
    }
  }
  
  // Round amount based on currency rules
  roundAmount(amount: number, currency: string): number {
    if (currency === 'GNF') {
      return Math.round(amount);
    } else {
      return Math.round(amount * 100) / 100;
    }
  }
  
  // Calculate dual currency display
  getDualCurrencyDisplay(amountUSD: number, amountGNF: number): {
    primary: { amount: number; currency: string; formatted: string };
    secondary: { amount: number; currency: string; formatted: string };
  } {
    return {
      primary: {
        amount: amountUSD,
        currency: 'USD',
        formatted: this.formatAmount(amountUSD, 'USD')
      },
      secondary: {
        amount: amountGNF,
        currency: 'GNF',
        formatted: this.formatAmount(amountGNF, 'GNF')
      }
    };
  }
  
  // Private methods
  private updateExchangeRates(rates: ExchangeRate[]): void {
    const rateMap = new Map<string, number>();
    
    rates.forEach(rate => {
      if (rate.currency?.code) {
        rateMap.set(rate.currency.code, rate.rate);
      }
    });
    
    this.exchangeRates.next(rateMap);
    this.lastUpdate.next(new Date());
  }
  
  private updateSingleRate(rate: ExchangeRate): void {
    const currentRates = this.exchangeRates.value;
    if (rate.currency?.code) {
      currentRates.set(rate.currency.code, rate.rate);
      this.exchangeRates.next(new Map(currentRates));
    }
  }
  
  private setDefaultRates(): void {
    const defaultRates = new Map<string, number>();
    defaultRates.set('USD', 1); // Base currency
    defaultRates.set('GNF', 8500); // Typical USD to GNF rate
    
    this.exchangeRates.next(defaultRates);
    this.lastUpdate.next(new Date());
  }
  
  private handleError(error: any): Observable<never> {
    let errorMessage = 'Currency service error';
    
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return throwError(() => new Error(errorMessage));
  }
}

// Utility class for currency calculations
export class CurrencyCalculator {
  static convertToGNF(amountUSD: number, exchangeRate: number): number {
    return Math.round(amountUSD * exchangeRate);
  }
  
  static convertToUSD(amountGNF: number, exchangeRate: number): number {
    return Math.round((amountGNF / exchangeRate) * 100) / 100;
  }
  
  static calculateInterest(
    principal: number,
    rate: number,
    days: number,
    currency: 'USD' | 'GNF'
  ): number {
    // Simple interest calculation: (Principal * Rate * Days) / 365
    const interest = (principal * rate * days) / 36500; // Rate is percentage, so divide by 100
    return currency === 'GNF' ? Math.round(interest) : Math.round(interest * 100) / 100;
  }
  
  static calculateLateFee(
    amount: number,
    lateDays: number,
    dailyRate: number,
    currency: 'USD' | 'GNF'
  ): number {
    const fee = amount * (dailyRate * lateDays) / 100;
    return currency === 'GNF' ? Math.round(fee) : Math.round(fee * 100) / 100;
  }
}
