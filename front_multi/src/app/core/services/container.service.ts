import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { 
  Container, 
  ContainerPhoto, 
  ContainerDispatch, 
  ContainerSale, 
  ContainerInterest,
  ContainerDispatchRequest,
  ApiResponse, 
  PaginatedResponse, 
  FilterOptions 
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class ContainerService {
  private containers = new BehaviorSubject<Container[]>([]);
  private dispatches = new BehaviorSubject<ContainerDispatch[]>([]);
  private sales = new BehaviorSubject<ContainerSale[]>([]);
  private interestCalculations = new BehaviorSubject<ContainerInterest[]>([]);
  private dispatchRequests = new BehaviorSubject<ContainerDispatchRequest[]>([]);
  
  containers$ = this.containers.asObservable();
  dispatches$ = this.dispatches.asObservable();
  sales$ = this.sales.asObservable();
  interestCalculations$ = this.interestCalculations.asObservable();
  dispatchRequests$ = this.dispatchRequests.asObservable();
  
  constructor(private apiService: ApiService) {}
  
  // Container Management
  getContainers(options?: FilterOptions): Observable<PaginatedResponse<Container>> {
    return this.apiService.getPaginated('containers', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.containers.next(response.data);
        }
      })
    );
  }
  
  createContainer(containerData: Partial<Container>): Observable<ApiResponse<Container>> {
    return this.apiService.post('containers', containerData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentContainers = this.containers.value;
          this.containers.next([...currentContainers, response.data]);
        }
      })
    );
  }
  
  updateContainer(id: string, containerData: Partial<Container>): Observable<ApiResponse<Container>> {
    return this.apiService.put(`containers/${id}`, containerData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentContainers = this.containers.value;
          const updatedContainers = currentContainers.map(container => 
            container.id === id ? response.data! : container
          );
          this.containers.next(updatedContainers);
        }
      })
    );
  }
  
  deleteContainer(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`containers/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentContainers = this.containers.value;
          const filteredContainers = currentContainers.filter(container => container.id !== id);
          this.containers.next(filteredContainers);
        }
      })
    );
  }
  
  getContainerDetails(id: string): Observable<ApiResponse<Container>> {
    return this.apiService.get(`containers/${id}`);
  }
  
  // Container Photos Management
  uploadContainerPhoto(containerId: string, file: File): Observable<ApiResponse<ContainerPhoto>> {
    const formData = new FormData();
    formData.append('photo', file);
    return this.apiService.post(`containers/${containerId}/photos`, formData);
  }
  
  deleteContainerPhoto(containerId: string, photoId: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`containers/${containerId}/photos/${photoId}`);
  }
  
  getContainerPhotos(containerId: string): Observable<ApiResponse<ContainerPhoto[]>> {
    return this.apiService.get(`containers/${containerId}/photos`);
  }
  
  // Container Dispatch Management
  getDispatches(options?: FilterOptions): Observable<PaginatedResponse<ContainerDispatch>> {
    return this.apiService.getPaginated('container-dispatches', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.dispatches.next(response.data);
        }
      })
    );
  }
  
  createDispatch(dispatchData: Partial<ContainerDispatch>): Observable<ApiResponse<ContainerDispatch>> {
    return this.apiService.post('container-dispatches', dispatchData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentDispatches = this.dispatches.value;
          this.dispatches.next([response.data, ...currentDispatches]);
        }
      })
    );
  }
  
  updateDispatch(id: string, dispatchData: Partial<ContainerDispatch>): Observable<ApiResponse<ContainerDispatch>> {
    return this.apiService.put(`container-dispatches/${id}`, dispatchData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentDispatches = this.dispatches.value;
          const updatedDispatches = currentDispatches.map(dispatch => 
            dispatch.id === id ? response.data! : dispatch
          );
          this.dispatches.next(updatedDispatches);
        }
      })
    );
  }
  
  deleteDispatch(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`container-dispatches/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentDispatches = this.dispatches.value;
          const filteredDispatches = currentDispatches.filter(dispatch => dispatch.id !== id);
          this.dispatches.next(filteredDispatches);
        }
      })
    );
  }
  
  // Container Dispatch Requests
  getDispatchRequests(options?: FilterOptions): Observable<PaginatedResponse<ContainerDispatchRequest>> {
    return this.apiService.getPaginated('container-dispatch-requests', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.dispatchRequests.next(response.data);
        }
      })
    );
  }
  
  createDispatchRequest(requestData: Partial<ContainerDispatchRequest>): Observable<ApiResponse<ContainerDispatchRequest>> {
    return this.apiService.post('container-dispatch-requests', requestData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentRequests = this.dispatchRequests.value;
          this.dispatchRequests.next([response.data, ...currentRequests]);
        }
      })
    );
  }
  
  approveDispatchRequest(id: string): Observable<ApiResponse<ContainerDispatch>> {
    return this.apiService.post(`container-dispatch-requests/${id}/approve`, {});
  }
  
  rejectDispatchRequest(id: string, reason: string): Observable<ApiResponse<any>> {
    return this.apiService.post(`container-dispatch-requests/${id}/reject`, { reason });
  }
  
  // Container Sales Management
  getSales(options?: FilterOptions): Observable<PaginatedResponse<ContainerSale>> {
    return this.apiService.getPaginated('container-sales', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.sales.next(response.data);
        }
      })
    );
  }
  
  createSale(saleData: Partial<ContainerSale>): Observable<ApiResponse<ContainerSale>> {
    return this.apiService.post('container-sales', saleData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentSales = this.sales.value;
          this.sales.next([response.data, ...currentSales]);
        }
      })
    );
  }
  
  updateSale(id: string, saleData: Partial<ContainerSale>): Observable<ApiResponse<ContainerSale>> {
    return this.apiService.put(`container-sales/${id}`, saleData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentSales = this.sales.value;
          const updatedSales = currentSales.map(sale => 
            sale.id === id ? response.data! : sale
          );
          this.sales.next(updatedSales);
        }
      })
    );
  }
  
  deleteSale(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`container-sales/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentSales = this.sales.value;
          const filteredSales = currentSales.filter(sale => sale.id !== id);
          this.sales.next(filteredSales);
        }
      })
    );
  }
  
  // Interest Calculations
  getInterestCalculations(options?: FilterOptions): Observable<PaginatedResponse<ContainerInterest>> {
    return this.apiService.getPaginated('container-interests', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.interestCalculations.next(response.data);
        }
      })
    );
  }
  
  calculateInterest(containerId: string, calculationData: {
    calculationDate: Date;
    dailyRate: number;
    includeWeekends?: boolean;
  }): Observable<ApiResponse<ContainerInterest>> {
    return this.apiService.post(`containers/${containerId}/calculate-interest`, calculationData);
  }
  
  calculateBatchInterest(containerIds: string[], calculationData: {
    calculationDate: Date;
    dailyRate: number;
    includeWeekends?: boolean;
  }): Observable<ApiResponse<ContainerInterest[]>> {
    return this.apiService.post('containers/calculate-batch-interest', {
      containerIds,
      ...calculationData
    });
  }
  
  // Container Operations
  dispatchContainer(containerId: string, dispatchData: {
    clientId?: string;
    supplierId?: string;
    destination: string;
    dispatchDate: Date;
    expectedReturnDate?: Date;
    notes?: string;
  }): Observable<ApiResponse<ContainerDispatch>> {
    return this.apiService.post(`containers/${containerId}/dispatch`, dispatchData);
  }
  
  returnContainer(containerId: string, returnData: {
    returnDate: Date;
    condition: 'GOOD' | 'DAMAGED' | 'NEEDS_REPAIR';
    notes?: string;
    photos?: File[];
  }): Observable<ApiResponse<ContainerDispatch>> {
    const formData = new FormData();
    formData.append('returnDate', returnData.returnDate.toISOString());
    formData.append('condition', returnData.condition);
    if (returnData.notes) {
      formData.append('notes', returnData.notes);
    }
    if (returnData.photos) {
      returnData.photos.forEach(photo => {
        formData.append('photos[]', photo);
      });
    }
    return this.apiService.post(`containers/${containerId}/return`, formData);
  }
  
  sellContainer(containerId: string, saleData: {
    clientId: string;
    salePrice: number;
    currency: 'USD' | 'GNF';
    saleDate: Date;
    paymentMethod: string;
    notes?: string;
  }): Observable<ApiResponse<ContainerSale>> {
    return this.apiService.post(`containers/${containerId}/sell`, saleData);
  }
  
  // Container Status Management
  updateContainerStatus(containerId: string, status: 'AVAILABLE' | 'DISPATCHED' | 'IN_TRANSIT' | 'SOLD' | 'MAINTENANCE'): Observable<ApiResponse<Container>> {
    return this.apiService.put(`containers/${containerId}/status`, { status });
  }
  
  getContainerHistory(containerId: string): Observable<ApiResponse<Array<{
    type: 'DISPATCH' | 'RETURN' | 'SALE' | 'MAINTENANCE';
    date: Date;
    details: any;
    user: string;
  }>>> {
    return this.apiService.get(`containers/${containerId}/history`);
  }
  
  // Reports
  getContainerReport(filters: {
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
    clientId?: string;
    supplierId?: string;
  }): Observable<Blob> {
    return this.apiService.downloadFile('containers/report', filters);
  }
  
  getDispatchReport(filters: {
    dateFrom?: Date;
    dateTo?: Date;
    destination?: string;
    status?: string;
  }): Observable<Blob> {
    return this.apiService.downloadFile('container-dispatches/report', filters);
  }
  
  getInterestReport(filters: {
    dateFrom?: Date;
    dateTo?: Date;
    containerId?: string;
    clientId?: string;
  }): Observable<Blob> {
    return this.apiService.downloadFile('container-interests/report', filters);
  }
  
  // Alerts and Notifications
  getOverdueDispatches(): Observable<ApiResponse<ContainerDispatch[]>> {
    return this.apiService.get('container-dispatches/overdue');
  }
  
  getContainersNeedingMaintenance(): Observable<ApiResponse<Container[]>> {
    return this.apiService.get('containers/maintenance-needed');
  }
  
  // Statistics
  getContainerStatistics(): Observable<ApiResponse<{
    totalContainers: number;
    availableContainers: number;
    dispatchedContainers: number;
    inTransitContainers: number;
    soldContainers: number;
    maintenanceContainers: number;
    totalDispatches: number;
    activeDispatches: number;
    overdueDispatches: number;
    totalSales: number;
    totalRevenue: number;
    totalInterestAccrued: number;
    monthlyDispatches: Array<{ month: string; count: number }>;
    topClients: Array<{ client: any; dispatchCount: number }>;
    containerUtilization: number;
  }>> {
    return this.apiService.get('containers/statistics');
  }
  
  // Search and Filter
  searchContainers(query: string, filters?: {
    status?: string;
    type?: string;
    size?: string;
    location?: string;
    available?: boolean;
  }): Observable<ApiResponse<Container[]>> {
    return this.apiService.get('containers/search', { 
      params: { query, ...filters } 
    });
  }
  
  getAvailableContainers(filters?: {
    type?: string;
    size?: string;
    location?: string;
  }): Observable<ApiResponse<Container[]>> {
    return this.apiService.get('containers/available', { params: filters });
  }
  
  // Client/Supplier Container Operations
  getClientContainers(clientId: string): Observable<ApiResponse<Container[]>> {
    return this.apiService.get(`clients/${clientId}/containers`);
  }
  
  getSupplierContainers(supplierId: string): Observable<ApiResponse<Container[]>> {
    return this.apiService.get(`suppliers/${supplierId}/containers`);
  }
}
