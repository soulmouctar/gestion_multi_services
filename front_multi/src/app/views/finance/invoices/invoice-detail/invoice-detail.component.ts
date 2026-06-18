import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule, CardModule, SpinnerModule, BadgeModule, RowComponent, ColComponent } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { InvoiceHeaderService, InvoiceHeader } from '../../../../core/services/invoice-header.service';
import { PdfService } from '../../../../core/services/pdf.service';

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [
    CommonModule,
    IconDirective,
    ButtonModule,
    CardModule,
    SpinnerModule,
    BadgeModule,
    RowComponent,
    ColComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoice-detail.component.html'
})
export class InvoiceDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  invoice: any = null;
  invoiceHeader: InvoiceHeader | null = null;
  loading = false;
  invoiceId: number | null = null;
  // Arriéré client recalculé à la date du jour (hors facture courante)
  currentArrears: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private invoiceHeaderService: InvoiceHeaderService,
    private pdfService: PdfService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      if (params['id']) {
        this.invoiceId = +params['id'];
        this.loadInvoice();
        this.loadDefaultInvoiceHeader();
      }
    });
  }

  private loadInvoice(): void {
    if (!this.invoiceId) return;

    this.loading = true;
    this.apiService.get<any>(`invoices/${this.invoiceId}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.invoice = response.data;
          this.loadCurrentArrears();
        } else {
          this.invoice = null;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.invoice = null;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Rafraîchit le solde arriéré du client à la date du jour (hors facture courante).
   * Utilisé pour afficher dans le PDF un montant à jour plutôt que la valeur stockée
   * au moment de la création de la facture.
   */
  private loadCurrentArrears(): void {
    const clientId = this.invoice?.client?.id || this.invoice?.client_id;
    if (!clientId) return;
    const params = { exclude_invoice_id: this.invoiceId };
    this.apiService.get<any>(`clients/${clientId}/outstanding-balance`, { params })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          if (r?.success && r.data) this.currentArrears = Number(r.data.balance) || 0;
          this.cdr.detectChanges();
        },
        error: () => { /* fallback silencieux : on garde la valeur historique */ }
      });
  }

  private loadDefaultInvoiceHeader(): void {
    this.invoiceHeaderService.getHeaders({ is_default: true, per_page: 1 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const headers = Array.isArray(response.data) ? response.data : (response.data.data || response.data || []);
          this.invoiceHeader = headers?.[0] || null;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.invoiceHeader = null;
        this.cdr.detectChanges();
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/finance/invoices']);
  }

  printInvoice(): void {
    if (!this.invoice) return;
    void this.pdfService.generateProfessionalInvoicePdf(this.buildPrintableInvoice());
  }

  downloadInvoicePdf(): void {
    if (!this.invoice) return;
    const filename = `facture-${this.invoice?.invoice_number || this.invoice?.id || 'invoice'}.pdf`;
    void this.pdfService.downloadProfessionalInvoicePdf(this.buildPrintableInvoice(), filename);
  }

  getClientName(): string {
    return this.invoice?.client?.name || this.invoice?.client_name || '—';
  }

  getStatusColor(status: string): string {
    return ({ PAYE: 'success', PARTIEL: 'warning', IMPAYE: 'danger' } as Record<string, string>)[status] || 'secondary';
  }

  getStatusLabel(status: string): string {
    return ({ PAYE: 'Payée', PARTIEL: 'Partielle', IMPAYE: 'Impayée' } as Record<string, string>)[status] || status;
  }

  getLineTotal(item: any): number {
    return Number(item.line_total || item.total || (Number(item.quantity || 0) * Number(item.unit_price || 0)));
  }

  private buildPrintableInvoice(): any {
    const tenant = this.authService.currentTenant;
    const header = this.invoiceHeader;
    const items = Array.isArray(this.invoice?.items) ? this.invoice.items.map((item: any) => ({
      description: item.description || item.product?.name || 'Ligne de facture',
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unit_price || 0),
      total: this.getLineTotal(item)
    })) : [];

    const subtotal = Number(this.invoice?.items_subtotal_amount || 0);
    // Si on a un solde recalculé à aujourd'hui, on l'utilise ; sinon on retombe sur la valeur stockée.
    const arrears = this.currentArrears !== null
      ? this.currentArrears
      : Number(this.invoice?.previous_balance_amount || 0);
    const total = this.currentArrears !== null
      ? subtotal + arrears
      : Number(this.invoice?.total_amount || 0);

    return {
      invoiceNumber: this.invoice?.invoice_number || `INV-${this.invoice?.id}`,
      date: this.invoice?.created_at || new Date(),
      dueDate: this.invoice?.due_date || new Date(),
      clientName: this.getClientName(),
      clientAddress: this.invoice?.client?.address || '',
      clientPhone: this.invoice?.client?.phone1 || this.invoice?.client?.phone || '',
      clientEmail: this.invoice?.client?.email || '',
      organisation: {
        name: header?.company_name || tenant?.name || 'MATKOLLA',
        address: [header?.address, header?.city, header?.country].filter(Boolean).join(' - '),
        phone: header?.phone || tenant?.phone || '',
        email: header?.email || tenant?.email || '',
        motto: header?.footer_text || 'Facturation détaillée et transparente',
        logoUrl: header?.logo_url || '',
        signatureUrl: header?.signature_url || '',
        stampUrl: header?.stamp_url || '',
        footerText: header?.footer_text || ''
      },
      items,
      subtotal,
      previousBalance: arrears,
      total,
      currency: this.invoice?.currency || 'GNF',
      exchangeRate: Number(this.invoice?.exchange_rate || 1),
      totalGnf: Number(this.invoice?.total_amount_gnf || 0),
      status: this.invoice?.status || 'IMPAYE',
      notes: this.invoice?.notes || ''
    };
  }
}
