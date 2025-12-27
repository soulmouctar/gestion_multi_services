export interface Container {
  id: string;
  tenantId: string;
  containerNumber: string;
  capacityMin: number;
  capacityMax: number;
  interestRate: number; // Percentage
  currency: 'USD' | 'GNF';
  purchasePriceUSD: number;
  purchasePriceGNF: number;
  sellingPriceUSD?: number;
  sellingPriceGNF?: number;
  arrivalDate: Date;
  status: 'PENDING' | 'IN_TRANSIT' | 'ARRIVED' | 'DISPATCHED' | 'SOLD' | 'PARTIALLY_SOLD';
  supplierId: string;
  photos: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  supplier?: Supplier;
  dispatches?: ContainerDispatch[];
  sales?: ContainerSale[];
  interestCalculations?: ContainerInterest[];
}

export interface ContainerPhoto {
  id: string;
  containerId: string;
  imagePath: string;
  description?: string;
  createdAt: Date;
}

export interface ContainerDispatch {
  id: string;
  tenantId: string;
  containerId: string;
  clientId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: 'USD' | 'GNF';
  dispatchDate: Date;
  notes?: string;
  createdAt: Date;
  container?: Container;
  client?: Client;
}

export interface ContainerSale {
  id: string;
  tenantId: string;
  containerId: string;
  clientId?: string; // null if sold to multiple clients
  saleType: 'WHOLE' | 'PARTIAL';
  totalAmount: number;
  currency: 'USD' | 'GNF';
  saleDate: Date;
  notes?: string;
  createdAt: Date;
  container?: Container;
  client?: Client;
  dispatches?: ContainerDispatch[];
}

export interface ContainerInterest {
  id: string;
  tenantId: string;
  containerId: string;
  clientId?: string;
  principalAmount: number;
  interestRate: number;
  interestAmount: number;
  totalAmount: number;
  currency: 'USD' | 'GNF';
  calculationDate: Date;
  fromDate: Date;
  toDate: Date;
  isApplied: boolean;
  createdAt: Date;
  container?: Container;
  client?: Client;
}

export interface ContainerDispatchRequest {
  containerId: string;
  clientId: string;
  quantity: number;
  unitPrice: number;
  currency: 'USD' | 'GNF';
  notes?: string;
}

// Reuse types from other models
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
}

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
}
