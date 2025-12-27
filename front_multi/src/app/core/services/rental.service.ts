import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { 
  Location, 
  Building, 
  Floor, 
  UnitConfiguration, 
  HousingUnit, 
  Tenant, 
  RentalContract, 
  RentalPayment, 
  PropertyOwner, 
  OwnerPayment, 
  RentalReport,
  ApiResponse, 
  PaginatedResponse, 
  FilterOptions 
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class RentalService {
  private locations = new BehaviorSubject<Location[]>([]);
  private buildings = new BehaviorSubject<Building[]>([]);
  private floors = new BehaviorSubject<Floor[]>([]);
  private unitConfigurations = new BehaviorSubject<UnitConfiguration[]>([]);
  private housingUnits = new BehaviorSubject<HousingUnit[]>([]);
  private tenants = new BehaviorSubject<Tenant[]>([]);
  private contracts = new BehaviorSubject<RentalContract[]>([]);
  private payments = new BehaviorSubject<RentalPayment[]>([]);
  private owners = new BehaviorSubject<PropertyOwner[]>([]);
  private ownerPayments = new BehaviorSubject<OwnerPayment[]>([]);
  
  locations$ = this.locations.asObservable();
  buildings$ = this.buildings.asObservable();
  floors$ = this.floors.asObservable();
  unitConfigurations$ = this.unitConfigurations.asObservable();
  housingUnits$ = this.housingUnits.asObservable();
  tenants$ = this.tenants.asObservable();
  contracts$ = this.contracts.asObservable();
  payments$ = this.payments.asObservable();
  owners$ = this.owners.asObservable();
  ownerPayments$ = this.ownerPayments.asObservable();
  
  constructor(private apiService: ApiService) {}
  
  // Location Management
  getLocations(options?: FilterOptions): Observable<PaginatedResponse<Location>> {
    return this.apiService.getPaginated('rental-locations', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.locations.next(response.data);
        }
      })
    );
  }
  
  createLocation(locationData: Partial<Location>): Observable<ApiResponse<Location>> {
    return this.apiService.post('rental-locations', locationData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentLocations = this.locations.value;
          this.locations.next([...currentLocations, response.data]);
        }
      })
    );
  }
  
  updateLocation(id: string, locationData: Partial<Location>): Observable<ApiResponse<Location>> {
    return this.apiService.put(`rental-locations/${id}`, locationData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentLocations = this.locations.value;
          const updatedLocations = currentLocations.map(location => 
            location.id === id ? response.data! : location
          );
          this.locations.next(updatedLocations);
        }
      })
    );
  }
  
  deleteLocation(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`rental-locations/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentLocations = this.locations.value;
          const filteredLocations = currentLocations.filter(location => location.id !== id);
          this.locations.next(filteredLocations);
        }
      })
    );
  }
  
  // Building Management
  getBuildings(locationId: string, options?: FilterOptions): Observable<PaginatedResponse<Building>> {
    return this.apiService.getPaginated(`rental-locations/${locationId}/buildings`, { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.buildings.next(response.data);
        }
      })
    );
  }
  
  createBuilding(locationId: string, buildingData: Partial<Building>): Observable<ApiResponse<Building>> {
    return this.apiService.post(`rental-locations/${locationId}/buildings`, buildingData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentBuildings = this.buildings.value;
          this.buildings.next([...currentBuildings, response.data]);
        }
      })
    );
  }
  
  updateBuilding(id: string, buildingData: Partial<Building>): Observable<ApiResponse<Building>> {
    return this.apiService.put(`rental-buildings/${id}`, buildingData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentBuildings = this.buildings.value;
          const updatedBuildings = currentBuildings.map(building => 
            building.id === id ? response.data! : building
          );
          this.buildings.next(updatedBuildings);
        }
      })
    );
  }
  
  deleteBuilding(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`rental-buildings/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentBuildings = this.buildings.value;
          const filteredBuildings = currentBuildings.filter(building => building.id !== id);
          this.buildings.next(filteredBuildings);
        }
      })
    );
  }
  
  // Floor Management
  getFloors(buildingId: string, options?: FilterOptions): Observable<PaginatedResponse<Floor>> {
    return this.apiService.getPaginated(`rental-buildings/${buildingId}/floors`, { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.floors.next(response.data);
        }
      })
    );
  }
  
  createFloor(buildingId: string, floorData: Partial<Floor>): Observable<ApiResponse<Floor>> {
    return this.apiService.post(`rental-buildings/${buildingId}/floors`, floorData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentFloors = this.floors.value;
          this.floors.next([...currentFloors, response.data]);
        }
      })
    );
  }
  
  updateFloor(id: string, floorData: Partial<Floor>): Observable<ApiResponse<Floor>> {
    return this.apiService.put(`rental-floors/${id}`, floorData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentFloors = this.floors.value;
          const updatedFloors = currentFloors.map(floor => 
            floor.id === id ? response.data! : floor
          );
          this.floors.next(updatedFloors);
        }
      })
    );
  }
  
  deleteFloor(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`rental-floors/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentFloors = this.floors.value;
          const filteredFloors = currentFloors.filter(floor => floor.id !== id);
          this.floors.next(filteredFloors);
        }
      })
    );
  }
  
  // Unit Configuration Management
  getUnitConfigurations(options?: FilterOptions): Observable<PaginatedResponse<UnitConfiguration>> {
    return this.apiService.getPaginated('unit-configurations', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.unitConfigurations.next(response.data);
        }
      })
    );
  }
  
  createUnitConfiguration(configData: Partial<UnitConfiguration>): Observable<ApiResponse<UnitConfiguration>> {
    return this.apiService.post('unit-configurations', configData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentConfigs = this.unitConfigurations.value;
          this.unitConfigurations.next([...currentConfigs, response.data]);
        }
      })
    );
  }
  
  updateUnitConfiguration(id: string, configData: Partial<UnitConfiguration>): Observable<ApiResponse<UnitConfiguration>> {
    return this.apiService.put(`unit-configurations/${id}`, configData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentConfigs = this.unitConfigurations.value;
          const updatedConfigs = currentConfigs.map(config => 
            config.id === id ? response.data! : config
          );
          this.unitConfigurations.next(updatedConfigs);
        }
      })
    );
  }
  
  deleteUnitConfiguration(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`unit-configurations/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentConfigs = this.unitConfigurations.value;
          const filteredConfigs = currentConfigs.filter(config => config.id !== id);
          this.unitConfigurations.next(filteredConfigs);
        }
      })
    );
  }
  
  // Housing Unit Management
  getHousingUnits(options?: FilterOptions): Observable<PaginatedResponse<HousingUnit>> {
    return this.apiService.getPaginated('housing-units', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.housingUnits.next(response.data);
        }
      })
    );
  }
  
  createHousingUnit(unitData: Partial<HousingUnit>): Observable<ApiResponse<HousingUnit>> {
    return this.apiService.post('housing-units', unitData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentUnits = this.housingUnits.value;
          this.housingUnits.next([...currentUnits, response.data]);
        }
      })
    );
  }
  
  updateHousingUnit(id: string, unitData: Partial<HousingUnit>): Observable<ApiResponse<HousingUnit>> {
    return this.apiService.put(`housing-units/${id}`, unitData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentUnits = this.housingUnits.value;
          const updatedUnits = currentUnits.map(unit => 
            unit.id === id ? response.data! : unit
          );
          this.housingUnits.next(updatedUnits);
        }
      })
    );
  }
  
  deleteHousingUnit(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`housing-units/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentUnits = this.housingUnits.value;
          const filteredUnits = currentUnits.filter(unit => unit.id !== id);
          this.housingUnits.next(filteredUnits);
        }
      })
    );
  }
  
  uploadUnitPhotos(unitId: string, files: File[]): Observable<ApiResponse<string[]>> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('photos[]', file);
    });
    return this.apiService.post(`housing-units/${unitId}/photos`, formData);
  }
  
  deleteUnitPhoto(unitId: string, photoId: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`housing-units/${unitId}/photos/${photoId}`);
  }
  
  // Tenant Management
  getTenants(options?: FilterOptions): Observable<PaginatedResponse<Tenant>> {
    return this.apiService.getPaginated('rental-tenants', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.tenants.next(response.data);
        }
      })
    );
  }
  
  createTenant(tenantData: Partial<Tenant>): Observable<ApiResponse<Tenant>> {
    return this.apiService.post('rental-tenants', tenantData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentTenants = this.tenants.value;
          this.tenants.next([...currentTenants, response.data]);
        }
      })
    );
  }
  
  updateTenant(id: string, tenantData: Partial<Tenant>): Observable<ApiResponse<Tenant>> {
    return this.apiService.put(`rental-tenants/${id}`, tenantData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentTenants = this.tenants.value;
          const updatedTenants = currentTenants.map(tenant => 
            tenant.id === id ? response.data! : tenant
          );
          this.tenants.next(updatedTenants);
        }
      })
    );
  }
  
  deleteTenant(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`rental-tenants/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentTenants = this.tenants.value;
          const filteredTenants = currentTenants.filter(tenant => tenant.id !== id);
          this.tenants.next(filteredTenants);
        }
      })
    );
  }
  
  // Rental Contract Management
  getContracts(options?: FilterOptions): Observable<PaginatedResponse<RentalContract>> {
    return this.apiService.getPaginated('rental-contracts', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.contracts.next(response.data);
        }
      })
    );
  }
  
  createContract(contractData: Partial<RentalContract>): Observable<ApiResponse<RentalContract>> {
    return this.apiService.post('rental-contracts', contractData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentContracts = this.contracts.value;
          this.contracts.next([response.data, ...currentContracts]);
        }
      })
    );
  }
  
  updateContract(id: string, contractData: Partial<RentalContract>): Observable<ApiResponse<RentalContract>> {
    return this.apiService.put(`rental-contracts/${id}`, contractData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentContracts = this.contracts.value;
          const updatedContracts = currentContracts.map(contract => 
            contract.id === id ? response.data! : contract
          );
          this.contracts.next(updatedContracts);
        }
      })
    );
  }
  
  terminateContract(id: string, terminationData: {
    terminationDate: Date;
    reason: string;
    notes?: string;
  }): Observable<ApiResponse<RentalContract>> {
    return this.apiService.post(`rental-contracts/${id}/terminate`, terminationData);
  }
  
  renewContract(id: string, renewalData: {
    newEndDate: Date;
    newRentAmount?: number;
    notes?: string;
  }): Observable<ApiResponse<RentalContract>> {
    return this.apiService.post(`rental-contracts/${id}/renew`, renewalData);
  }
  
  getContractPdf(id: string): Observable<Blob> {
    return this.apiService.downloadFile(`rental-contracts/${id}/pdf`);
  }
  
  // Rental Payment Management
  getPayments(options?: FilterOptions): Observable<PaginatedResponse<RentalPayment>> {
    return this.apiService.getPaginated('rental-payments', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.payments.next(response.data);
        }
      })
    );
  }
  
  createPayment(paymentData: Partial<RentalPayment>): Observable<ApiResponse<RentalPayment>> {
    return this.apiService.post('rental-payments', paymentData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentPayments = this.payments.value;
          this.payments.next([response.data, ...currentPayments]);
        }
      })
    );
  }
  
  updatePayment(id: string, paymentData: Partial<RentalPayment>): Observable<ApiResponse<RentalPayment>> {
    return this.apiService.put(`rental-payments/${id}`, paymentData).pipe(
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
    return this.apiService.delete(`rental-payments/${id}`).pipe(
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
    return this.apiService.downloadFile(`rental-payments/${id}/receipt`);
  }
  
  // Property Owner Management
  getOwners(options?: FilterOptions): Observable<PaginatedResponse<PropertyOwner>> {
    return this.apiService.getPaginated('property-owners', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.owners.next(response.data);
        }
      })
    );
  }
  
  createOwner(ownerData: Partial<PropertyOwner>): Observable<ApiResponse<PropertyOwner>> {
    return this.apiService.post('property-owners', ownerData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentOwners = this.owners.value;
          this.owners.next([...currentOwners, response.data]);
        }
      })
    );
  }
  
  updateOwner(id: string, ownerData: Partial<PropertyOwner>): Observable<ApiResponse<PropertyOwner>> {
    return this.apiService.put(`property-owners/${id}`, ownerData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentOwners = this.owners.value;
          const updatedOwners = currentOwners.map(owner => 
            owner.id === id ? response.data! : owner
          );
          this.owners.next(updatedOwners);
        }
      })
    );
  }
  
  deleteOwner(id: string): Observable<ApiResponse<any>> {
    return this.apiService.delete(`property-owners/${id}`).pipe(
      tap(response => {
        if (response.success) {
          const currentOwners = this.owners.value;
          const filteredOwners = currentOwners.filter(owner => owner.id !== id);
          this.owners.next(filteredOwners);
        }
      })
    );
  }
  
  // Owner Payment Management
  getOwnerPayments(options?: FilterOptions): Observable<PaginatedResponse<OwnerPayment>> {
    return this.apiService.getPaginated('owner-payments', { params: options }).pipe(
      tap(response => {
        if (response.data) {
          this.ownerPayments.next(response.data);
        }
      })
    );
  }
  
  createOwnerPayment(paymentData: Partial<OwnerPayment>): Observable<ApiResponse<OwnerPayment>> {
    return this.apiService.post('owner-payments', paymentData).pipe(
      tap(response => {
        if (response.success && response.data) {
          const currentPayments = this.ownerPayments.value;
          this.ownerPayments.next([response.data, ...currentPayments]);
        }
      })
    );
  }
  
  // Rental Operations
  rentUnit(unitId: string, contractData: Partial<RentalContract>): Observable<ApiResponse<RentalContract>> {
    return this.apiService.post(`housing-units/${unitId}/rent`, contractData);
  }
  
  vacateUnit(unitId: string, vacateData: {
    vacateDate: Date;
    reason: string;
    notes?: string;
    conditionReport?: string;
  }): Observable<ApiResponse<HousingUnit>> {
    return this.apiService.post(`housing-units/${unitId}/vacate`, vacateData);
  }
  
  // Reports
  getRentalReport(filters: {
    dateFrom?: Date;
    dateTo?: Date;
    locationId?: string;
    buildingId?: string;
    status?: string;
  }): Observable<Blob> {
    return this.apiService.downloadFile('rental/report', filters);
  }
  
  getOccupancyReport(filters: {
    dateFrom?: Date;
    dateTo?: Date;
    locationId?: string;
    buildingId?: string;
  }): Observable<Blob> {
    return this.apiService.downloadFile('rental/occupancy-report', filters);
  }
  
  getRevenueReport(filters: {
    dateFrom?: Date;
    dateTo?: Date;
    locationId?: string;
    buildingId?: string;
  }): Observable<Blob> {
    return this.apiService.downloadFile('rental/revenue-report', filters);
  }
  
  // Alerts and Notifications
  getExpiringContracts(days?: number): Observable<ApiResponse<RentalContract[]>> {
    return this.apiService.get('rental-contracts/expiring', { params: { days } });
  }
  
  getOverduePayments(): Observable<ApiResponse<RentalPayment[]>> {
    return this.apiService.get('rental-payments/overdue');
  }
  
  getAvailableUnits(filters?: {
    locationId?: string;
    buildingId?: string;
    unitType?: string;
  }): Observable<ApiResponse<HousingUnit[]>> {
    return this.apiService.get('housing-units/available', { params: filters });
  }
  
  // Statistics
  getRentalStatistics(): Observable<ApiResponse<{
    totalProperties: number;
    totalUnits: number;
    occupiedUnits: number;
    availableUnits: number;
    occupancyRate: number;
    totalTenants: number;
    activeContracts: number;
    expiringContracts: number;
    monthlyRevenue: number;
    annualRevenue: number;
    totalRevenue: number;
    overduePayments: number;
    totalOverdueAmount: number;
    averageRent: number;
    occupancyByLocation: Array<{ location: string; rate: number }>;
    monthlyRevenue: Array<{ month: string; revenue: number }>;
    topProperties: Array<{ property: string; revenue: number; occupancyRate: number }>;
  }>> {
    return this.apiService.get('rental/statistics');
  }
  
  // Search and Filter
  searchHousingUnits(query: string, filters?: {
    locationId?: string;
    buildingId?: string;
    unitType?: string;
    minRent?: number;
    maxRent?: number;
    available?: boolean;
  }): Observable<ApiResponse<HousingUnit[]>> {
    return this.apiService.get('housing-units/search', { 
      params: { query, ...filters } 
    });
  }
  
  searchTenants(query: string, filters?: {
    status?: string;
    contractStatus?: string;
  }): Observable<ApiResponse<Tenant[]>> {
    return this.apiService.get('rental-tenants/search', { 
      params: { query, ...filters } 
    });
  }
}
