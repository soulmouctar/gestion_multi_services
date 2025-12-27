// Export all models for easy importing
export type { 
  Tenant, 
  Subscription,
  SubscriptionPlan,
  SubscriptionPayment,
  User,
  AuthState
} from './tenant.model';
export * from './finance.model';
export * from './product-stock.model';
export * from './container.model';
export * from './rental.model';
export * from './taxi.model';
export * from './statistics.model';

// Re-export client-supplier models with aliases to avoid conflicts
export type { 
  Client as ClientModel, 
  Supplier as SupplierModel,
  Invoice,
  InvoiceLine,
  Payment,
  Advance,
  Reminder
} from './client-supplier.model';

// Re-export tenant models with aliases to avoid conflicts
export type { 
  Tenant as TenantModel
} from './tenant.model';

// Common types used across modules
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface FilterOptions {
  search?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: any;
}

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

// Currency and exchange rate types
export type Currency = 'USD' | 'GNF';
export type PaymentMethod = 'ORANGE_MONEY' | 'VIREMENT' | 'CHEQUE' | 'ESPECES';
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
export type ModuleCode = 
  | 'COMMERCIAL'
  | 'FINANCE' 
  | 'CLIENTS_SUPPLIERS'
  | 'PRODUCTS_STOCK'
  | 'CONTAINERS'
  | 'RENTAL'
  | 'TAXI'
  | 'STATISTICS';

// Module permissions
export interface ModulePermission {
  code: ModuleCode;
  name: string;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface UserPermissions {
  userId: string;
  tenantId: string;
  role: UserRole;
  modules: ModulePermission[];
}
