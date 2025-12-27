import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { FinancialAccount, Transaction, Expense, ApiResponse, PaginatedResponse, FilterOptions } from '../models';

@Injectable({
  providedIn: 'root'
})
export class FinanceService {
  private accounts = new BehaviorSubject<FinancialAccount[]>([]);
  private transactions = new BehaviorSubject<Transaction[]>([]);
  private expenses = new BehaviorSubject<Expense[]>([]);
  
  accounts$ = this.accounts.asObservable();
  transactions$ = this.transactions.asObservable();
  expenses$ = this.expenses.asObservable();
  
  constructor(private apiService: ApiService) {}
  
  // Financial Accounts Management
  getAccounts(options?: FilterOptions): Observable<PaginatedResponse<FinancialAccount>> {
    return this.apiService.getPaginated<FinancialAccount>('financial-accounts', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.accounts.next(response.data);
        }
      })
    );
  }
  
  createAccount(accountData: Partial<FinancialAccount>): Observable<ApiResponse<FinancialAccount>> {
    return this.apiService.post<FinancialAccount>('financial-accounts', accountData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentAccounts = this.accounts.value;
          this.accounts.next([...currentAccounts, response.data]);
        }
      })
    );
  }
  
  updateAccount(id: string, accountData: Partial<FinancialAccount>): Observable<ApiResponse<FinancialAccount>> {
    return this.apiService.put<FinancialAccount>(`financial-accounts/${id}`, accountData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentAccounts = this.accounts.value;
          const updatedAccounts = currentAccounts.map(acc => 
            acc.id === id ? response.data! : acc
          );
          this.accounts.next(updatedAccounts);
        }
      })
    );
  }
  
  deleteAccount(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`financial-accounts/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentAccounts = this.accounts.value;
          const filteredAccounts = currentAccounts.filter(acc => acc.id !== id);
          this.accounts.next(filteredAccounts);
        }
      })
    );
  }
  
  // Transactions Management
  getTransactions(options?: FilterOptions): Observable<PaginatedResponse<Transaction>> {
    return this.apiService.getPaginated<Transaction>('transactions', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.transactions.next(response.data);
        }
      })
    );
  }
  
  createTransaction(transactionData: Partial<Transaction>): Observable<ApiResponse<Transaction>> {
    return this.apiService.post<Transaction>('transactions', transactionData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentTransactions = this.transactions.value;
          this.transactions.next([response.data, ...currentTransactions]);
        }
      })
    );
  }
  
  updateTransaction(id: string, transactionData: Partial<Transaction>): Observable<ApiResponse<Transaction>> {
    return this.apiService.put<Transaction>(`transactions/${id}`, transactionData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentTransactions = this.transactions.value;
          const updatedTransactions = currentTransactions.map(trans => 
            trans.id === id ? response.data! : trans
          );
          this.transactions.next(updatedTransactions);
        }
      })
    );
  }
  
  deleteTransaction(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`transactions/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentTransactions = this.transactions.value;
          const filteredTransactions = currentTransactions.filter(trans => trans.id !== id);
          this.transactions.next(filteredTransactions);
        }
      })
    );
  }
  
  // Expenses Management
  getExpenses(options?: FilterOptions): Observable<PaginatedResponse<Expense>> {
    return this.apiService.getPaginated<Expense>('expenses', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.expenses.next(response.data);
        }
      })
    );
  }
  
  createExpense(expenseData: Partial<Expense>): Observable<ApiResponse<Expense>> {
    return this.apiService.post<Expense>('expenses', expenseData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentExpenses = this.expenses.value;
          this.expenses.next([response.data, ...currentExpenses]);
        }
      })
    );
  }
  
  updateExpense(id: string, expenseData: Partial<Expense>): Observable<ApiResponse<Expense>> {
    return this.apiService.put<Expense>(`expenses/${id}`, expenseData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentExpenses = this.expenses.value;
          const updatedExpenses = currentExpenses.map(exp => 
            exp.id === id ? response.data! : exp
          );
          this.expenses.next(updatedExpenses);
        }
      })
    );
  }
  
  deleteExpense(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`expenses/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentExpenses = this.expenses.value;
          const filteredExpenses = currentExpenses.filter(exp => exp.id !== id);
          this.expenses.next(filteredExpenses);
        }
      })
    );
  }
  
  // Financial Summary
  getFinancialSummary(): Observable<ApiResponse<{
    totalBalance: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalExpenses: number;
    accountBalances: Array<{ accountId: string; balance: number; currency: string }>;
  }>> {
    return this.apiService.get('finance/summary');
  }
  
  // Account Balance
  getAccountBalance(accountId: string): Observable<ApiResponse<{ balance: number }>> {
    return this.apiService.get(`financial-accounts/${accountId}/balance`);
  }
  
  // Transaction Reports
  getTransactionReport(filters: {
    accountId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    type?: 'DEPOSIT' | 'WITHDRAWAL';
  }): Observable<Blob> {
    return this.apiService.downloadFile('finance/transactions/report', filters);
  }
}
