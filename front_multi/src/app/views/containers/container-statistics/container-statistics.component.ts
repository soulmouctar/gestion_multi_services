import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup } from '@angular/forms';
import {
  ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
  AlertModule, SpinnerModule, TableModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-container-statistics',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, IconDirective,
    ButtonModule, ButtonGroupModule, CardModule, FormModule, BadgeModule,
    AlertModule, SpinnerModule, TableModule
  ],
  templateUrl: './container-statistics.component.html'
})
export class ContainerStatisticsComponent implements OnInit {
  loading = false;
  error: string | null = null;
  
  // Statistics data
  generalStats: any = null;
  capacityStats: any[] = [];
  statusStats: any[] = [];
  monthlyStats: any[] = [];
  topContainers: any[] = [];
  
  // Filter form
  filterForm: FormGroup;
  
  // Date range
  dateRanges = [
    { label: '7 derniers jours', value: '7days' },
    { label: '30 derniers jours', value: '30days' },
    { label: '3 derniers mois', value: '3months' },
    { label: '6 derniers mois', value: '6months' },
    { label: 'Cette année', value: 'year' }
  ];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {
    this.filterForm = this.fb.group({
      period: ['30days'],
      status: [''],
      capacity_range: ['']
    });
  }

  ngOnInit(): void {
    this.loadStatistics();
  }

  loadStatistics(): void {
    this.loading = true;
    const filters = this.filterForm.value;
    
    // Load general statistics
    this.loadGeneralStats(filters);
    this.loadCapacityStats(filters);
    this.loadStatusStats(filters);
    this.loadMonthlyStats(filters);
    this.loadTopContainers(filters);
  }

  loadGeneralStats(filters: any): void {
    let url = 'containers/statistics/general';
    const params = new URLSearchParams();
    
    if (filters.period) params.append('period', filters.period);
    if (filters.status) params.append('status', filters.status);
    
    if (params.toString()) {
      url += '?' + params.toString();
    }

    this.apiService.get<any>(url).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.generalStats = r.data;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Erreur lors du chargement des statistiques générales';
      }
    });
  }

  loadCapacityStats(filters: any): void {
    let url = 'containers/statistics/capacity';
    const params = new URLSearchParams();
    
    if (filters.period) params.append('period', filters.period);
    
    if (params.toString()) {
      url += '?' + params.toString();
    }

    this.apiService.get<any>(url).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.capacityStats = r.data;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        console.error('Erreur lors du chargement des statistiques de capacité');
      }
    });
  }

  loadStatusStats(filters: any): void {
    let url = 'containers/statistics/status';
    const params = new URLSearchParams();
    
    if (filters.period) params.append('period', filters.period);
    
    if (params.toString()) {
      url += '?' + params.toString();
    }

    this.apiService.get<any>(url).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.statusStats = r.data;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        console.error('Erreur lors du chargement des statistiques de statut');
      }
    });
  }

  loadMonthlyStats(filters: any): void {
    let url = 'containers/statistics/monthly';
    const params = new URLSearchParams();
    
    if (filters.period) params.append('period', filters.period);
    
    if (params.toString()) {
      url += '?' + params.toString();
    }

    this.apiService.get<any>(url).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          // Extract monthly_breakdown array from response
          this.monthlyStats = r.data.monthly_breakdown || [];
          // Also update general stats with monthly data
          if (this.generalStats) {
            this.generalStats.containers_created = r.data.containers_created || 0;
            this.generalStats.total_containers = r.data.total_containers || 0;
            this.generalStats.containers_with_photos = r.data.containers_with_photos || 0;
          }
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.monthlyStats = [];
        console.error('Erreur lors du chargement des statistiques mensuelles');
      }
    });
  }

  loadTopContainers(filters: any): void {
    let url = 'containers/statistics/top-performers';
    const params = new URLSearchParams();
    
    if (filters.period) params.append('period', filters.period);
    
    if (params.toString()) {
      url += '?' + params.toString();
    }

    this.apiService.get<any>(url).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          // Extract top_by_photos array from response
          this.topContainers = r.data.top_by_photos || [];
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.topContainers = [];
        this.loading = false;
        console.error('Erreur lors du chargement du top des conteneurs');
      }
    });
  }

  applyFilters(): void {
    this.loadStatistics();
  }

  exportStatistics(): void {
    const filters = this.filterForm.value;
    let url = 'containers/statistics/export';
    const params = new URLSearchParams();
    
    if (filters.period) params.append('period', filters.period);
    if (filters.status) params.append('status', filters.status);
    
    if (params.toString()) {
      url += '?' + params.toString();
    }

    this.apiService.get<any>(url).subscribe({
      next: (r) => {
        if (r.success && r.data?.download_url) {
          // Trigger download
          const link = document.createElement('a');
          link.href = r.data.download_url;
          link.download = `container-statistics-${new Date().toISOString().split('T')[0]}.xlsx`;
          link.click();
        }
      },
      error: () => {
        this.error = 'Erreur lors de l\'export des statistiques';
      }
    });
  }

  getCapacityColor(percentage: number): string {
    if (percentage >= 90) return 'danger';
    if (percentage >= 70) return 'warning';
    if (percentage >= 50) return 'info';
    return 'success';
  }

  getStatusColor(status: string): string {
    if (!status) return 'secondary';
    switch (status.toLowerCase()) {
      case 'active': return 'success';
      case 'maintenance': return 'warning';
      case 'inactive': return 'secondary';
      case 'full': return 'danger';
      default: return 'primary';
    }
  }

  refreshData(): void {
    this.loadStatistics();
  }
}
