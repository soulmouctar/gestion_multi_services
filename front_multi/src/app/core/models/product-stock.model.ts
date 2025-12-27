import { FinancialAccount } from './finance.model';
import { Container } from './container.model';

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
}

export interface Unit {
  id: string;
  name: string;
  conversionValue: number; // Base unit conversion
  description?: string;
}

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  categoryId: string;
  unitId: string;
  description?: string;
  photos: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  category?: ProductCategory;
  unit?: Unit;
  stockItems?: StockItem[];
}

export interface StockItem {
  id: string;
  tenantId: string;
  productId: string;
  containerId?: string;
  quantity: number;
  unitCost: number;
  sellingPrice: number;
  currency: 'USD' | 'GNF';
  location?: string;
  batchNumber?: string;
  expiryDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  product?: Product;
  container?: Container;
}

export interface StockMovement {
  id: string;
  tenantId: string;
  stockItemId: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string;
  reference?: string;
  movementDate: Date;
  createdAt: Date;
  stockItem?: StockItem;
}

export interface UnitConversion {
  id: string;
  fromUnitId: string;
  toUnitId: string;
  conversionFactor: number;
  fromUnit?: Unit;
  toUnit?: Unit;
}

// Conversion rules: 2 complets = 1 piece
export interface ProductConversionRule {
  id: string;
  productId: string;
  fromUnitId: string;
  toUnitId: string;
  fromQuantity: number;
  toQuantity: number;
  product?: Product;
  fromUnit?: Unit;
  toUnit?: Unit;
}
