import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule, CardModule, SpinnerModule, BadgeModule } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../core/services/api.service';
import { AlertService } from '../../core/services/alert.service';

interface EntitySummary { key: string; label: string; count: number; }
interface TrashedItem {
  id: number;
  title: string;
  subtitle?: string | null;
  extras?: Record<string, string | number | null>;
  deleted_at: string;
  created_at?: string;
  entity: string;
  label: string;
}

@Component({
  selector: 'app-trash',
  standalone: true,
  imports: [CommonModule, FormsModule, IconDirective, ButtonModule, CardModule, SpinnerModule, BadgeModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trash.component.html',
  styleUrl: './trash.component.scss',
})
export class TrashComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  loading = false;
  summaries: EntitySummary[] = [];
  activeEntity = 'product';
  items: TrashedItem[] = [];
  search = '';
  searchTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private api: ApiService,
    private alert: AlertService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.loadSummary();
    // Permet l'ouverture directe sur un onglet via ?tab=container-arrival, etc.
    const wantedTab = this.route.snapshot.queryParamMap.get('tab');
    this.loadEntity(wantedTab || 'product');
  }

  loadSummary(): void {
    this.api.get<any>('trash')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          if (r.success) this.summaries = r.data || [];
          this.cdr.detectChanges();
        },
        error: () => {},
      });
  }

  loadEntity(key: string): void {
    this.activeEntity = key;
    this.loading = true;
    const params: any = {};
    if (this.search) params.search = this.search;
    this.api.get<any>(`trash/${key}`, { params })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.items = r.success ? (r.data || []) : [];
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading = false; this.cdr.detectChanges(); },
      });
  }

  onSearchChange(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadEntity(this.activeEntity), 300);
  }

  async restore(item: TrashedItem): Promise<void> {
    const res = await this.alert.showConfirmation(
      'Restaurer ?',
      `Restaurer "${item.title}" depuis la corbeille ?`,
      'Restaurer',
      'Annuler',
      'question'
    );
    if (!res.isConfirmed) return;
    this.api.post<any>(`trash/${item.entity}/${item.id}/restore`, {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.alert.showSuccess('Restauré', `${item.label} "${item.title}" restauré.`);
          this.loadEntity(this.activeEntity);
          this.loadSummary();
        },
        error: (e) => this.alert.showError('Erreur', e?.error?.message || 'Échec restauration'),
      });
  }

  async forceDelete(item: TrashedItem): Promise<void> {
    const res = await this.alert.showConfirmation(
      'Supprimer définitivement ?',
      `"${item.title}" sera supprimé définitivement et ne pourra plus être restauré. Continuer ?`,
      'Supprimer définitivement',
      'Annuler',
      'warning'
    );
    if (!res.isConfirmed) return;
    this.api.delete<any>(`trash/${item.entity}/${item.id}/force`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.alert.showSuccess('Supprimé', `${item.label} supprimé définitivement.`);
          this.loadEntity(this.activeEntity);
          this.loadSummary();
        },
        error: (e) => this.alert.showError('Erreur', e?.error?.message || 'Échec suppression'),
      });
  }

  async emptyTrash(): Promise<void> {
    const count = this.items.length;
    if (!count) return;
    const res = await this.alert.showConfirmation(
      'Vider la corbeille ?',
      `Supprimer définitivement les ${count} élément(s) ? Action irréversible.`,
      'Vider',
      'Annuler',
      'warning'
    );
    if (!res.isConfirmed) return;
    this.api.delete<any>(`trash/${this.activeEntity}/empty`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.alert.showSuccess('Vidé', `${r?.data?.deleted || count} élément(s) supprimé(s).`);
          this.loadEntity(this.activeEntity);
          this.loadSummary();
        },
        error: (e) => this.alert.showError('Erreur', e?.error?.message || 'Échec'),
      });
  }

  entityIcon(key: string): string {
    return ({
      // Commerce
      product: 'cilTags', client: 'cilUser', supplier: 'cilTruck',
      invoice: 'cilDescription', payment: 'cilMoney',
      category: 'cilLayers', unit: 'cilStar', expense: 'cilDollar',
      // Conteneurs
      container: 'cilStorage', 'container-arrival': 'cilTruck', 'container-sale': 'cilCart',
      // Immobilier
      location: 'cilLocationPin', building: 'cilHome', floor: 'cilLayers',
      'housing-unit': 'cilHouse', lease: 'cilContrast',
      // Taxi
      driver: 'cilPeople', taxi: 'cilTruck',
      'vehicle-expense': 'cilDollar', 'daily-payment': 'cilCalendar',
      // Banque
      'bank-account': 'cilBank', 'bank-transaction': 'cilTransfer',
    } as any)[key] || 'cilTrash';
  }

  trackByItem(_i: number, it: TrashedItem): string { return `${it.entity}_${it.id}`; }
  trackBySummary(_i: number, s: EntitySummary): string { return s.key; }

  extrasOf(it: TrashedItem): Array<{ k: string; v: string }> {
    if (!it.extras) return [];
    return Object.entries(it.extras)
      .filter(([_, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => ({ k, v: String(v) }));
  }
}
