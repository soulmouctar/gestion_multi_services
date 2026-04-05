import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { catchError, of } from 'rxjs';
import {
  CardModule, BadgeModule, SpinnerModule,
  RowComponent, ColComponent, ContainerComponent, TableModule, ProgressModule
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-statistics-inventory',
  standalone: true,
  imports: [
    CommonModule, IconDirective,
    CardModule, BadgeModule, SpinnerModule, ProgressModule,
    RowComponent, ColComponent, ContainerComponent, TableModule
  ],
  templateUrl: './statistics-inventory.component.html'
})
export class StatisticsInventoryComponent implements OnInit, OnDestroy {
  loading = true;

  stats = {
    totalProducts:      0,
    lowStockProducts:   0,
    totalCategories:    0,
    totalValue:         0,
    activeProducts:     0,
    inactiveProducts:   0
  };

  lowStockItems: any[] = [];
  categories: any[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;

    forkJoin({
      productStats: this.apiService.get<any>('products/statistics').pipe(catchError(() => of({ success: false, data: null }))),
      lowStock:     this.apiService.get<any>('products/low-stock').pipe(catchError(() => of({ success: false, data: [] }))),
      categories:   this.apiService.get<any>('product-categories?per_page=100').pipe(catchError(() => of({ success: false, data: null })))
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (results) => {
        if (results.productStats.success && results.productStats.data) {
          const ps = results.productStats.data;
          this.stats.totalProducts    = ps.total_products  ?? ps.total        ?? 0;
          this.stats.lowStockProducts = ps.low_stock_count ?? ps.low_stock    ?? 0;
          this.stats.totalValue       = ps.total_value     ?? ps.stock_value  ?? 0;
          this.stats.activeProducts   = ps.active_count    ?? ps.active       ?? 0;
          this.stats.inactiveProducts = ps.inactive_count  ?? ps.inactive     ?? 0;
        }
        if (results.lowStock.success) {
          const raw = results.lowStock.data;
          this.lowStockItems = Array.isArray(raw) ? raw.slice(0, 8) : (raw?.data ?? []).slice(0, 8);
          if (!this.stats.lowStockProducts) {
            this.stats.lowStockProducts = this.lowStockItems.length;
          }
        }
        if (results.categories.success && results.categories.data) {
          const cat = results.categories.data;
          this.categories = cat.data ?? (Array.isArray(cat) ? cat : []);
          this.stats.totalCategories = cat.total ?? this.categories.length;
        }
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  getStockPercent(item: any): number {
    const current = item.stock_quantity ?? item.quantity ?? 0;
    const min     = item.min_stock ?? item.minimum_stock ?? 1;
    const max     = item.max_stock ?? (min * 5);
    return Math.min(100, Math.round((current / max) * 100));
  }

  getStockColor(item: any): string {
    const pct = this.getStockPercent(item);
    if (pct <= 20)  return 'danger';
    if (pct <= 50)  return 'warning';
    return 'success';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}