export interface Client {
  id: string;
  tenantId: string;
  name: string;
  phone1: string;
  phone2?: string;
  email?: string;
  address?: string;
  city?: string;
  balanceUSD: number;
  balanceGNF: number;
  totalAdvancesUSD: number;
  totalAdvancesGNF: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  invoices?: Invoice[];
  payments?: Payment[];
  advances?: Advance[];
}

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  phone1: string;
  phone2?: string;
  email?: string;
  address?: string;
  preferredCurrency: 'USD' | 'GNF' | 'MIXED';
  balanceUSD: number;
  balanceGNF: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  invoices?: Invoice[];
  payments?: Payment[];
}

export interface Invoice {
  id: string;
  tenantId: string;
  clientId?: string;
  supplierId?: string;
  invoiceNumber: string;
  type: 'CLIENT' | 'SUPPLIER';
  totalAmount: number;
  currency: 'USD' | 'GNF';
  amountPaid: number;
  remainingAmount: number;
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
  dueDate: Date;
  invoiceDate: Date;
  createdAt: Date;
  client?: Client;
  supplier?: Supplier;
  payments?: Payment[];
  lines?: InvoiceLine[];
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  currency: 'USD' | 'GNF';
}

export interface Payment {
  id: string;
  tenantId: string;
  clientId?: string;
  supplierId?: string;
  invoiceId?: string;
  amount: number;
  currency: 'USD' | 'GNF';
  paymentMethod: 'ORANGE_MONEY' | 'VIREMENT' | 'CHEQUE' | 'ESPECES';
  reference: string;
  paymentDate: Date;
  proof?: string;
  notes?: string;
  createdAt: Date;
  client?: Client;
  supplier?: Supplier;
  invoice?: Invoice;
}

export interface Advance {
  id: string;
  tenantId: string;
  clientId: string;
  amount: number;
  currency: 'USD' | 'GNF';
  paymentMethod: 'ORANGE_MONEY' | 'VIREMENT' | 'CHEQUE' | 'ESPECES';
  advanceDate: Date;
  notes?: string;
  createdAt: Date;
  client?: Client;
}

export interface Reminder {
  id: string;
  tenantId: string;
  clientId?: string;
  invoiceId?: string;
  type: 'INVOICE_OVERDUE' | 'PAYMENT_DUE';
  message: string;
  sentDate: Date;
  isSent: boolean;
  createdAt: Date;
}
