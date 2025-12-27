export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  subscriptionStatus: 'ACTIVE' | 'SUSPENDED';
  createdAt: Date;
  updatedAt: Date;
  subscription?: Subscription;
  modules?: TenantModule[];
}

export interface User {
  id: string;
  tenant_id?: string;
  name: string;
  email: string;
  email_verified_at?: string;
  created_at: string;
  updated_at: string;
  tenant?: Tenant;
  roles?: Role[];
  permissions?: Permission[];
}

export interface Role {
  id: string;
  name: string;
  guard_name: string;
  created_at: string;
  updated_at: string;
  pivot?: {
    model_id: string;
    role_id: string;
    model_type: string;
  };
}

export interface Permission {
  id: string;
  name: string;
  guard_name: string;
  created_at: string;
  updated_at: string;
}

export interface Module {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface TenantModule {
  id: string;
  tenantId: string;
  moduleId: string;
  isActive: boolean;
  module?: Module;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  durationMonths: number;
  price: number;
  currency: 'USD' | 'GNF';
}

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  startDate: Date;
  endDate: Date;
  status: 'ACTIVE' | 'EXPIRED' | 'ILLIMITY';
  plan?: SubscriptionPlan;
  payments?: SubscriptionPayment[];
}

export interface SubscriptionPayment {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: 'USD' | 'GNF';
  paymentMethod: 'ORANGE_MONEY' | 'VIREMENT' | 'CHEQUE';
  reference: string;
  paymentDate: Date;
  proof?: string;
}

export interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  token: string | null;
}
