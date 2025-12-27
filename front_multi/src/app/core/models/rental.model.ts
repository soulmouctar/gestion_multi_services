export interface Location {
  id: string;
  tenantId: string;
  name: string;
  address?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  buildings?: Building[];
}

export interface Building {
  id: string;
  tenantId: string;
  locationId: string;
  name: string;
  type: 'R+1' | 'R+2' | 'R+3' | 'R+4' | 'R+5' | 'ANNEXE';
  totalFloors: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  location?: Location;
  floors?: Floor[];
}

export interface Floor {
  id: string;
  tenantId: string;
  buildingId: string;
  floorNumber: number;
  totalUnits: number;
  createdAt: Date;
  updatedAt: Date;
  building?: Building;
  housingUnits?: HousingUnit[];
}

export interface UnitConfiguration {
  id: string;
  name: string;
  bedrooms: number;
  livingRooms: number;
  bathrooms: number;
  hasTerrace: boolean;
  hasKitchen: boolean;
  surfaceArea?: number;
  description?: string;
}

export interface HousingUnit {
  id: string;
  tenantId: string;
  floorId: string;
  unitConfigurationId: string;
  unitNumber: string;
  rentAmount: number;
  currency: 'USD' | 'GNF';
  cautionAmount: number;
  status: 'FREE' | 'OCCUPIED' | 'MAINTENANCE';
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  floor?: Floor;
  configuration?: UnitConfiguration;
  currentTenant?: Tenant;
  rentalContracts?: RentalContract[];
  rentalPayments?: RentalPayment[];
}

export interface Tenant {
  id: string;
  tenantId: string; // Multi-tenant reference
  name: string;
  phone1: string;
  phone2?: string;
  email?: string;
  idNumber?: string;
  idType?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  contracts?: RentalContract[];
  payments?: RentalPayment[];
}

export interface RentalContract {
  id: string;
  tenantId: string;
  housingUnitId: string;
  clientId: string;
  startDate: Date;
  endDate?: Date;
  rentAmount: number;
  currency: 'USD' | 'GNF';
  cautionAmount: number;
  paymentFrequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  status: 'ACTIVE' | 'EXPIRED' | 'TERMINATED';
  terms?: string;
  createdAt: Date;
  updatedAt: Date;
  housingUnit?: HousingUnit;
  client?: Tenant;
  payments?: RentalPayment[];
}

export interface RentalPayment {
  id: string;
  tenantId: string;
  contractId: string;
  clientId: string;
  amount: number;
  currency: 'USD' | 'GNF';
  paymentDate: Date;
  paymentMethod: 'ORANGE_MONEY' | 'VIREMENT' | 'CHEQUE' | 'ESPECES';
  reference: string;
  paymentType: 'RENT' | 'CAUTION' | 'ADVANCE';
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
  notes?: string;
  proof?: string;
  createdAt: Date;
  contract?: RentalContract;
  client?: Tenant;
}

export interface PropertyOwner {
  id: string;
  tenantId: string;
  name: string;
  phone1: string;
  phone2?: string;
  email?: string;
  address?: string;
  bankAccount?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  buildings?: Building[];
  ownerPayments?: OwnerPayment[];
}

export interface OwnerPayment {
  id: string;
  tenantId: string;
  ownerId: string;
  amount: number;
  currency: 'USD' | 'GNF';
  paymentDate: Date;
  paymentMethod: 'ORANGE_MONEY' | 'VIREMENT' | 'CHEQUE' | 'ESPECES';
  reference: string;
  paymentType: 'RENTAL_INCOME' | 'ADVANCE' | 'INTEREST';
  notes?: string;
  createdAt: Date;
  owner?: PropertyOwner;
}

export interface RentalReport {
  tenantId: string;
  propertyId?: string;
  year: number;
  month?: number;
  totalUnits: number;
  occupiedUnits: number;
  freeUnits: number;
  totalRentExpected: number;
  totalRentCollected: number;
  outstandingAmount: number;
  occupancyRate: number;
  currency: 'USD' | 'GNF';
}
