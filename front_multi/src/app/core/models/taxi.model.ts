export interface Driver {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  phone2?: string;
  address?: string;
  licenseNumber: string;
  licenseExpiry: Date;
  idNumber?: string;
  idType?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  contractEndDate: Date;
  dailyTarget: number;
  currency: 'USD' | 'GNF';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  assignments?: TaxiAssignment[];
  payments?: TaxiPayment[];
}

export interface Taxi {
  id: string;
  tenantId: string;
  plateNumber: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  chassisNumber?: string;
  engineNumber?: string;
  insuranceNumber?: string;
  insuranceExpiry?: Date;
  technicalInspectionExpiry?: Date;
  purchaseDate?: Date;
  purchasePrice?: number;
  dailyRate: number;
  currency: 'USD' | 'GNF';
  status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE' | 'SOLD';
  photos: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  assignments?: TaxiAssignment[];
  payments?: TaxiPayment[];
}

export interface TaxiAssignment {
  id: string;
  tenantId: string;
  taxiId: string;
  driverId: string;
  startDate: Date;
  endDate?: Date;
  dailyTarget: number;
  currency: 'USD' | 'GNF';
  status: 'ACTIVE' | 'TERMINATED' | 'SUSPENDED';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  taxi?: Taxi;
  driver?: Driver;
  payments?: TaxiPayment[];
}

export interface TaxiPayment {
  id: string;
  tenantId: string;
  assignmentId: string;
  taxiId: string;
  driverId: string;
  amountDue: number;
  amountPaid: number;
  remainingAmount: number;
  currency: 'USD' | 'GNF';
  paymentDate: Date;
  paymentMethod: 'ORANGE_MONEY' | 'VIREMENT' | 'CHEQUE' | 'ESPECES';
  receiptNumber: string;
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
  notes?: string;
  proof?: string;
  createdAt: Date;
  assignment?: TaxiAssignment;
  taxi?: Taxi;
  driver?: Driver;
}

export interface TaxiReport {
  id: string;
  tenantId: string;
  taxiId: string;
  driverId?: string;
  reportPeriod: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  reportDate: Date;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  daysWorked: number;
  dailyAverage: number;
  currency: 'USD' | 'GNF';
  createdAt: Date;
  taxi?: Taxi;
  driver?: Driver;
}

export interface DriverFinancialSummary {
  driverId: string;
  driverName: string;
  assignmentId?: string;
  totalTarget: number;
  totalPaid: number;
  outstandingAmount: number;
  daysWorked: number;
  lastPaymentDate?: Date;
  currency: 'USD' | 'GNF';
}
