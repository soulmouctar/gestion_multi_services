export interface StatisticsOverview {
  tenantId: string;
  period: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  date: Date;
  
  // Commercial
  totalRevenueUSD: number;
  totalRevenueGNF: number;
  totalContainers: number;
  containersSold: number;
  containersInTransit: number;
  totalProducts: number;
  
  // Finance
  totalBankBalance: number;
  totalOrangeMoneyBalance: number;
  totalCashBalance: number;
  totalExpenses: number;
  totalDeposits: number;
  totalWithdrawals: number;
  
  // Clients & Suppliers
  totalClients: number;
  activeClients: number;
  totalSuppliers: number;
  clientBalanceUSD: number;
  clientBalanceGNF: number;
  supplierBalanceUSD: number;
  supplierBalanceGNF: number;
  
  // Rental
  totalProperties: number;
  occupiedProperties: number;
  totalRentExpected: number;
  totalRentCollected: number;
  occupancyRate: number;
  
  // Taxi
  totalTaxis: number;
  activeTaxis: number;
  totalDrivers: number;
  taxiRevenue: number;
  taxiExpenses: number;
}

export interface CommercialStatistics {
  tenantId: string;
  period: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  date: Date;
  
  // Container stats
  containersByStatus: Record<string, number>;
  containerRevenue: number;
  containerProfit: number;
  averageContainerSalePrice: number;
  
  // Product stats
  topSellingProducts: ProductSales[];
  productRevenueByCategory: Record<string, number>;
  stockValue: number;
  
  // Client stats
  newClients: number;
  clientRetentionRate: number;
  averageClientValue: number;
}

export interface ProductSales {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
  profit: number;
}

export interface FinancialStatistics {
  tenantId: string;
  period: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  date: Date;
  
  // Account balances
  accountBalances: AccountBalance[];
  
  // Transaction summary
  depositsByMethod: Record<string, number>;
  withdrawalsByMethod: Record<string, number>;
  
  // Expense breakdown
  expensesByCategory: Record<string, number>;
  
  // Cash flow
  openingBalance: number;
  closingBalance: number;
  netCashFlow: number;
  
  // Exchange rates impact
  currencyFluctuationImpact: number;
}

export interface AccountBalance {
  accountId: string;
  accountName: string;
  accountType: string;
  balance: number;
  currency: 'USD' | 'GNF';
}

export interface RentalStatistics {
  tenantId: string;
  period: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  date: Date;
  
  // Property stats
  propertiesByType: Record<string, number>;
  propertiesByStatus: Record<string, number>;
  
  // Revenue stats
  rentCollected: number;
  outstandingRent: number;
  collectionRate: number;
  
  // Tenant stats
  newTenants: number;
  tenantTurnover: number;
  averageTenancyDuration: number;
  
  // Occupancy trends
  occupancyByMonth: OccupancyTrend[];
}

export interface OccupancyTrend {
  month: string;
  occupancyRate: number;
  totalProperties: number;
  occupiedProperties: number;
}

export interface TaxiStatistics {
  tenantId: string;
  period: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  date: Date;
  
  // Fleet stats
  activeTaxis: number;
  taxisInMaintenance: number;
  fleetUtilization: number;
  
  // Revenue stats
  totalRevenue: number;
  revenuePerTaxi: number;
  revenuePerDriver: number;
  
  // Driver performance
  driverPerformance: DriverPerformance[];
  
  // Expense stats
  fuelCosts: number;
  maintenanceCosts: number;
  otherExpenses: number;
  
  // Efficiency metrics
  averageDailyRevenue: number;
  collectionRate: number;
}

export interface DriverPerformance {
  driverId: string;
  driverName: string;
  totalRevenue: number;
  daysWorked: number;
  dailyAverage: number;
  collectionRate: number;
  performanceRating: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR';
}

export interface DashboardWidget {
  id: string;
  type: 'KPI' | 'CHART' | 'TABLE' | 'LIST';
  title: string;
  size: 'SMALL' | 'MEDIUM' | 'LARGE';
  position: { x: number; y: number };
  data: any;
  config: any;
}

export interface DashboardConfig {
  tenantId: string;
  userId?: string;
  name: string;
  widgets: DashboardWidget[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
