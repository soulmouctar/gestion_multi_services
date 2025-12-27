import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { 
  Driver, 
  Taxi, 
  TaxiAssignment, 
  TaxiPayment, 
  TaxiReport,
  DriverFinancialSummary,
  ApiResponse, 
  PaginatedResponse, 
  FilterOptions 
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class TaxiService {
  private drivers = new BehaviorSubject<Driver[]>([]);
  private taxis = new BehaviorSubject<Taxi[]>([]);
  private assignments = new BehaviorSubject<TaxiAssignment[]>([]);
  private payments = new BehaviorSubject<TaxiPayment[]>([]);
  private reports = new BehaviorSubject<TaxiReport[]>([]);
  
  drivers$ = this.drivers.asObservable();
  taxis$ = this.taxis.asObservable();
  assignments$ = this.assignments.asObservable();
  payments$ = this.payments.asObservable();
  reports$ = this.reports.asObservable();
  
  constructor(private apiService: ApiService) {}
  
  // Driver Management
  getDrivers(options?: FilterOptions): Observable<PaginatedResponse<Driver>> {
    return this.apiService.getPaginated('taxi-drivers', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.drivers.next(response.data);
        }
      })
    );
  }
  
  createDriver(driverData: Partial<Driver>): Observable<ApiResponse<Driver>> {
    return this.apiService.post('taxi-drivers', driverData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentDrivers = this.drivers.value;
          this.drivers.next([...currentDrivers, response.data]);
        }
      })
    );
  }
  
  updateDriver(id: string, driverData: Partial<Driver>): Observable<ApiResponse<Driver>> {
    return this.apiService.put(`taxi-drivers/${id}`, driverData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentDrivers = this.drivers.value;
          const updatedDrivers = currentDrivers.map(driver => 
            driver.id === id ? response.data! : driver
          );
          this.drivers.next(updatedDrivers);
        }
      })
    );
  }
  
  deleteDriver(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`taxi-drivers/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentDrivers = this.drivers.value;
          const filteredDrivers = currentDrivers.filter(driver => driver.id !== id);
          this.drivers.next(filteredDrivers);
        }
      })
    );
  }
  
  getDriverDetails(id: string): Observable<ApiResponse<Driver>> {
    return this.apiService.get(`taxi-drivers/${id}`);
  }
  
  updateDriverStatus(id: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'): Observable<ApiResponse<Driver>> {
    return this.apiService.put(`taxi-drivers/${id}/status`, { status });
  }
  
  uploadDriverPhoto(driverId: string, file: File): Observable<ApiResponse<string>> {
    const formData = new FormData();
    formData.append('photo', file);
    return this.apiService.post(`taxi-drivers/${driverId}/photo`, formData);
  }
  
  uploadDriverDocuments(driverId: string, documents: { type: string; file: File }[]): Observable<ApiResponse<string[]>> {
    const formData = new FormData();
    documents.forEach(doc => {
      formData.append(`documents[${doc.type}]`, doc.file);
    });
    return this.apiService.post(`taxi-drivers/${driverId}/documents`, formData);
  }
  
  // Taxi Management
  getTaxis(options?: FilterOptions): Observable<PaginatedResponse<Taxi>> {
    return this.apiService.getPaginated('taxis', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.taxis.next(response.data);
        }
      })
    );
  }
  
  createTaxi(taxiData: Partial<Taxi>): Observable<ApiResponse<Taxi>> {
    return this.apiService.post('taxis', taxiData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentTaxis = this.taxis.value;
          this.taxis.next([...currentTaxis, response.data]);
        }
      })
    );
  }
  
  updateTaxi(id: string, taxiData: Partial<Taxi>): Observable<ApiResponse<Taxi>> {
    return this.apiService.put(`taxis/${id}`, taxiData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentTaxis = this.taxis.value;
          const updatedTaxis = currentTaxis.map(taxi => 
            taxi.id === id ? response.data! : taxi
          );
          this.taxis.next(updatedTaxis);
        }
      })
    );
  }
  
  deleteTaxi(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`taxis/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentTaxis = this.taxis.value;
          const filteredTaxis = currentTaxis.filter(taxi => taxi.id !== id);
          this.taxis.next(filteredTaxis);
        }
      })
    );
  }
  
  getTaxiDetails(id: string): Observable<ApiResponse<Taxi>> {
    return this.apiService.get(`taxis/${id}`);
  }
  
  updateTaxiStatus(id: string, status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'OUT_OF_SERVICE'): Observable<ApiResponse<Taxi>> {
    return this.apiService.put(`taxis/${id}/status`, { status });
  }
  
  uploadTaxiPhoto(taxiId: string, file: File): Observable<ApiResponse<string>> {
    const formData = new FormData();
    formData.append('photo', file);
    return this.apiService.post(`taxis/${taxiId}/photo`, formData);
  }
  
  uploadTaxiDocuments(taxiId: string, documents: { type: string; file: File }[]): Observable<ApiResponse<string[]>> {
    const formData = new FormData();
    documents.forEach(doc => {
      formData.append(`documents[${doc.type}]`, doc.file);
    });
    return this.apiService.post(`taxis/${taxiId}/documents`, formData);
  }
  
  // Taxi Assignment Management
  getAssignments(options?: FilterOptions): Observable<PaginatedResponse<TaxiAssignment>> {
    return this.apiService.getPaginated('taxi-assignments', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.assignments.next(response.data);
        }
      })
    );
  }
  
  createAssignment(assignmentData: Partial<TaxiAssignment>): Observable<ApiResponse<TaxiAssignment>> {
    return this.apiService.post('taxi-assignments', assignmentData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentAssignments = this.assignments.value;
          this.assignments.next([response.data, ...currentAssignments]);
        }
      })
    );
  }
  
  updateAssignment(id: string, assignmentData: Partial<TaxiAssignment>): Observable<ApiResponse<TaxiAssignment>> {
    return this.apiService.put(`taxi-assignments/${id}`, assignmentData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentAssignments = this.assignments.value;
          const updatedAssignments = currentAssignments.map(assignment => 
            assignment.id === id ? response.data! : assignment
          );
          this.assignments.next(updatedAssignments);
        }
      })
    );
  }
  
  completeAssignment(id: string, completionData: {
    endDate: Date;
    endMileage: number;
    notes?: string;
    expenses?: Array<{ description: string; amount: number; receipt?: File }>;
  }): Observable<ApiResponse<TaxiAssignment>> {
    const formData = new FormData();
    formData.append('endDate', completionData.endDate.toISOString());
    formData.append('endMileage', completionData.endMileage.toString());
    if (completionData.notes) {
      formData.append('notes', completionData.notes);
    }
    if (completionData.expenses) {
      completionData.expenses.forEach((expense, index) => {
        formData.append(`expenses[${index}][description]`, expense.description);
        formData.append(`expenses[${index}][amount]`, expense.amount.toString());
        if (expense.receipt) {
          formData.append(`expenses[${index}][receipt]`, expense.receipt);
        }
      });
    }
    return this.apiService.post(`taxi-assignments/${id}/complete`, formData);
  }
  
  cancelAssignment(id: string, reason: string): Observable<ApiResponse<any>> {
    return this.apiService.post(`taxi-assignments/${id}/cancel`, { reason });
  }
  
  // Taxi Payment Management
  getPayments(options?: FilterOptions): Observable<PaginatedResponse<TaxiPayment>> {
    return this.apiService.getPaginated('taxi-payments', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.payments.next(response.data);
        }
      })
    );
  }
  
  createPayment(paymentData: Partial<TaxiPayment>): Observable<ApiResponse<TaxiPayment>> {
    return this.apiService.post('taxi-payments', paymentData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentPayments = this.payments.value;
          this.payments.next([response.data, ...currentPayments]);
        }
      })
    );
  }
  
  updatePayment(id: string, paymentData: Partial<TaxiPayment>): Observable<ApiResponse<TaxiPayment>> {
    return this.apiService.put(`taxi-payments/${id}`, paymentData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentPayments = this.payments.value;
          const updatedPayments = currentPayments.map(payment => 
            payment.id === id ? response.data! : payment
          );
          this.payments.next(updatedPayments);
        }
      })
    );
  }
  
  deletePayment(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`taxi-payments/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentPayments = this.payments.value;
          const filteredPayments = currentPayments.filter(payment => payment.id !== id);
          this.payments.next(filteredPayments);
        }
      })
    );
  }
  
  getPaymentReceipt(id: string): Observable<Blob> {
    return this.apiService.downloadFile(`taxi-payments/${id}/receipt`);
  }
  
  // Taxi Operations
  assignTaxi(taxiId: string, driverId: string, assignmentData: {
    startDate: Date;
    startMileage: number;
    notes?: string;
  }): Observable<ApiResponse<TaxiAssignment>> {
    return this.apiService.post(`taxis/${taxiId}/assign`, {
      driverId,
      ...assignmentData
    });
  }
  
  returnTaxi(taxiId: string, returnData: {
    returnDate: Date;
    endMileage: number;
    condition: 'GOOD' | 'DAMAGED' | 'NEEDS_CLEANING';
    notes?: string;
    fuelLevel?: number;
  }): Observable<ApiResponse<TaxiAssignment>> {
    return this.apiService.post(`taxis/${taxiId}/return`, returnData);
  }
  
  // Driver Financial Summary
  getDriverFinancialSummary(driverId: string, period?: {
    dateFrom?: Date;
    dateTo?: Date;
  }): Observable<ApiResponse<DriverFinancialSummary>> {
    return this.apiService.get(`taxi-drivers/${driverId}/financial-summary`, { params: period });
  }
  
  // Taxi Reports
  getReports(options?: FilterOptions): Observable<PaginatedResponse<TaxiReport>> {
    return this.apiService.getPaginated('taxi-reports', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.reports.next(response.data);
        }
      })
    );
  }
  
  generateReport(reportData: {
    type: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    dateFrom: Date;
    dateTo: Date;
    driverId?: string;
    taxiId?: string;
  }): Observable<ApiResponse<TaxiReport>> {
    return this.apiService.post('taxi-reports', reportData);
  }
  
  getReportPdf(id: string): Observable<Blob> {
    return this.apiService.downloadFile(`taxi-reports/${id}/pdf`);
  }
  
  // Maintenance Management
  scheduleMaintenance(taxiId: string, maintenanceData: {
    scheduledDate: Date;
    maintenanceType: string;
    description: string;
    estimatedCost?: number;
  }): Observable<ApiResponse<any>> {
    return this.apiService.post(`taxis/${taxiId}/maintenance`, maintenanceData);
  }
  
  completeMaintenance(taxiId: string, maintenanceId: string, completionData: {
    completionDate: Date;
    actualCost: number;
    notes?: string;
    receipts?: File[];
  }): Observable<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('completionDate', completionData.completionDate.toISOString());
    formData.append('actualCost', completionData.actualCost.toString());
    if (completionData.notes) {
      formData.append('notes', completionData.notes);
    }
    if (completionData.receipts) {
      completionData.receipts.forEach(receipt => {
        formData.append('receipts[]', receipt);
      });
    }
    return this.apiService.post(`taxis/${taxiId}/maintenance/${maintenanceId}/complete`, formData);
  }
  
  getMaintenanceHistory(taxiId: string): Observable<ApiResponse<Array<{
    id: string;
    maintenanceType: string;
    scheduledDate: Date;
    completionDate?: Date;
    estimatedCost?: number;
    actualCost?: number;
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
    notes?: string;
  }>>> {
    return this.apiService.get(`taxis/${taxiId}/maintenance`);
  }
  
  // Reports and Analytics
  getTaxiReport(filters: {
    dateFrom?: Date;
    dateTo?: Date;
    driverId?: string;
    taxiId?: string;
    reportType?: 'REVENUE' | 'EXPENSES' | 'UTILIZATION' | 'MAINTENANCE';
  }): Observable<Blob> {
    return this.apiService.downloadFile('taxi/report', filters);
  }
  
  getDriverPerformanceReport(driverId: string, filters: {
    dateFrom?: Date;
    dateTo?: Date;
  }): Observable<Blob> {
    return this.apiService.downloadFile(`taxi-drivers/${driverId}/performance-report`, filters);
  }
  
  // Alerts and Notifications
  getTaxisNeedingMaintenance(): Observable<ApiResponse<Taxi[]>> {
    return this.apiService.get('taxis/maintenance-due');
  }
  
  getDriversWithExpiredDocuments(): Observable<ApiResponse<Driver[]>> {
    return this.apiService.get('taxi-drivers/expired-documents');
  }
  
  getOverdueAssignments(): Observable<ApiResponse<TaxiAssignment[]>> {
    return this.apiService.get('taxi-assignments/overdue');
  }
  
  // Statistics
  getTaxiStatistics(): Observable<ApiResponse<{
    totalTaxis: number;
    availableTaxis: number;
    inUseTaxis: number;
    maintenanceTaxis: number;
    outOfServiceTaxis: number;
    totalDrivers: number;
    activeDrivers: number;
    totalAssignments: number;
    activeAssignments: number;
    completedAssignments: number;
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    averageRevenuePerAssignment: number;
    taxiUtilizationRate: number;
    driverEfficiencyRate: number;
    monthlyRevenue: Array<{ month: string; revenue: number; expenses: number }>;
    topDrivers: Array<{ driver: Driver; revenue: number; assignments: number }>;
    topTaxis: Array<{ taxi: Taxi; revenue: number; utilization: number }>;
    maintenanceCosts: Array<{ month: string; cost: number }>;
  }>> {
    return this.apiService.get('taxi/statistics');
  }
  
  // Search and Filter
  searchTaxis(query: string, filters?: {
    status?: string;
    type?: string;
    driverId?: string;
    available?: boolean;
  }): Observable<ApiResponse<Taxi[]>> {
    return this.apiService.get('taxis/search', { 
      params: { query, ...filters } 
    });
  }
  
  searchDrivers(query: string, filters?: {
    status?: string;
    available?: boolean;
    hasValidLicense?: boolean;
  }): Observable<ApiResponse<Driver[]>> {
    return this.apiService.get('taxi-drivers/search', { 
      params: { query, ...filters } 
    });
  }
  
  getAvailableTaxis(filters?: {
    type?: string;
    location?: string;
  }): Observable<ApiResponse<Taxi[]>> {
    return this.apiService.get('taxis/available', { params: filters });
  }
  
  getAvailableDrivers(filters?: {
    location?: string;
    hasValidLicense?: boolean;
  }): Observable<ApiResponse<Driver[]>> {
    return this.apiService.get('taxi-drivers/available', { params: filters });
  }
}
