import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { 
  StatisticsOverview,
  CommercialStatistics,
  FinancialStatistics,
  RentalStatistics,
  TaxiStatistics,
  DashboardWidget,
  ApiResponse 
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class StatisticsService {
  constructor(private apiService: ApiService) {}
  
  // Overview Statistics
  getOverviewStatistics(filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    period?: 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
  }): Observable<ApiResponse<StatisticsOverview>> {
    return this.apiService.get('statistics/overview', { params: filters });
  }
  
  // Commercial Statistics
  getCommercialStatistics(filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    clientId?: string;
    supplierId?: string;
  }): Observable<ApiResponse<CommercialStatistics>> {
    return this.apiService.get('statistics/commercial', { params: filters });
  }
  
  // Financial Statistics
  getFinancialStatistics(filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    accountId?: string;
    currency?: 'USD' | 'GNF';
  }): Observable<ApiResponse<FinancialStatistics>> {
    return this.apiService.get('statistics/financial', { params: filters });
  }
  
  // Rental Statistics
  getRentalStatistics(filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    locationId?: string;
    buildingId?: string;
  }): Observable<ApiResponse<RentalStatistics>> {
    return this.apiService.get('statistics/rental', { params: filters });
  }
  
  // Taxi Statistics
  getTaxiStatistics(filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    driverId?: string;
    taxiId?: string;
  }): Observable<ApiResponse<TaxiStatistics>> {
    return this.apiService.get('statistics/taxi', { params: filters });
  }
  
  // Dashboard Widgets
  getDashboardWidgets(): Observable<ApiResponse<DashboardWidget[]>> {
    return this.apiService.get('statistics/dashboard-widgets');
  }
  
  updateDashboardWidget(widgetId: string, widgetData: Partial<DashboardWidget>): Observable<ApiResponse<DashboardWidget>> {
    return this.apiService.put(`statistics/dashboard-widgets/${widgetId}`, widgetData);
  }
  
  // Reports Generation
  generateComprehensiveReport(filters: {
    dateFrom: Date;
    dateTo: Date;
    includeFinancial?: boolean;
    includeCommercial?: boolean;
    includeRental?: boolean;
    includeTaxi?: boolean;
    format?: 'PDF' | 'EXCEL' | 'CSV';
  }): Observable<Blob> {
    return this.apiService.downloadFile('statistics/comprehensive-report', filters as any);
  }
  
  // Time Series Data
  getRevenueTrends(period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY', filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    module?: 'ALL' | 'COMMERCIAL' | 'FINANCE' | 'RENTAL' | 'TAXI';
  }): Observable<ApiResponse<Array<{
    date: string;
    revenue: number;
    expenses: number;
    profit: number;
  }>>> {
    return this.apiService.get('statistics/revenue-trends', { 
      params: { period, ...filters } 
    });
  }
  
  getExpenseTrends(period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY', filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    category?: string;
  }): Observable<ApiResponse<Array<{
    date: string;
    amount: number;
    category: string;
  }>>> {
    return this.apiService.get('statistics/expense-trends', { 
      params: { period, ...filters } 
    });
  }
  
  // Performance Metrics
  getTopPerformers(type: 'CLIENTS' | 'SUPPLIERS' | 'PRODUCTS' | 'DRIVERS', limit?: number): Observable<ApiResponse<Array<{
    id: string;
    name: string;
    value: number;
    metric: string;
    details?: any;
  }>>> {
    return this.apiService.get('statistics/top-performers', { 
      params: { type, limit } 
    });
  }
  
  // Growth Metrics
  getGrowthMetrics(period: 'MONTH' | 'QUARTER' | 'YEAR'): Observable<ApiResponse<{
    revenueGrowth: number;
    expenseGrowth: number;
    profitGrowth: number;
    clientGrowth: number;
    supplierGrowth: number;
    userGrowth: number;
    period: string;
  }>> {
    return this.apiService.get('statistics/growth-metrics', { params: { period } });
  }
  
  // Comparative Analysis
  getComparativeAnalysis(currentPeriod: {
    dateFrom: Date;
    dateTo: Date;
  }, previousPeriod: {
    dateFrom: Date;
    dateTo: Date;
  }): Observable<ApiResponse<{
    current: {
      revenue: number;
      expenses: number;
      profit: number;
      clients: number;
      transactions: number;
    };
    previous: {
      revenue: number;
      expenses: number;
      profit: number;
      clients: number;
      transactions: number;
    };
    changes: {
      revenueChange: number;
      expenseChange: number;
      profitChange: number;
      clientChange: number;
      transactionChange: number;
    };
  }>> {
    return this.apiService.post('statistics/comparative-analysis', {
      currentPeriod,
      previousPeriod
    });
  }
  
  // KPI Tracking
  getKPIs(): Observable<ApiResponse<Array<{
    id: string;
    name: string;
    currentValue: number;
    targetValue: number;
    unit: string;
    trend: 'UP' | 'DOWN' | 'STABLE';
    percentage: number;
    category: 'FINANCIAL' | 'COMMERCIAL' | 'OPERATIONAL' | 'CUSTOMER';
    lastUpdated: Date;
  }>>> {
    return this.apiService.get('statistics/kpis');
  }
  
  updateKPI(kpiId: string, kpiData: {
    targetValue: number;
    unit?: string;
    category?: string;
  }): Observable<ApiResponse<any>> {
    return this.apiService.put(`statistics/kpis/${kpiId}`, kpiData);
  }
  
  // Predictive Analytics
  getRevenueForecast(period: 'MONTH' | 'QUARTER' | 'YEAR', months?: number): Observable<ApiResponse<Array<{
    period: string;
    forecast: number;
    confidence: number;
    factors: Array<{ factor: string; impact: number }>;
  }>>> {
    return this.apiService.get('statistics/revenue-forecast', { 
      params: { period, months } 
    });
  }
  
  getExpenseForecast(period: 'MONTH' | 'QUARTER' | 'YEAR', months?: number): Observable<ApiResponse<Array<{
    period: string;
    forecast: number;
    confidence: number;
    category: string;
  }>>> {
    return this.apiService.get('statistics/expense-forecast', { 
      params: { period, months } 
    });
  }
  
  // Alerts and Insights
  getInsights(): Observable<ApiResponse<Array<{
    id: string;
    type: 'OPPORTUNITY' | 'RISK' | 'TREND' | 'ANOMALY';
    title: string;
    description: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    actionable: boolean;
    suggestedActions?: string[];
    relatedData?: any;
    createdAt: Date;
  }>>> {
    return this.apiService.get('statistics/insights');
  }
  
  getAlerts(): Observable<ApiResponse<Array<{
    id: string;
    type: 'THRESHOLD' | 'ANOMALY' | 'TREND' | 'PERFORMANCE';
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    title: string;
    message: string;
    metric: string;
    currentValue: number;
    threshold: number;
    createdAt: Date;
    acknowledged: boolean;
  }>>> {
    return this.apiService.get('statistics/alerts');
  }
  
  acknowledgeAlert(alertId: string): Observable<ApiResponse<any>> {
    return this.apiService.post(`statistics/alerts/${alertId}/acknowledge`, {});
  }
  
  // Custom Reports
  createCustomReport(reportData: {
    name: string;
    description: string;
    metrics: string[];
    filters: any;
    schedule?: {
      frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      recipients: string[];
    };
  }): Observable<ApiResponse<any>> {
    return this.apiService.post('statistics/custom-reports', reportData);
  }
  
  getCustomReports(): Observable<ApiResponse<Array<{
    id: string;
    name: string;
    description: string;
    metrics: string[];
    filters: any;
    schedule?: any;
    createdAt: Date;
    lastRun?: Date;
  }>>> {
    return this.apiService.get('statistics/custom-reports');
  }
  
  runCustomReport(reportId: string, filters?: any): Observable<Blob> {
    return this.apiService.downloadFile(`statistics/custom-reports/${reportId}/run`, filters);
  }
  
  // Data Export
  exportData(dataType: 'FINANCIAL' | 'COMMERCIAL' | 'RENTAL' | 'TAXI' | 'ALL', format: 'CSV' | 'EXCEL' | 'JSON', filters?: any): Observable<Blob> {
    return this.apiService.downloadFile('statistics/export', {
      dataType,
      format,
      ...filters
    });
  }
  
  // Real-time Statistics
  getRealTimeStats(): Observable<ApiResponse<{
    activeUsers: number;
    onlineTransactions: number;
    todayRevenue: number;
    todayExpenses: number;
    systemLoad: number;
    recentActivities: Array<{
      type: string;
      description: string;
      timestamp: Date;
      user: string;
    }>;
  }>> {
    return this.apiService.get('statistics/real-time');
  }
  
  // Benchmarking
  getBenchmarkData(industry: string, metrics: string[]): Observable<ApiResponse<Array<{
    metric: string;
    industryAverage: number;
    topQuartile: number;
    yourValue: number;
    percentile: number;
  }>>> {
    return this.apiService.get('statistics/benchmarking', {
      params: { industry, metrics: metrics.join(',') }
    });
  }
}
