export interface FinancialAccount {
  id: string;
  tenantId: string;
  name: string;
  type: 'BCRG' | 'ECOBANK' | 'ORANGE_MONEY' | 'ESPECES';
  currency: 'USD' | 'GNF';
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  tenantId: string;
  accountId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  origin: 'PERSONAL' | 'CLIENT' | 'SUPPLIER' | 'FAMILY';
  amount: number;
  currency: 'USD' | 'GNF';
  exchangeRate?: number;
  proof?: string;
  comment?: string;
  transactionDate: Date;
  createdAt: Date;
  account?: FinancialAccount;
}

export interface Expense {
  id: string;
  tenantId: string;
  type: 'PERSONAL' | 'BUSINESS' | 'TRANSPORT' | 'HANDLING' | 'OTHER';
  description: string;
  amount: number;
  currency: 'USD' | 'GNF';
  exchangeRate?: number;
  accountId: string;
  paidBy: string;
  expenseDate: Date;
  createdAt: Date;
  account?: FinancialAccount;
}

export interface Currency {
  id: string;
  code: string;
  name: string;
}

export interface ExchangeRate {
  id: string;
  currencyId: string;
  rate: number;
  rateDate: Date;
  currency?: Currency;
}
