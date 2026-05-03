import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule, CardModule, SpinnerModule, BadgeModule, RowComponent, ColComponent } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ApiService } from '../../../core/services/api.service';
import { PaymentService, PaymentReceipt } from '../../../core/services/payment.service';
import { AuthService } from '../../../core/services/auth.service';
import { InvoiceHeaderService, InvoiceHeader } from '../../../core/services/invoice-header.service';
import { PdfService } from '../../../core/services/pdf.service';

@Component({
  selector: 'app-payment-detail',
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
  templateUrl: './payment-detail.component.html'
})
export class PaymentDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  receipt: PaymentReceipt | null = null;
  payment: any = null;
  invoiceHeader: InvoiceHeader | null = null;
  loading = false;
  paymentId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private paymentService: PaymentService,
    private invoiceHeaderService: InvoiceHeaderService,
    private pdfService: PdfService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      if (params['id']) {
        this.paymentId = +params['id'];
        this.loadPayment();
        this.loadReceipt();
        this.loadDefaultInvoiceHeader();
      }
    });
  }

  private loadPayment(): void {
    if (!this.paymentId) return;
    this.apiService.get<any>(`payments/${this.paymentId}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.payment = r.success ? r.data : null;
        this.cdr.detectChanges();
      },
      error: () => {
        this.payment = null;
        this.cdr.detectChanges();
      }
    });
  }

  private loadReceipt(): void {
    if (!this.paymentId) return;
    this.loading = true;
    this.paymentService.getReceipt(this.paymentId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.receipt = (r.success ? r.data : null) || null;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.receipt = null;
        this.loading = false;
        this.cdr.detectChanges();
      }
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
    this.router.navigate(['/payments/list']);
  }

  printReceipt(): void {
    if (!this.receipt) return;
    void this.pdfService.generateProfessionalReceiptPdf(this.buildPrintableReceipt());
  }

  downloadReceiptPdf(): void {
    if (!this.receipt) return;
    void this.pdfService.downloadProfessionalReceiptPdf(
      this.buildPrintableReceipt(),
      `recu-${this.receipt.receipt_number}.pdf`
    );
  }

  getTypeLabel(type: string): string {
    return this.paymentService.getTypeLabel(type as any);
  }

  getMethodLabel(method: string): string {
    return this.paymentService.getMethodLabel(method as any);
  }

  getStatusLabel(status: string): string {
    return this.paymentService.getStatusLabel(status as any);
  }

  getStatusColor(status: string): string {
    return ({ COMPLETED: 'success', PENDING: 'warning', FAILED: 'danger', CANCELLED: 'secondary' } as any)[status] || 'secondary';
  }

  private buildPrintableReceipt(): any {
    const tenant = this.authService.currentTenant;
    const header = this.invoiceHeader;
    return {
      receipt_number: this.receipt?.receipt_number || `REC-${this.payment?.id || this.paymentId}`,
      payment_date: this.receipt?.payment_date || this.payment?.payment_date || new Date().toISOString(),
      amount: Number(this.receipt?.amount || this.payment?.amount || 0),
      currency: this.receipt?.currency || this.payment?.currency || 'GNF',
      exchange_rate: Number(this.receipt?.exchange_rate || this.payment?.exchange_rate || 1),
      amount_gnf: Number(this.receipt?.amount_gnf || this.payment?.amount_gnf || 0),
      method: this.receipt?.method || this.payment?.method || 'ESPECES',
      type: this.receipt?.type || this.payment?.type || 'CLIENT',
      reference: this.receipt?.reference || this.payment?.reference || '',
      description: this.receipt?.description || this.payment?.description || '',
      status: this.receipt?.status || this.payment?.status || 'COMPLETED',
      client: this.receipt?.client || (this.payment?.client ? { id: this.payment.client.id, name: this.payment.client.name, phone: this.payment.client.phone } : undefined),
      invoice: this.receipt?.invoice || (this.payment?.invoice ? this.payment.invoice : null),
      organisation: {
        name: header?.company_name || tenant?.name || 'GESTION MULTI-MODULES',
        address: [header?.address, header?.city, header?.country].filter(Boolean).join(' - '),
        phone: header?.phone || tenant?.phone || '',
        email: header?.email || tenant?.email || '',
        footer_text: header?.footer_text || 'Document valable comme justificatif de paiement'
      },
      generated_at: this.receipt?.generated_at || new Date().toISOString()
    };
  }
}
