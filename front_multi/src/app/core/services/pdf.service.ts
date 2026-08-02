import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface PrintableInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface PrintableOrganisation {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  motto?: string;
  logoUrl?: string;
  signatureUrl?: string;
  stampUrl?: string;
  footerText?: string;
}

interface PrintableInvoiceData {
  invoiceNumber: string;
  date?: string | Date;
  dueDate?: string | Date;
  clientName: string;
  clientAddress?: string;
  clientPhone?: string;
  clientEmail?: string;
  organisation?: PrintableOrganisation;
  items: PrintableInvoiceItem[];
  subtotal: number;
  previousBalance?: number;
  total: number;
  currency: string;
  exchangeRate?: number;
  totalGnf?: number;
  status?: string;
  notes?: string;
}

export interface PrintableSalesSummary {
  summary: {
    invoices_count: number;
    items_count?: number;
    samples_count?: number;
    total_revenue_gnf: number;
    total_cost_gnf: number;
    total_margin_gnf: number;
    margin_pct: number | null;
    total_revenue_native?: number;
    total_cost_native?: number;
  };
  invoices: Array<{
    id: number; invoice_number: string; date: string;
    client: { name: string } | null;
    currency: string; status: string;
    revenue: number; cost: number; margin: number; margin_pct: number | null;
  }>;
  period?: { from?: string; to?: string };
  organisation?: PrintableOrganisation;
}

export interface PrintableExpenseStats {
  summary?: { total_count?: number; total_amount?: number; avg_amount?: number };
  by_category?: Array<{ category_name: string; count: number; total: number }>;
  top_expenses?: Array<{ title: string; expense_date: string; amount: number; currency?: string; category_name?: string }>;
  period?: { from?: string; to?: string };
  organisation?: PrintableOrganisation;
}

export interface PrintableClientFinancialOverview {
  summary?: any;
  rows: any[];
  filters?: { search?: string; client_type?: string; status?: string };
  organisation?: PrintableOrganisation;
}

export interface PrintableContainerClientAccount {
  client?: any;
  stats?: any;
  sales: any[];
  payments: any[];
  advances: any[];
  organisation?: PrintableOrganisation;
}

export interface PrintableRentalPaymentReceipt {
  receipt_number: string;
  payment_date?: string | Date;
  period_month?: string;
  amount: number;
  currency: string;
  payment_method?: string;
  reference?: string | null;
  status?: string;
  notes?: string | null;
  generated_at?: string | Date;
  lease?: any;
  organisation?: PrintableOrganisation;
}

export interface PrintableLedgerData {
  client: { id: number; name: string; client_type?: string; phone1?: string; email?: string; address?: string };
  summary: {
    total_debit_gnf: number; total_credit_gnf: number; final_balance_gnf: number;
    total_debit_usd: number; total_credit_usd: number; final_balance_usd: number;
    has_usd: boolean; rows_count: number;
    // Dynamique multi-devises
    currencies?: string[];
    by_currency?: Record<string, { total_debit: number; total_credit: number; final_balance: number }>;
  };
  rows: Array<{
    date: string; type: string; type_label: string; designation: string;
    quantity: number | null; currency: string;
    debit_gnf: number; credit_gnf: number; balance_gnf: number;
    debit_usd: number; credit_usd: number; balance_usd: number;
    by_currency?: Record<string, { debit: number; credit: number; balance: number }>;
    reference: string | null;
    // Preuve de conversion multi-devises (paiements)
    exchange_rate?: number | null;
    target_currency?: string | null;
    converted_amount?: number | null;
    native_amount?: number | null;
    native_currency?: string | null;
  }>;
  period?: { from?: string; to?: string };
  organisation?: PrintableOrganisation;
}

export interface VersementEntry {
  amount: number;
  currency: string;
  target_currency?: string | null;
  converted_amount?: number | null;
  exchange_rate?: number | null;
  amount_gnf?: number | null;
  target_account_label?: string | null;
}

export interface PrintableVersementReceiptData {
  receipt_number: string;
  payment_date: string | Date;
  method: string;
  reference?: string | null;
  description?: string | null;
  client: { id: number; name: string; phone?: string | null; address?: string | null };
  entries: VersementEntry[];
  totals_by_currency: Array<{ currency: string; total: number }>;
  // Devise principale du versement : la devise unique si mono-devise sans conversion, sinon GNF
  primary_currency: string;
  // Montant total exprimé dans la devise principale
  total_amount: number;
  // Équivalent GNF (utile pour affichage secondaire uniquement si conversion réelle)
  total_gnf: number;
  arrears?: {
    currency: string;
    previous_balance: number;
    payment_amount: number;
    remaining_balance: number;
  } | null;
  organisation: PrintableOrganisation & { footer_text?: string };
  generated_at?: string;
}

interface PrintableReceiptData {
  receipt_number: string;
  payment_date: string;
  amount: number;
  currency: string;
  exchange_rate?: number;
  amount_gnf?: number;
  method: string;
  type: string;
  reference?: string;
  description?: string;
  status: string;
  client?: { id: number; name: string; phone?: string };
  invoice?: {
    id: number;
    invoice_number: string;
    total_amount: number;
    paid_amount: number;
    remaining_balance: number;
    status: string;
  } | null;
  organisation: { name: string; address?: string; phone?: string; email?: string; footer_text?: string; logoUrl?: string };
  generated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  private readonly API_URL = environment.apiUrl;
  private bundledPdfMake: any | null = null;

  constructor(private http: HttpClient) {}

  generatePdfFromApi(endpoint: string, data: any): Observable<Blob> {
    return this.http.post(`${this.API_URL}/${endpoint}`, data, {
      responseType: 'blob'
    }).pipe(
      catchError(error => this.handleError(error))
    );
  }

  generateInvoicePdf(invoiceData: any): Observable<Blob> {
    return this.generatePdfFromApi('pdf/invoice', invoiceData);
  }

  async generateProfessionalInvoicePdf(invoiceData: PrintableInvoiceData): Promise<void> {
    await this.generateProfessionalInvoicePdfWithMode(invoiceData, 'print');
  }

  async downloadProfessionalInvoicePdf(invoiceData: PrintableInvoiceData, filename?: string): Promise<void> {
    await this.generateProfessionalInvoicePdfWithMode(invoiceData, 'download', filename);
  }

  private async generateProfessionalInvoicePdfWithMode(
    invoiceData: PrintableInvoiceData,
    mode: 'print' | 'download',
    filename?: string
  ): Promise<void> {
    // Fallback : si pas de logo organisation, on utilise le logo MatKolla
    const MATKOLLA_LOGO = 'assets/images/logo/logo_matkolletf.png';
    const orgLogo = await this.resolveImageData(invoiceData.organisation?.logoUrl);
    const [logo, signature, stamp] = await Promise.all([
      orgLogo ? Promise.resolve(orgLogo) : this.resolveImageData(MATKOLLA_LOGO),
      this.resolveImageData(invoiceData.organisation?.signatureUrl),
      this.resolveImageData(invoiceData.organisation?.stampUrl)
    ]);
    const pdfMake = await this.getPdfMake();
    if (pdfMake?.createPdf) {
      const docDefinition = this.buildProfessionalInvoiceDocDefinition(invoiceData, { logo, signature, stamp });
      const pdf = pdfMake.createPdf(docDefinition);
      if (mode === 'download') {
        pdf.download(filename || `facture-${invoiceData.invoiceNumber}.pdf`);
      } else {
        pdf.print();
      }
      return;
    }

    throw new Error('pdfmake non initialisé: polices Roboto indisponibles');
  }

  async generateProfessionalReceiptPdf(receiptData: PrintableReceiptData): Promise<void> {
    await this.generateProfessionalReceiptPdfWithMode(receiptData, 'print');
  }

  async downloadProfessionalReceiptPdf(receiptData: PrintableReceiptData, filename?: string): Promise<void> {
    await this.generateProfessionalReceiptPdfWithMode(receiptData, 'download', filename);
  }

  private async generateProfessionalReceiptPdfWithMode(
    receiptData: PrintableReceiptData,
    mode: 'print' | 'download',
    filename?: string
  ): Promise<void> {
    const pdfMake = await this.getPdfMake();
    if (!pdfMake?.createPdf) {
      this.openPrintWindow(`Reçu ${receiptData.receipt_number}`, this.buildSimpleReceiptHtml({
        title: 'Reçu de paiement',
        receiptNumber: receiptData.receipt_number,
        date: new Date(receiptData.payment_date),
        amount: receiptData.amount,
        currency: receiptData.currency,
        paymentMethod: receiptData.method,
        clientName: receiptData.client?.name,
        description: receiptData.description
      }));
      return;
    }

    // Logo tenant en fallback MatKolla
    const MATKOLLA_LOGO = 'assets/images/logo/logo_matkolletf.png';
    const orgLogo = await this.resolveImageData((receiptData.organisation as any)?.logoUrl);
    const logo = orgLogo || await this.resolveImageData(MATKOLLA_LOGO);

    const docDefinition = this.buildProfessionalReceiptDocDefinition(receiptData, { logo });
    const pdf = pdfMake.createPdf(docDefinition);
    if (mode === 'download') {
      pdf.download(filename || `recu-${receiptData.receipt_number}.pdf`);
    } else {
      pdf.print();
    }
  }

  generateReceiptPdf(receiptData: any): Observable<Blob> {
    return this.generatePdfFromApi('pdf/receipt', receiptData);
  }

  async printVersementReceiptPdf(data: PrintableVersementReceiptData): Promise<void> {
    await this.generateVersementReceiptPdfWithMode(data, 'print');
  }

  async downloadVersementReceiptPdf(data: PrintableVersementReceiptData, filename?: string): Promise<void> {
    await this.generateVersementReceiptPdfWithMode(data, 'download', filename);
  }

  private async generateVersementReceiptPdfWithMode(
    data: PrintableVersementReceiptData,
    mode: 'print' | 'download',
    filename?: string,
  ): Promise<void> {
    const pdfMake = await this.getPdfMake();
    if (!pdfMake?.createPdf) {
      this.openPrintWindow(`Reçu ${data.receipt_number}`, this.buildSimpleReceiptHtml({
        title: 'Reçu de versement',
        receiptNumber: data.receipt_number,
        date: new Date(data.payment_date as any),
        amount: data.total_gnf,
        currency: 'GNF',
        paymentMethod: data.method,
        clientName: data.client?.name,
        description: data.description || undefined,
      }));
      return;
    }

    const MATKOLLA_LOGO = 'assets/images/logo/logo_matkolletf.png';
    const orgLogo = await this.resolveImageData(data.organisation?.logoUrl);
    const logo = orgLogo || await this.resolveImageData(MATKOLLA_LOGO);

    const docDefinition = this.buildVersementReceiptDocDefinition(data, { logo });
    const pdf = pdfMake.createPdf(docDefinition);
    if (mode === 'download') {
      pdf.download(filename || `recu-versement-${data.receipt_number}.pdf`);
    } else {
      pdf.print();
    }
  }

  private buildVersementReceiptDocDefinition(
    data: PrintableVersementReceiptData,
    assets: { logo?: string | null } = {},
  ): any {
    const primaryCurrency = (data.primary_currency || 'GNF').toUpperCase();
    const isNativeMode = primaryCurrency !== 'GNF';
    const totalPrimary = Number(data.total_amount ?? data.total_gnf ?? 0);
    const totalGnf = Number(data.total_gnf || 0);

    const hasArrears = !!data.arrears;
    const arrearsCurrency = (data.arrears?.currency || primaryCurrency || 'GNF').toUpperCase();
    const previousBalance = Number(data.arrears?.previous_balance || 0);
    const remainingBalance = Number(data.arrears?.remaining_balance || 0);
    const paymentAmount = Number(data.arrears?.payment_amount || totalPrimary || 0);

    const equivHeader = isNativeMode ? `Équiv. ${primaryCurrency}` : 'Équiv. GNF';
    const entriesHeader = [
      { text: 'Montant reçu', style: 'thCell' },
      { text: 'Devise', style: 'thCell', alignment: 'center' },
      { text: 'Vers', style: 'thCell', alignment: 'center' },
      { text: 'Taux', style: 'thCell', alignment: 'right' },
      { text: 'Converti', style: 'thCell', alignment: 'right' },
      { text: equivHeader, style: 'thCell', alignment: 'right' },
    ];
    const entriesBody = [entriesHeader as any];
    for (const e of data.entries || []) {
      const noConversion = !e.target_currency || e.target_currency === e.currency;
      const equivalent = noConversion
        ? (e.currency === primaryCurrency
            ? this.formatMoney(e.amount, primaryCurrency)
            : '—')
        : (isNativeMode
            ? '—'
            : (e.amount_gnf != null ? this.formatMoney(e.amount_gnf, 'GNF') : '—'));
      entriesBody.push([
        { text: this.formatMoney(e.amount, e.currency), style: 'tdCell' },
        { text: e.currency, style: 'tdCell', alignment: 'center' },
        { text: noConversion ? '—' : (e.target_currency as string), style: 'tdCell', alignment: 'center' },
        { text: e.exchange_rate ? String(e.exchange_rate) : '—', style: 'tdCell', alignment: 'right' },
        { text: (!noConversion && e.converted_amount != null && e.target_currency)
            ? this.formatMoney(e.converted_amount, e.target_currency)
            : '—', style: 'tdCell', alignment: 'right' },
        { text: equivalent, style: 'tdCell', alignment: 'right', bold: true },
      ] as any);
    }

    const totalsRow = [
      { text: 'TOTAL', style: 'totalCell', colSpan: 5 }, {}, {}, {}, {},
      { text: this.formatMoney(totalPrimary, primaryCurrency), style: 'totalCell', alignment: 'right' },
    ];
    entriesBody.push(totalsRow as any);

    const totalsByCurrencyText = (data.totals_by_currency || [])
      .map(t => `${this.formatMoney(t.total, t.currency)} ${t.currency}`)
      .join('   ·   ');

    return {
      pageSize: 'A4',
      pageMargins: [36, 128, 36, 60],
      defaultStyle: { font: 'Roboto', fontSize: 9, color: '#111827' },
      styles: {
        titleSmall: { fontSize: 10, color: '#BFDBFE', bold: true, characterSpacing: 1.4 },
        titleLarge: { fontSize: 26, bold: true, color: '#FFFFFF' },
        headerMeta: { fontSize: 11, color: '#DCE7F5' },
        sectionTitle: { fontSize: 11, bold: true, color: '#0F3460', characterSpacing: 0.6 },
        thCell: { fontSize: 9, bold: true, color: '#0F3460', fillColor: '#EFF6FF', margin: [6, 6, 6, 6] },
        tdCell: { fontSize: 9, color: '#111827', margin: [6, 5, 6, 5] },
        totalCell: { fontSize: 10, bold: true, color: '#065F46', fillColor: '#ECFDF5', margin: [6, 7, 6, 7] },
      },
      header: () => ({
        margin: [0, 0, 0, 0],
        stack: [
          {
            canvas: [
              { type: 'rect', x: 0, y: 0, w: 595.28, h: 110, color: '#0F172A' },
              { type: 'rect', x: 0, y: 110, w: 595.28, h: 4, color: '#10B981' },
            ],
          },
          {
            margin: [36, -88, 36, 0],
            columns: [
              {
                width: 110,
                stack: assets.logo ? [
                  { image: assets.logo, fit: [100, 72], alignment: 'left', margin: [0, 0, 0, 4] },
                ] : [
                  { text: 'MK', fontSize: 28, bold: true, color: '#FFFFFF', margin: [0, 8, 0, 0] },
                ],
              },
              {
                width: '*',
                margin: [10, 4, 0, 0],
                stack: [
                  { text: 'REÇU DE VERSEMENT', style: 'titleSmall' },
                  { text: data.organisation?.name || 'MATKOLLA', fontSize: 14, bold: true, color: '#FFFFFF', margin: [0, 6, 0, 0] },
                  { text: data.organisation?.address || '', style: 'headerMeta', margin: [0, 4, 0, 0] },
                  {
                    text: `${data.organisation?.phone || ''}${data.organisation?.phone && data.organisation?.email ? ' • ' : ''}${data.organisation?.email || ''}`,
                    style: 'headerMeta',
                    margin: [0, 3, 0, 0],
                  },
                ],
              },
              {
                width: 175,
                alignment: 'right',
                stack: [
                  { text: 'REÇU', style: 'titleLarge', alignment: 'right' },
                  { text: `N° ${data.receipt_number}`, style: 'headerMeta', alignment: 'right', margin: [0, 6, 0, 0] },
                  { text: `Date: ${this.formatDate(data.payment_date)}`, style: 'headerMeta', alignment: 'right', margin: [0, 4, 0, 0] },
                ],
              },
            ],
          },
        ],
      }),
      footer: (currentPage: number, pageCount: number) => ({
        margin: [36, 0, 36, 18],
        columns: [
          {
            width: '*',
            text: data.organisation?.footer_text || 'Document valable comme justificatif de versement',
            fontSize: 8.5,
            color: '#64748B',
          },
          { width: 'auto', text: `Page ${currentPage} / ${pageCount}`, fontSize: 8.5, color: '#64748B' },
        ],
      }),
      content: [
        {
          columns: [
            {
              width: '58%',
              stack: [
                { text: 'CLIENT', style: 'sectionTitle', margin: [0, 0, 0, 8] },
                {
                  table: { widths: ['*'], body: [[{
                    stack: [
                      { text: data.client?.name || '—', bold: true, fontSize: 13, color: '#111827' },
                      { text: data.client?.phone || '', margin: [0, 4, 0, 0], color: '#475569' },
                      { text: data.client?.address || '', margin: [0, 2, 0, 0], color: '#475569' },
                    ],
                    margin: [12, 12, 12, 12],
                  }]] },
                  layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB' },
                },
              ],
            },
            {
              width: '42%',
              stack: [
                { text: 'VERSEMENT', style: 'sectionTitle', margin: [0, 0, 0, 8] },
                {
                  table: { widths: ['*'], body: [[{
                    stack: [
                      { text: this.formatMoney(totalPrimary, primaryCurrency), bold: true, fontSize: 20, color: '#10B981', alignment: 'center' },
                      isNativeMode && Math.abs(totalGnf - totalPrimary) > 0.5
                        ? { text: `≈ ${this.formatMoney(totalGnf, 'GNF')}`, alignment: 'center', color: '#94A3B8', fontSize: 8, margin: [0, 2, 0, 0] }
                        : { text: '' },
                      { text: totalsByCurrencyText || '', alignment: 'center', color: '#475569', fontSize: 8.5, margin: [0, 4, 0, 0] },
                      { text: `Mode: ${data.method}`, alignment: 'center', color: '#475569', margin: [0, 6, 0, 0] },
                      data.reference ? { text: `Réf.: ${data.reference}`, alignment: 'center', color: '#475569', margin: [0, 2, 0, 0] } : { text: '' },
                    ],
                    margin: [12, 14, 12, 14],
                  }]] },
                  layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => '#F8FAFC' },
                },
              ],
            },
          ],
        },

        { text: 'DÉTAIL DES LIGNES DE VERSEMENT', style: 'sectionTitle', margin: [0, 18, 0, 6] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', '*', '*'],
            body: entriesBody,
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#E5E7EB',
          },
        },

        hasArrears ? { text: `SITUATION CLIENT — Compte ${arrearsCurrency}`, style: 'sectionTitle', margin: [0, 18, 0, 6] } : { text: '' },
        hasArrears ? {
          table: {
            widths: ['*', 'auto'],
            body: [
              [
                { text: 'Ancien solde (arriéré)', color: '#475569', margin: [10, 8, 10, 8] },
                { text: this.formatMoney(previousBalance, arrearsCurrency), alignment: 'right', bold: true, color: previousBalance > 0 ? '#EF4444' : '#10B981', margin: [10, 8, 10, 8] },
              ],
              [
                { text: 'Ce versement', color: '#475569', margin: [10, 8, 10, 8] },
                { text: `− ${this.formatMoney(paymentAmount, arrearsCurrency)}`, alignment: 'right', bold: true, color: '#10B981', margin: [10, 8, 10, 8] },
              ],
              [
                { text: 'Nouveau solde restant', color: '#0F3460', bold: true, margin: [10, 10, 10, 10], fillColor: '#F0F9FF' },
                { text: this.formatMoney(remainingBalance, arrearsCurrency), alignment: 'right', bold: true, color: remainingBalance > 0 ? '#EF4444' : '#10B981', fontSize: 12, margin: [10, 10, 10, 10], fillColor: '#F0F9FF' },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#E5E7EB',
            vLineColor: () => '#E5E7EB',
          },
        } : { text: '' },

        data.description ? {
          margin: [0, 14, 0, 0],
          table: { widths: ['*'], body: [[{
            stack: [
              { text: 'NOTE', style: 'sectionTitle', margin: [0, 0, 0, 4] },
              { text: data.description, color: '#374151' },
            ],
            margin: [12, 10, 12, 10],
          }]] },
          layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => '#FFFBEB' },
        } : { text: '' },

        {
          margin: [0, 24, 0, 0],
          columns: [
            {
              width: '50%',
              stack: [
                { text: 'SIGNATURE CLIENT', style: 'sectionTitle', margin: [0, 0, 0, 8] },
                {
                  table: { widths: ['*'], body: [[{
                    stack: [
                      { text: ' ', color: '#FFFFFF', margin: [0, 18, 0, 18] },
                      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 170, y2: 0, lineWidth: 0.5, lineColor: '#94A3B8' }], margin: [0, 8, 0, 4] },
                      { text: data.client?.name || '—', bold: true, color: '#0F3460', fontSize: 9.4 },
                    ],
                    margin: [14, 16, 14, 14],
                  }]] },
                  layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB', fillColor: () => '#FFFFFF' },
                },
              ],
            },
            {
              width: '50%',
              margin: [8, 0, 0, 0],
              stack: [
                { text: 'CACHET / CAISSE', style: 'sectionTitle', margin: [0, 0, 0, 8] },
                {
                  table: { widths: ['*'], body: [[{
                    stack: [
                      { text: ' ', color: '#FFFFFF', margin: [0, 18, 0, 18] },
                      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 170, y2: 0, lineWidth: 0.5, lineColor: '#94A3B8' }], margin: [0, 8, 0, 4] },
                      { text: data.organisation?.name || 'MATKOLLA', bold: true, color: '#0F3460', fontSize: 9.4 },
                    ],
                    margin: [14, 16, 14, 14],
                  }]] },
                  layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB', fillColor: () => '#FFFFFF' },
                },
              ],
            },
          ],
        },

        {
          margin: [0, 18, 0, 0],
          text: data.organisation?.footer_text || 'Merci pour votre confiance. Ce reçu fait foi de versement.',
          fontSize: 8.6,
          color: '#94A3B8',
          alignment: 'center',
          italics: true,
        },
        {
          margin: [0, 4, 0, 0],
          text: `Généré le ${data.generated_at || this.formatDate(new Date())}`,
          fontSize: 7.5,
          color: '#94A3B8',
          alignment: 'center',
        },
      ],
    };
  }

  // ── Grand livre client (compte client) ────────────────────────────────────
  async downloadProfessionalLedgerPdf(ledgerData: PrintableLedgerData, filename?: string): Promise<void> {
    await this.generateLedgerPdfWithMode(ledgerData, 'download', filename);
  }
  async printProfessionalLedgerPdf(ledgerData: PrintableLedgerData): Promise<void> {
    await this.generateLedgerPdfWithMode(ledgerData, 'print');
  }

  private async generateLedgerPdfWithMode(
    ledgerData: PrintableLedgerData,
    mode: 'print' | 'download',
    filename?: string
  ): Promise<void> {
    const pdfMake = await this.getPdfMake();
    if (!pdfMake?.createPdf) {
      console.warn('pdfmake non disponible');
      return;
    }
    const MATKOLLA_LOGO = 'assets/images/logo/logo_matkolletf.png';
    const orgLogo = await this.resolveImageData(ledgerData.organisation?.logoUrl);
    const logo = orgLogo || await this.resolveImageData(MATKOLLA_LOGO);

    const docDefinition = this.buildProfessionalLedgerDocDefinition(ledgerData, { logo });
    const pdf = pdfMake.createPdf(docDefinition);
    if (mode === 'download') {
      pdf.download(filename || `compte-client-${ledgerData.client.name.replace(/\s+/g, '_')}.pdf`);
    } else {
      pdf.print();
    }
  }

  private buildProfessionalLedgerDocDefinition(
    data: PrintableLedgerData,
    assets: { logo?: string | null } = {}
  ): any {
    const fmtNum = (v: number | null | undefined) =>
      v === null || v === undefined ? '—'
      : this.normalizeSpaces(new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(Number(v) || 0));

    // Devises effectivement présentes (GNF toujours en premier).
    const rawCurrencies: string[] = (data.summary.currencies && data.summary.currencies.length)
      ? [...data.summary.currencies]
      : (data.summary.has_usd ? ['GNF', 'USD'] : ['GNF']);
    const currencies = rawCurrencies.slice().sort((a, b) => a === 'GNF' ? -1 : b === 'GNF' ? 1 : a.localeCompare(b));
    const hasMultipleCurrencies = currencies.length > 1;
    const summaryRows = currencies.map(c => {
      const total = totalFor(c);
      return [
        { text: c, style: 'tableCell', bold: true, color: '#0F3460' },
        { text: fmtNum(total.debit), style: 'tableCell', alignment: 'right', color: '#DC2626' },
        { text: fmtNum(total.credit), style: 'tableCell', alignment: 'right', color: '#16A34A' },
        { text: fmtNum(total.balance), style: 'tableCell', alignment: 'right', bold: true, color: this.balanceColor(total.balance) },
      ];
    });

    const cellFor = (r: any, c: string): { debit: number; credit: number; balance: number } => {
      if (r.by_currency && r.by_currency[c]) return r.by_currency[c];
      // Fallback : anciens champs GNF/USD explicites.
      if (c === 'GNF') return { debit: r.debit_gnf || 0, credit: r.credit_gnf || 0, balance: r.balance_gnf || 0 };
      if (c === 'USD') return { debit: r.debit_usd || 0, credit: r.credit_usd || 0, balance: r.balance_usd || 0 };
      return { debit: 0, credit: 0, balance: 0 };
    };
    const totalFor = (c: string): { debit: number; credit: number; balance: number } => {
      const bc = data.summary.by_currency?.[c];
      if (bc) return { debit: bc.total_debit, credit: bc.total_credit, balance: bc.final_balance };
      if (c === 'GNF') return { debit: data.summary.total_debit_gnf || 0, credit: data.summary.total_credit_gnf || 0, balance: data.summary.final_balance_gnf || 0 };
      if (c === 'USD') return { debit: data.summary.total_debit_usd || 0, credit: data.summary.total_credit_usd || 0, balance: data.summary.final_balance_usd || 0 };
      return { debit: 0, credit: 0, balance: 0 };
    };

    const headerRow: any[] = [
      { text: 'Date', style: 'tableHeader' },
      { text: 'Type', style: 'tableHeader' },
      { text: 'Désignation', style: 'tableHeader' },
      { text: 'Qté', style: 'tableHeader', alignment: 'center' },
    ];
    for (const c of currencies) {
      headerRow.push(
        { text: `Débit ${c}`, style: 'tableHeader', alignment: 'right' },
        { text: `Crédit ${c}`, style: 'tableHeader', alignment: 'right' },
        { text: `Solde ${c}`, style: 'tableHeader', alignment: 'right' },
      );
    }

    const bodyRows = data.rows.map((r) => {
      const hasFx = !!r.exchange_rate && !!r.target_currency && r.currency !== r.target_currency;
      const designationCell = hasFx
        ? {
            style: 'tableCell',
            stack: [
              { text: r.designation || '' },
              {
                text: `${fmtNum(r.native_amount)} ${r.currency}  →  ${fmtNum(r.converted_amount)} ${r.target_currency}   ·   Taux : ${r.exchange_rate}`,
                fontSize: 7.4,
                color: '#1D4ED8',
                margin: [0, 2, 0, 0],
              },
            ],
          }
        : { text: r.designation || '', style: 'tableCell' };
      const row: any[] = [
        { text: this.formatDate(r.date), style: 'tableCell' },
        { text: r.type_label || r.type, style: 'tableCell' },
        designationCell,
        { text: r.quantity != null ? String(r.quantity) : '—', style: 'tableCell', alignment: 'center' },
      ];
      for (const c of currencies) {
        const cell = cellFor(r, c);
        row.push(
          { text: cell.debit > 0 ? fmtNum(cell.debit) : '—', style: 'tableCell', alignment: 'right', color: cell.debit > 0 ? '#DC2626' : '#9CA3AF' },
          { text: cell.credit > 0 ? fmtNum(cell.credit) : '—', style: 'tableCell', alignment: 'right', color: cell.credit > 0 ? '#16A34A' : '#9CA3AF' },
          { text: fmtNum(cell.balance), style: 'tableCell', alignment: 'right', bold: true,
            color: cell.balance > 0 ? '#DC2626' : cell.balance < 0 ? '#16A34A' : '#0F3460' },
        );
      }
      return row;
    });

    // Largeurs : plus la table a de colonnes, plus on privilégie le format paysage.
    const useLandscape = hasMultipleCurrencies;
    const currencyCols = currencies.length * 3;
    const widths: any[] = useLandscape
      ? [54, 52, '*', 24, ...Array(currencyCols).fill(52)]
      : [60, 60, '*', 30, ...Array(currencyCols).fill(75)];

    return {
      pageSize: 'A4',
      pageOrientation: useLandscape ? 'landscape' : 'portrait',
      pageMargins: [30, 128, 30, 48],
      defaultStyle: { font: 'Roboto', fontSize: 8.5, color: '#111827' },
      styles: {
        titleSmall: { fontSize: 10, color: '#BFDBFE', bold: true, characterSpacing: 1.4 },
        titleLarge: { fontSize: 22, bold: true, color: '#FFFFFF' },
        headerMeta: { fontSize: 10.5, color: '#DCE7F5' },
        sectionTitle: { fontSize: 11, bold: true, color: '#0F3460', characterSpacing: 0.5 },
        tableHeader: { fontSize: 8.6, bold: true, color: '#FFFFFF' },
        tableCell: { fontSize: 8.2, color: '#111827' },
      },
      header: () => ({
        stack: [
          {
            canvas: [
              { type: 'rect', x: 0, y: 0, w: useLandscape ? 842 : 595.28, h: 110, color: '#0F172A' },
              { type: 'rect', x: 0, y: 110, w: useLandscape ? 842 : 595.28, h: 4, color: '#0F3460' },
            ],
          },
          {
            margin: [30, -88, 30, 0],
            columns: [
              {
                width: 110,
                stack: assets.logo
                  ? [{ image: assets.logo, fit: [100, 72], alignment: 'left', margin: [0, 0, 0, 4] }]
                  : [{ text: 'MK', fontSize: 28, bold: true, color: '#FFFFFF', margin: [0, 8, 0, 0] }],
              },
              {
                width: '*',
                margin: [10, 4, 0, 0],
                stack: [
                  { text: 'GRAND LIVRE CLIENT', style: 'titleSmall' },
                  { text: data.organisation?.name || 'MATKOLLA', fontSize: 14, bold: true, color: '#FFFFFF', margin: [0, 6, 0, 0] },
                  { text: data.organisation?.address || '', style: 'headerMeta', margin: [0, 4, 0, 0] },
                  {
                    text: `${data.organisation?.phone || ''}${data.organisation?.phone && data.organisation?.email ? ' • ' : ''}${data.organisation?.email || ''}`,
                    style: 'headerMeta', margin: [0, 3, 0, 0],
                  },
                ],
              },
              {
                width: 200, alignment: 'right',
                stack: [
                  { text: 'COMPTE CLIENT', style: 'titleLarge', alignment: 'right' },
                  { text: data.client.name, style: 'headerMeta', alignment: 'right', bold: true, margin: [0, 6, 0, 0] },
                  { text: data.client.client_type || '', style: 'headerMeta', alignment: 'right', margin: [0, 3, 0, 0] },
                  { text: data.period?.from || data.period?.to
                          ? `Du ${this.formatDate(data.period?.from)} au ${this.formatDate(data.period?.to)}`
                          : `Au ${this.formatDate(new Date())}`,
                    style: 'headerMeta', alignment: 'right', margin: [0, 3, 0, 0] },
                ],
              },
            ],
          },
        ],
      }),
      footer: (currentPage: number, pageCount: number) => ({
        margin: [30, 0, 30, 18],
        columns: [
          { width: '*', text: data.organisation?.footerText || `${data.organisation?.name || 'MATKOLLA'} — Compte client`, fontSize: 8, color: '#64748B' },
          { width: 'auto', text: `Page ${currentPage} / ${pageCount}`, fontSize: 8, color: '#64748B' },
        ],
      }),
      content: [
        // Bloc résumé par devise : débit - crédit = solde.
        {
          margin: [0, 0, 0, 14],
          columns: [
            {
              width: '38%',
              table: {
                widths: ['*'],
                body: [
                  [{
                    stack: [
                      { text: data.client.name, fontSize: 13, bold: true, color: '#111827' },
                      { text: [data.client.phone1, data.client.email].filter(Boolean).join(' • ') || '—', fontSize: 8.2, color: '#64748B', margin: [0, 4, 0, 0] },
                      { text: data.client.address || '', fontSize: 8.2, color: '#64748B', margin: [0, 2, 0, 0] },
                    ],
                    margin: [12, 12, 12, 12],
                  }],
                ],
              },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => '#F8FAFC' },
            },
            {
              width: '62%',
              margin: [10, 0, 0, 0],
              table: {
                headerRows: 1,
                widths: ['*', '*', '*', '*'],
                body: [
                  [
                    { text: 'Devise', style: 'tableHeader' },
                    { text: 'Débit', style: 'tableHeader', alignment: 'right' },
                    { text: 'Crédit', style: 'tableHeader', alignment: 'right' },
                    { text: 'Solde', style: 'tableHeader', alignment: 'right' },
                  ],
                  ...summaryRows,
                ],
              },
              layout: {
                fillColor: (rowIndex: number) => rowIndex === 0 ? '#0F3460' : '#F8FAFC',
                hLineColor: () => '#E5E7EB',
                vLineColor: () => '#E5E7EB',
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5,
                paddingLeft: () => 6,
                paddingRight: () => 6,
                paddingTop: () => 6,
                paddingBottom: () => 6,
              },
            },
          ],
        },
        {
          margin: [0, 0, 0, 10],
          table: {
            widths: ['*', '*', '*'],
            body: [[
              this.summaryCell('Opérations imprimées', fmtNum(data.summary.rows_count || data.rows.length), '#0F3460'),
              this.summaryCell('Solde GNF', fmtNum(totalFor('GNF').balance), this.balanceColor(totalFor('GNF').balance)),
              this.summaryCell('Principe', 'Débit - Crédit = Solde', '#64748B'),
            ]],
          },
          layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
        },
        // Tableau principal
        {
          table: {
            headerRows: 1,
            widths,
            body: [headerRow, ...bodyRows],
          },
          layout: {
            fillColor: (rowIndex: number) => rowIndex === 0 ? '#0F3460' : rowIndex % 2 === 0 ? '#F8FAFC' : '#FFFFFF',
            hLineColor: () => '#E5E7EB',
            vLineColor: () => '#E5E7EB',
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            paddingLeft: () => 5,
            paddingRight: () => 5,
            paddingTop: () => 4.5,
            paddingBottom: () => 4.5,
          },
        },
      ],
    };
  }

  private summaryCell(label: string, value: string, valueColor = '#0F3460'): any {
    return {
      fillColor: '#F8FAFC',
      margin: [4, 0, 4, 0],
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: label, fontSize: 8, color: '#64748B', bold: true, characterSpacing: 0.4 },
            { text: value, fontSize: 13, color: valueColor, bold: true, margin: [0, 3, 0, 0] },
          ],
          margin: [10, 8, 10, 8],
        }]],
      },
      layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => '#F8FAFC' },
    };
  }

  // ── Synthèse des ventes (rapport marges) ────────────────────────────────
  async downloadSalesSummaryPdf(data: PrintableSalesSummary, filename?: string): Promise<void> {
    await this.generateSalesSummaryPdfWithMode(data, 'download', filename);
  }

  async printSalesSummaryPdf(data: PrintableSalesSummary): Promise<void> {
    await this.generateSalesSummaryPdfWithMode(data, 'print');
  }

  private async generateSalesSummaryPdfWithMode(
    data: PrintableSalesSummary,
    mode: 'print' | 'download',
    filename?: string
  ): Promise<void> {
    const pdfMake = await this.getPdfMake();
    if (!pdfMake?.createPdf) {
      console.warn('pdfmake non disponible');
      return;
    }
    const MATKOLLA_LOGO = 'assets/images/logo/logo_matkolletf.png';
    const orgLogo = await this.resolveImageData(data.organisation?.logoUrl);
    const logo = orgLogo || await this.resolveImageData(MATKOLLA_LOGO);
    const docDef = this.buildSalesSummaryDoc(data, { logo });
    const pdf = pdfMake.createPdf(docDef);
    if (mode === 'download') {
      pdf.download(filename || `synthese-ventes-${new Date().toISOString().split('T')[0]}.pdf`);
    } else {
      pdf.print();
    }
  }

  private buildSalesSummaryDoc(data: PrintableSalesSummary, assets: { logo?: string | null } = {}): any {
    const fmtNum = (v: number | null | undefined) =>
      v === null || v === undefined ? '—'
      : this.normalizeSpaces(new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(Number(v) || 0));
    const fmtPct = (v: number | null | undefined) =>
      v === null || v === undefined ? '—' : `${Number(v).toFixed(1)} %`;
    const statusLabel = (status: string) => ({
      PAYE: 'Payée',
      PARTIEL: 'Partielle',
      IMPAYE: 'Impayée',
    } as Record<string, string>)[status] || status || '—';
    const periodText = data.period?.from || data.period?.to
      ? `Période du ${this.formatDate(data.period?.from)} au ${this.formatDate(data.period?.to)}`
      : `État arrêté au ${this.formatDate(new Date())}`;
    const marginColor = Number(data.summary.total_margin_gnf || 0) >= 0 ? '#047857' : '#B91C1C';

    const headerRow = [
      { text: 'Date', style: 'th' },
      { text: 'Facture', style: 'th' },
      { text: 'Client', style: 'th' },
      { text: 'Statut', style: 'th', alignment: 'center' },
      { text: 'Devise', style: 'th', alignment: 'center' },
      { text: 'Chiffre affaires', style: 'th', alignment: 'right' },
      { text: 'Coût achat', style: 'th', alignment: 'right' },
      { text: 'Marge', style: 'th', alignment: 'right' },
      { text: 'Marge %', style: 'th', alignment: 'right' },
    ];

    const body = data.invoices.map(inv => [
      { text: this.formatDate(inv.date), style: 'td' },
      { text: inv.invoice_number, style: 'td', bold: true, color: '#0F3460' },
      { text: inv.client?.name || '—', style: 'td' },
      { text: statusLabel(inv.status), style: 'td', alignment: 'center',
        color: inv.status === 'PAYE' ? '#16A34A' : inv.status === 'PARTIEL' ? '#D97706' : '#DC2626' },
      { text: inv.currency || 'GNF', style: 'td', alignment: 'center' },
      { text: fmtNum(inv.revenue), style: 'td', alignment: 'right' },
      { text: fmtNum(inv.cost), style: 'td', alignment: 'right', color: '#B45309' },
      { text: fmtNum(inv.margin), style: 'td', alignment: 'right', bold: true,
        color: inv.margin > 0 ? '#16A34A' : inv.margin < 0 ? '#DC2626' : '#64748B' },
      { text: fmtPct(inv.margin_pct), style: 'td', alignment: 'right', bold: true,
        color: (inv.margin_pct ?? 0) > 0 ? '#16A34A' : '#DC2626' },
    ]);
    const emptyRow = [[
      { text: 'Aucune vente ne correspond aux filtres sélectionnés.', colSpan: 9, alignment: 'center', color: '#64748B', margin: [0, 12, 0, 12] },
      {}, {}, {}, {}, {}, {}, {}, {},
    ]];

    return {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [30, 30, 30, 34],
      info: {
        title: 'Synthèse des ventes',
        subject: periodText,
      },
      defaultStyle: { font: 'Roboto', fontSize: 8.4, color: '#111827' },
      styles: {
        reportTitle: { fontSize: 22, bold: true, color: '#0F3460' },
        orgName: { fontSize: 12.5, bold: true, color: '#111827' },
        muted: { fontSize: 8, color: '#64748B' },
        sectionTitle: { fontSize: 9.4, bold: true, color: '#0F3460', characterSpacing: 0.5 },
        th: { fontSize: 8.1, bold: true, color: '#FFFFFF' },
        td: { fontSize: 7.9, color: '#111827' },
      },
      footer: (p: number, n: number) => ({
        margin: [30, 0, 30, 14],
        columns: [
          { width: '*', text: data.organisation?.footerText || `${data.organisation?.name || 'MATKOLLA'} - Synthèse des ventes`, fontSize: 7.6, color: '#64748B' },
          { width: 'auto', text: `Page ${p} / ${n}`, fontSize: 7.6, color: '#64748B' },
        ],
      }),
      content: [
        {
          columns: [
            {
              width: '*',
              stack: [
                assets.logo
                  ? { image: assets.logo, fit: [110, 54], margin: [0, 0, 0, 7] }
                  : { text: data.organisation?.name || 'MATKOLLA', style: 'orgName', margin: [0, 0, 0, 7] },
                { text: data.organisation?.name || 'MATKOLLA', style: 'orgName' },
                { text: data.organisation?.address || '', style: 'muted', margin: [0, 3, 0, 0] },
                { text: [data.organisation?.phone, data.organisation?.email].filter(Boolean).join(' | '), style: 'muted', margin: [0, 3, 0, 0] },
              ],
            },
            {
              width: 300,
              stack: [
                { text: 'SYNTHÈSE DES VENTES', style: 'reportTitle', alignment: 'right' },
                { text: periodText, style: 'muted', alignment: 'right', margin: [0, 6, 0, 0] },
                { text: `Généré le ${this.formatDate(new Date())}`, style: 'muted', alignment: 'right', margin: [0, 3, 0, 0] },
              ],
            },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 782, y2: 0, lineWidth: 1, lineColor: '#E5E7EB' }], margin: [0, 16, 0, 14] },
        {
          margin: [0, 0, 0, 12],
          table: {
            widths: ['*', '*', '*', '*', '*'],
            body: [[
              this.summaryCell('FACTURES', fmtNum(data.summary.invoices_count || data.invoices.length), '#0F3460'),
              this.summaryCell('CHIFFRE AFFAIRES', fmtNum(data.summary.total_revenue_gnf) + ' GNF', '#1D4ED8'),
              this.summaryCell('COÛT D\'ACHAT', fmtNum(data.summary.total_cost_gnf) + ' GNF', '#B45309'),
              this.summaryCell('MARGE BRUTE', fmtNum(data.summary.total_margin_gnf) + ' GNF', marginColor),
              this.summaryCell('MARGE %', fmtPct(data.summary.margin_pct), '#7C3AED'),
            ]],
          },
          layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
        },
        {
          columns: [
            { width: '*', text: `${fmtNum(data.summary.items_count || 0)} article(s) vendus - ${fmtNum(data.summary.samples_count || 0)} échantillon(s)`, style: 'muted' },
            { width: 'auto', text: 'Montants consolidés en GNF', style: 'muted', alignment: 'right' },
          ],
          margin: [0, 0, 0, 9],
        },
        {
          table: { headerRows: 1, widths: [52, 74, '*', 58, 42, 82, 78, 78, 58], body: [headerRow, ...(body.length ? body : emptyRow)] },
          layout: {
            fillColor: (rowIndex: number) => rowIndex === 0 ? '#0F3460' : rowIndex % 2 === 0 ? '#F8FAFC' : '#FFFFFF',
            hLineColor: () => '#E5E7EB',
            vLineWidth: () => 0,
            hLineWidth: () => 0.5,
            paddingLeft: () => 6,
            paddingRight: () => 6,
            paddingTop: () => 6,
            paddingBottom: () => 6,
          },
        },
        {
          margin: [0, 12, 0, 0],
          columns: [
            { width: '*', text: 'PAYE: facture soldée   |   PARTIEL: paiement partiel   |   IMPAYE: solde restant dû', style: 'muted' },
            { width: 'auto', text: `Total lignes: ${fmtNum(data.invoices.length)}`, style: 'muted' },
          ],
        },
      ],
    };
  }

  // ── Statistiques dépenses ───────────────────────────────────────────────
  async downloadExpenseStatsPdf(data: PrintableExpenseStats, filename?: string): Promise<void> {
    const pdfMake = await this.getPdfMake();
    if (!pdfMake?.createPdf) return;
    const MATKOLLA_LOGO = 'assets/images/logo/logo_matkolletf.png';
    const orgLogo = await this.resolveImageData(data.organisation?.logoUrl);
    const logo = orgLogo || await this.resolveImageData(MATKOLLA_LOGO);
    const docDef = this.buildExpenseStatsDoc(data, { logo });
    pdfMake.createPdf(docDef).download(filename || `stats-depenses-${new Date().toISOString().split('T')[0]}.pdf`);
  }

  private buildExpenseStatsDoc(data: PrintableExpenseStats, assets: { logo?: string | null } = {}): any {
    const fmtNum = (v: number | null | undefined) =>
      v === null || v === undefined ? '—'
      : this.normalizeSpaces(new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(Number(v) || 0));

    const categoryRows = (data.by_category || []).map(c => [
      { text: c.category_name, style: 'tableCell' },
      { text: String(c.count || 0), style: 'tableCell', alignment: 'center' },
      { text: fmtNum(c.total) + ' GNF', style: 'tableCell', alignment: 'right', bold: true },
    ]);

    const topRows = (data.top_expenses || []).slice(0, 10).map((e, i) => [
      { text: `#${i + 1}`, style: 'tableCell', bold: true, color: i === 0 ? '#D97706' : '#64748B' },
      { text: this.formatDate(e.expense_date), style: 'tableCell' },
      { text: e.title, style: 'tableCell' },
      { text: e.category_name || '—', style: 'tableCell' },
      { text: fmtNum(e.amount) + ' ' + (e.currency || 'GNF'), style: 'tableCell', alignment: 'right', bold: true, color: '#DC2626' },
    ]);

    return {
      pageSize: 'A4',
      pageMargins: [36, 128, 36, 48],
      defaultStyle: { font: 'Roboto', fontSize: 9, color: '#111827' },
      styles: {
        titleSmall: { fontSize: 10, color: '#BFDBFE', bold: true, characterSpacing: 1.4 },
        titleLarge: { fontSize: 22, bold: true, color: '#FFFFFF' },
        headerMeta: { fontSize: 10.5, color: '#DCE7F5' },
        sectionTitle: { fontSize: 11, bold: true, color: '#0F3460', characterSpacing: 0.5 },
        tableHeader: { fontSize: 8.6, bold: true, color: '#FFFFFF' },
        tableCell: { fontSize: 8.6, color: '#111827' },
      },
      header: () => this.reportHeader('STATISTIQUES DÉPENSES', data.organisation, data.period, assets),
      footer: (p: number, n: number) => this.reportFooter(p, n, data.organisation),
      content: [
        {
          margin: [0, 0, 0, 14],
          table: { widths: ['*', '*', '*'], body: [[
            this.summaryCell('NOMBRE DE DÉPENSES', fmtNum(data.summary?.total_count) || '0', '#1D4ED8'),
            this.summaryCell('TOTAL DÉPENSÉ', fmtNum(data.summary?.total_amount) + ' GNF', '#DC2626'),
            this.summaryCell('MOYENNE', fmtNum(data.summary?.avg_amount) + ' GNF', '#0891B2'),
          ]] },
          layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
        },
        { text: 'RÉPARTITION PAR CATÉGORIE', style: 'sectionTitle', margin: [0, 8, 0, 8] },
        {
          table: { headerRows: 1, widths: ['*', 60, 100], body: [
            [
              { text: 'Catégorie', style: 'tableHeader' },
              { text: 'Nb', style: 'tableHeader', alignment: 'center' },
              { text: 'Total', style: 'tableHeader', alignment: 'right' },
            ],
            ...categoryRows,
          ] },
          layout: {
            fillColor: (rowIndex: number) => rowIndex === 0 ? '#0F3460' : rowIndex % 2 === 0 ? '#F8FAFC' : '#FFFFFF',
            hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB',
            hLineWidth: () => 0.5, vLineWidth: () => 0.5,
            paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 5, paddingBottom: () => 5,
          },
        },
        { text: 'TOP 10 DÉPENSES', style: 'sectionTitle', margin: [0, 18, 0, 8] },
        {
          table: { headerRows: 1, widths: [30, 60, '*', 90, 90], body: [
            [
              { text: '#', style: 'tableHeader' },
              { text: 'Date', style: 'tableHeader' },
              { text: 'Titre', style: 'tableHeader' },
              { text: 'Catégorie', style: 'tableHeader' },
              { text: 'Montant', style: 'tableHeader', alignment: 'right' },
            ],
            ...topRows,
          ] },
          layout: {
            fillColor: (rowIndex: number) => rowIndex === 0 ? '#0F3460' : rowIndex % 2 === 0 ? '#F8FAFC' : '#FFFFFF',
            hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB',
            hLineWidth: () => 0.5, vLineWidth: () => 0.5,
            paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 5, paddingBottom: () => 5,
          },
        },
      ],
    };
  }

  async printClientFinancialOverviewPdf(data: PrintableClientFinancialOverview): Promise<void> {
    const pdfMake = await this.getPdfMake();
    if (!pdfMake?.createPdf) {
      console.warn('pdfmake non disponible');
      return;
    }
    const logo = await this.resolveDefaultLogo(data.organisation);
    const rows = (data.rows || []).map(r => [
      { text: r.name || '—', style: 'tableCell' },
      { text: r.client_type || '—', style: 'tableCell' },
      { text: this.formatMoney(r.total_charged, 'GNF'), style: 'tableCell', alignment: 'right' },
      { text: this.formatMoney(r.total_paid, 'GNF'), style: 'tableCell', alignment: 'right', color: '#16A34A' },
      { text: this.formatMoney(r.gross_debt_gnf, 'GNF'), style: 'tableCell', alignment: 'right', color: '#DC2626' },
      { text: this.formatMoney(r.rest_to_pay_gnf, 'GNF'), style: 'tableCell', alignment: 'right', bold: true },
      { text: r.status || '—', style: 'tableCell', alignment: 'center' },
    ]);
    const summary = data.summary || {};
    const docDef = this.buildSimpleReportDoc('INDEX FINANCIER CLIENTS', data.organisation, { logo }, [
      {
        margin: [0, 0, 0, 14],
        table: { widths: ['*', '*', '*'], body: [[
          this.summaryCell('TOTAL CLIENTS', String(summary.total_clients || data.rows.length || 0), '#1D4ED8'),
          this.summaryCell('RESTE À PAYER', this.formatMoney(summary.total_rest_to_pay, 'GNF'), '#DC2626'),
          this.summaryCell('AVANCES DISPONIBLES', this.formatMoney(summary.total_advances_remaining, 'GNF'), '#16A34A'),
        ]] },
        layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
      },
      this.simpleTable(
        ['Client', 'Type', 'Facturé', 'Payé', 'Dette brute', 'Reste à payer', 'Statut'],
        rows,
        ['*', 70, 75, 75, 80, 85, 55]
      ),
    ], 'landscape');
    pdfMake.createPdf(docDef).print();
  }

  async printContainerClientAccountPdf(data: PrintableContainerClientAccount): Promise<void> {
    const pdfMake = await this.getPdfMake();
    if (!pdfMake?.createPdf) {
      console.warn('pdfmake non disponible');
      return;
    }
    const logo = await this.resolveDefaultLogo(data.organisation);
    const stats = data.stats || {};
    const salesRows = (data.sales || []).slice(0, 30).map(s => [
      { text: this.formatDate(s.sale_date || s.created_at), style: 'tableCell' },
      { text: s.container?.container_number || s.container_number || s.reference || '—', style: 'tableCell' },
      { text: String(s.quantity || s.qty || 0), style: 'tableCell', alignment: 'center' },
      { text: this.formatMoney(s.total_amount || s.amount || 0, s.currency || 'GNF'), style: 'tableCell', alignment: 'right' },
      { text: s.status || '—', style: 'tableCell', alignment: 'center' },
    ]);
    const paymentRows = (data.payments || []).slice(0, 30).map(p => [
      { text: this.formatDate(p.payment_date || p.created_at), style: 'tableCell' },
      { text: p.payment_method || p.method || '—', style: 'tableCell' },
      { text: p.reference || '—', style: 'tableCell' },
      { text: this.formatMoney(p.amount || 0, p.currency || 'GNF'), style: 'tableCell', alignment: 'right', color: '#16A34A' },
    ]);
    const docDef = this.buildSimpleReportDoc(`COMPTE CLIENT CONTENEUR - ${data.client?.name || 'CLIENT'}`, data.organisation, { logo }, [
      {
        margin: [0, 0, 0, 14],
        table: { widths: ['*', '*', '*', '*'], body: [[
          this.summaryCell('TOTAL VENTES', this.formatMoney(stats.total_sales, 'GNF'), '#1D4ED8'),
          this.summaryCell('TOTAL PAYÉ', this.formatMoney(stats.total_paid, 'GNF'), '#16A34A'),
          this.summaryCell('DETTE', this.formatMoney(stats.total_debt, 'GNF'), '#DC2626'),
          this.summaryCell('AVANCES', this.formatMoney(stats.total_advances, 'GNF'), '#D97706'),
        ]] },
        layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
      },
      { text: 'VENTES CONTENEURS', style: 'sectionTitle', margin: [0, 6, 0, 8] },
      this.simpleTable(['Date', 'Conteneur', 'Qté', 'Montant', 'Statut'], salesRows, [70, '*', 45, 90, 70]),
      { text: 'VERSEMENTS', style: 'sectionTitle', margin: [0, 16, 0, 8] },
      this.simpleTable(['Date', 'Mode', 'Référence', 'Montant'], paymentRows, [75, 90, '*', 100]),
    ], 'portrait');
    pdfMake.createPdf(docDef).print();
  }

  async printRentalPaymentReceiptPdf(receipt: PrintableRentalPaymentReceipt): Promise<void> {
    const pdfMake = await this.getPdfMake();
    if (!pdfMake?.createPdf) {
      console.warn('pdfmake non disponible');
      return;
    }
    const logo = await this.resolveDefaultLogo(receipt.organisation);
    const docDef = this.buildSimpleReportDoc(`REÇU LOCATION ${receipt.receipt_number}`, receipt.organisation, { logo }, [
      {
        table: { widths: ['*'], body: [[{
          stack: [
            { text: this.formatMoney(receipt.amount, receipt.currency || 'GNF'), fontSize: 24, bold: true, color: '#16A34A', alignment: 'center' },
            { text: `Reçu N° ${receipt.receipt_number}`, alignment: 'center', color: '#64748B', margin: [0, 5, 0, 0] },
          ],
          margin: [16, 16, 16, 16],
        }]] },
        layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => '#ECFDF5' },
        margin: [0, 0, 0, 16],
      },
      this.simpleInfoGrid([
        ['Locataire', receipt.lease?.renter_name || '—'],
        ['Téléphone', receipt.lease?.renter_phone || '—'],
        ['Période réglée', this.formatPeriodMonth(receipt.period_month)],
        ['Date paiement', this.formatDate(receipt.payment_date)],
        ['Unité', receipt.lease?.housing_unit_label || '—'],
        ['Immeuble', receipt.lease?.building_name || receipt.lease?.location_name || '—'],
        ['Mode paiement', receipt.payment_method || '—'],
        ['Référence', receipt.reference || '—'],
        ['Loyer mensuel', this.formatMoney(receipt.lease?.monthly_rent || 0, receipt.lease?.currency || receipt.currency || 'GNF')],
        ['Statut', receipt.status || 'PAID'],
      ]),
      receipt.notes ? { text: `Notes: ${receipt.notes}`, margin: [0, 14, 0, 0], color: '#475569' } : {},
    ], 'portrait');
    pdfMake.createPdf(docDef).print();
  }

  private async resolveDefaultLogo(org?: PrintableOrganisation): Promise<string | null> {
    const MATKOLLA_LOGO = 'assets/images/logo/logo_matkolletf.png';
    const orgLogo = await this.resolveImageData(org?.logoUrl);
    return orgLogo || await this.resolveImageData(MATKOLLA_LOGO);
  }

  private buildSimpleReportDoc(
    title: string,
    organisation: PrintableOrganisation | undefined,
    assets: { logo?: string | null },
    content: any[],
    orientation: 'portrait' | 'landscape' = 'portrait'
  ): any {
    return {
      pageSize: 'A4',
      pageOrientation: orientation,
      pageMargins: [28, 128, 28, 48],
      defaultStyle: { font: 'Roboto', fontSize: 8.8, color: '#111827' },
      styles: {
        titleSmall: { fontSize: 10, color: '#BFDBFE', bold: true, characterSpacing: 1.4 },
        titleLarge: { fontSize: 22, bold: true, color: '#FFFFFF' },
        headerMeta: { fontSize: 10.5, color: '#DCE7F5' },
        sectionTitle: { fontSize: 11, bold: true, color: '#0F3460', characterSpacing: 0.5 },
        tableHeader: { fontSize: 8.4, bold: true, color: '#FFFFFF' },
        tableCell: { fontSize: 8.2, color: '#111827' },
      },
      header: () => this.reportHeader(title, organisation, undefined, assets, orientation === 'landscape'),
      footer: (p: number, n: number) => this.reportFooter(p, n, organisation),
      content,
    };
  }

  private simpleTable(headers: string[], rows: any[][], widths: any[]): any {
    const bodyRows = rows.length ? rows : [[{ text: 'Aucune donnée', colSpan: headers.length, alignment: 'center', color: '#64748B', margin: [0, 8, 0, 8] }, ...headers.slice(1).map(() => '')]];
    return {
      table: {
        headerRows: 1,
        widths,
        body: [
          headers.map(h => ({ text: h, style: 'tableHeader' })),
          ...bodyRows,
        ],
      },
      layout: {
        fillColor: (rowIndex: number) => rowIndex === 0 ? '#0F3460' : rowIndex % 2 === 0 ? '#F8FAFC' : '#FFFFFF',
        hLineColor: () => '#E5E7EB',
        vLineColor: () => '#E5E7EB',
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        paddingLeft: () => 5,
        paddingRight: () => 5,
        paddingTop: () => 5,
        paddingBottom: () => 5,
      },
    };
  }

  private simpleInfoGrid(items: Array<[string, string]>): any {
    const rows: any[] = [];
    for (let i = 0; i < items.length; i += 2) {
      const left = items[i];
      const right = items[i + 1];
      rows.push([
        this.infoCell(left[0], left[1]),
        right ? this.infoCell(right[0], right[1]) : '',
      ]);
    }
    return {
      table: { widths: ['*', '*'], body: rows },
      layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 4, paddingBottom: () => 4 },
    };
  }

  private infoCell(label: string, value: string): any {
    return {
      stack: [
        { text: label, fontSize: 8, color: '#64748B', bold: true },
        { text: value, fontSize: 11, color: '#111827', bold: true, margin: [0, 4, 0, 0] },
      ],
      margin: [10, 10, 10, 10],
      fillColor: '#F8FAFC',
    };
  }

  private formatPeriodMonth(value?: string): string {
    if (!value) return '—';
    const [year, month] = value.split('-').map(Number);
    if (!year || !month) return value;
    return this.normalizeSpaces(new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
  }

  // ── Header / Footer communs aux rapports ────────────────────────────────
  private reportHeader(title: string, org: PrintableOrganisation | undefined, period: { from?: string; to?: string } | undefined, assets: { logo?: string | null }, landscape = false): any {
    const w = landscape ? 842 : 595.28;
    return {
      stack: [
        {
          canvas: [
            { type: 'rect', x: 0, y: 0, w, h: 110, color: '#0F172A' },
            { type: 'rect', x: 0, y: 110, w, h: 4, color: '#0F3460' },
          ],
        },
        {
          margin: [30, -88, 30, 0],
          columns: [
            {
              width: 110,
              stack: assets.logo
                ? [{ image: assets.logo, fit: [100, 72], alignment: 'left', margin: [0, 0, 0, 4] }]
                : [{ text: 'MK', fontSize: 28, bold: true, color: '#FFFFFF', margin: [0, 8, 0, 0] }],
            },
            {
              width: '*', margin: [10, 4, 0, 0],
              stack: [
                { text: 'RAPPORT', style: 'titleSmall' },
                { text: org?.name || 'MATKOLLA', fontSize: 14, bold: true, color: '#FFFFFF', margin: [0, 6, 0, 0] },
                { text: org?.address || '', style: 'headerMeta', margin: [0, 4, 0, 0] },
                { text: `${org?.phone || ''}${org?.phone && org?.email ? ' • ' : ''}${org?.email || ''}`, style: 'headerMeta', margin: [0, 3, 0, 0] },
              ],
            },
            {
              width: 200, alignment: 'right',
              stack: [
                { text: title, style: 'titleLarge', alignment: 'right' },
                { text: period?.from || period?.to
                  ? `Du ${this.formatDate(period?.from)} au ${this.formatDate(period?.to)}`
                  : `Au ${this.formatDate(new Date())}`,
                  style: 'headerMeta', alignment: 'right', margin: [0, 8, 0, 0] },
              ],
            },
          ],
        },
      ],
    };
  }
  private reportFooter(currentPage: number, pageCount: number, org: PrintableOrganisation | undefined): any {
    return {
      margin: [30, 0, 30, 18],
      columns: [
        { width: '*', text: org?.footerText || `${org?.name || 'MATKOLLA'} — Rapport`, fontSize: 8, color: '#64748B' },
        { width: 'auto', text: `Page ${currentPage} / ${pageCount}`, fontSize: 8, color: '#64748B' },
      ],
    };
  }

  private balanceColor(v: number | null | undefined): string {
    const n = Number(v) || 0;
    if (n > 0) return '#DC2626';
    if (n < 0) return '#16A34A';
    return '#64748B';
  }

  generateContractPdf(contractData: any): Observable<Blob> {
    return this.generatePdfFromApi('pdf/contract', contractData);
  }

  generateReportPdf(reportData: { type: string; filters: any }): Observable<Blob> {
    return this.generatePdfFromApi('pdf/report', reportData);
  }

  async generateSimpleReceipt(data: {
    title: string;
    receiptNumber: string;
    date: Date;
    amount: number;
    currency: string;
    paymentMethod: string;
    clientName?: string;
    description?: string;
  }): Promise<void> {
    this.openPrintWindow(
      `${data.title} ${data.receiptNumber}`,
      this.buildSimpleReceiptHtml(data)
    );
  }

  async generateInvoice(invoiceData: {
    invoiceNumber: string;
    date: Date;
    dueDate: Date;
    clientName: string;
    clientAddress?: string;
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    subtotal: number;
    tax?: number;
    total: number;
    currency: string;
  }): Promise<void> {
    this.openPrintWindow(
      `Facture ${invoiceData.invoiceNumber}`,
      this.buildLegacyInvoiceHtml(invoiceData)
    );
  }

  async generateRentalContract(contractData: {
    contractNumber: string;
    propertyName: string;
    tenantName: string;
    landlordName: string;
    startDate: Date;
    endDate?: Date;
    rentAmount: number;
    currency: string;
    paymentFrequency: string;
    terms?: string;
  }): Promise<void> {
    this.openPrintWindow(
      `Contrat ${contractData.contractNumber}`,
      this.buildRentalContractHtml(contractData)
    );
  }

  async generateFinancialReport(reportData: {
    title: string;
    period: string;
    date: Date;
    sections: Array<{
      title: string;
      data: Array<{ label: string; value: string }>;
    }>;
  }): Promise<void> {
    this.openPrintWindow(
      reportData.title,
      this.buildFinancialReportHtml(reportData)
    );
  }

  downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  private async getPdfMake(): Promise<any> {
    if (this.bundledPdfMake?.createPdf) {
      return this.bundledPdfMake;
    }

    try {
      const [pdfMakeModule, pdfFontsModule] = await Promise.all([
        import('pdfmake/build/pdfmake'),
        import('pdfmake/build/vfs_fonts'),
      ]);
      const importedPdfMake = (pdfMakeModule as any)?.default || pdfMakeModule;
      const globalPdfMake = typeof window !== 'undefined' ? (window as any).pdfMake : null;
      const pdfMake = globalPdfMake?.createPdf ? globalPdfMake : importedPdfMake;
      const vfs = this.extractPdfMakeVfs(pdfFontsModule);

      if (pdfMake?.createPdf && vfs) {
        this.configurePdfMakeFonts(importedPdfMake, vfs);
        if (globalPdfMake?.createPdf && globalPdfMake !== importedPdfMake) {
          this.configurePdfMakeFonts(globalPdfMake, vfs);
        }
        this.configurePdfMakeFonts(pdfMake, vfs);
        if (!this.hasPdfMakeFont(pdfMake, 'Roboto-Medium.ttf')) {
          console.error('pdfmake VFS non initialisé: Roboto-Medium.ttf introuvable');
          return null;
        }
        this.bundledPdfMake = pdfMake;
        return this.bundledPdfMake;
      }
    } catch {
      return null;
    }

    return null;
  }

  private configurePdfMakeFonts(pdfMake: any, vfs: Record<string, string>): void {
    pdfMake.vfs = { ...(pdfMake.vfs || {}), ...vfs };
    const fonts = {
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf',
      },
    };
    pdfMake.fonts = { ...(pdfMake.fonts || {}), ...fonts };
    if (typeof pdfMake.addVirtualFileSystem === 'function') {
      pdfMake.addVirtualFileSystem(vfs);
    }
    if (typeof pdfMake.addFonts === 'function') {
      pdfMake.addFonts(fonts);
    }
  }

  private hasPdfMakeFont(pdfMake: any, filename: string): boolean {
    if (pdfMake?.vfs?.[filename]) {
      return true;
    }
    try {
      return !!pdfMake?.virtualfs?.readFileSync?.(filename);
    } catch {
      return false;
    }
  }

  private extractPdfMakeVfs(moduleValue: any): Record<string, string> | null {
    const candidates = [
      moduleValue?.pdfMake?.vfs,
      moduleValue?.default?.pdfMake?.vfs,
      moduleValue?.vfs,
      moduleValue?.default?.vfs,
      moduleValue?.default,
      moduleValue,
    ];
    for (const candidate of candidates) {
      if (candidate?.['Roboto-Regular.ttf'] && candidate?.['Roboto-Medium.ttf']) {
        return candidate;
      }
    }
    return null;
  }

  private async resolveImageData(value?: string | null): Promise<string | null> {
    const url = (value || '').trim();
    if (!url) return null;
    if (url.startsWith('data:image/')) return url;

    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) return null;
      const blob = await response.blob();
      return await this.blobToDataUrl(blob);
    } catch {
      return null;
    }
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read image blob'));
      reader.readAsDataURL(blob);
    });
  }

  private buildProfessionalInvoiceDocDefinition(
    invoiceData: PrintableInvoiceData,
    assets: { logo?: string | null; signature?: string | null; stamp?: string | null } = {}
  ): any {
    const status = (invoiceData.status || 'IMPAYE').toUpperCase();
    const statusMeta: Record<string, { label: string; color: string; bg: string }> = {
      PAYE: { label: 'Payée', color: '#047857', bg: '#ECFDF5' },
      PARTIEL: { label: 'Partielle', color: '#B45309', bg: '#FFFBEB' },
      IMPAYE: { label: 'Impayée', color: '#B91C1C', bg: '#FEF2F2' },
    };
    const badge = statusMeta[status] || { label: status, color: '#475569', bg: '#F8FAFC' };
    const cleanOrgContact = [
      invoiceData.organisation?.address,
      [invoiceData.organisation?.phone, invoiceData.organisation?.email].filter(Boolean).join(' | '),
    ].filter(Boolean);
    const infoLine = (label: string, value: string) => [
      { text: label, style: 'muted' },
      { text: value || '-', alignment: 'right', bold: true, color: '#111827' },
    ];
    const items = (invoiceData.items || []).length > 0
      ? invoiceData.items.map((item, index) => ([
          { text: String(index + 1), style: 'td', alignment: 'center' },
          { text: item.description || 'Ligne de facture', style: 'td' },
          { text: this.formatNumber(item.quantity), style: 'td', alignment: 'center' },
          { text: this.formatMoney(item.unitPrice, invoiceData.currency), style: 'td', alignment: 'right' },
          { text: this.formatMoney(item.total, invoiceData.currency), style: 'td', alignment: 'right', bold: true }
        ]))
      : [[
          { text: '1', style: 'td', alignment: 'center' },
          { text: invoiceData.notes || 'Ligne de facture', style: 'td' },
          { text: '1', style: 'td', alignment: 'center' },
          { text: this.formatMoney(invoiceData.subtotal, invoiceData.currency), style: 'td', alignment: 'right' },
          { text: this.formatMoney(invoiceData.subtotal, invoiceData.currency), style: 'td', alignment: 'right', bold: true }
        ]];
    const totalsBody: any[] = [
      infoLine('Sous-total', this.formatMoney(invoiceData.subtotal, invoiceData.currency)),
    ];
    if (Number(invoiceData.previousBalance || 0) !== 0) {
      totalsBody.push(infoLine('Solde antérieur', this.formatMoney(invoiceData.previousBalance || 0, invoiceData.currency)));
    }
    totalsBody.push([
      { text: 'NET À PAYER', bold: true, color: '#0F3460', fontSize: 10.5 },
      { text: this.formatMoney(invoiceData.total, invoiceData.currency), alignment: 'right', bold: true, color: '#0F3460', fontSize: 13 },
    ]);
    if (invoiceData.currency !== 'GNF' && invoiceData.totalGnf) {
      totalsBody.push([
        { text: `Équivalent GNF`, color: '#1D4ED8', bold: true },
        { text: this.formatMoney(invoiceData.totalGnf, 'GNF'), alignment: 'right', color: '#1D4ED8', bold: true },
      ]);
      totalsBody.push(infoLine('Taux appliqué', this.formatNumber(invoiceData.exchangeRate || 1)));
    }

    return {
      pageSize: 'A4',
      pageMargins: [38, 34, 38, 34],
      info: { title: `Facture ${invoiceData.invoiceNumber}`, subject: 'Facture client' },
      defaultStyle: { font: 'Roboto', fontSize: 9, color: '#111827' },
      styles: {
        invoiceTitle: { fontSize: 28, bold: true, color: '#0F3460' },
        orgName: { fontSize: 14, bold: true, color: '#111827' },
        sectionTitle: { fontSize: 9.5, bold: true, color: '#0F3460', characterSpacing: 0.6 },
        muted: { fontSize: 8.4, color: '#64748B' },
        th: { fontSize: 8.6, bold: true, color: '#FFFFFF' },
        td: { fontSize: 8.7, color: '#111827' },
        small: { fontSize: 8, color: '#64748B' },
      },
      footer: (currentPage: number, pageCount: number) => ({
        margin: [38, 0, 38, 18],
        columns: [
          { width: '*', text: invoiceData.organisation?.footerText || 'Merci pour votre confiance.', fontSize: 8, color: '#64748B' },
          { width: 'auto', text: `Page ${currentPage} / ${pageCount}`, fontSize: 8, color: '#64748B' },
        ]
      }),
      content: [
        {
          columns: [
            {
              width: '*',
              stack: [
                assets.logo
                  ? { image: assets.logo, fit: [108, 58], margin: [0, 0, 0, 8] }
                  : { text: invoiceData.organisation?.name || 'MATKOLLA', style: 'orgName', margin: [0, 0, 0, 8] },
                { text: invoiceData.organisation?.name || 'MATKOLLA', style: 'orgName' },
                ...(invoiceData.organisation?.motto ? [{ text: invoiceData.organisation.motto, style: 'small', margin: [0, 3, 0, 0] }] : []),
                ...cleanOrgContact.map(line => ({ text: line, style: 'small', margin: [0, 3, 0, 0] })),
              ]
            },
            {
              width: 210,
              alignment: 'right',
              stack: [
                { text: 'FACTURE', style: 'invoiceTitle', alignment: 'right' },
                { text: `N° ${invoiceData.invoiceNumber}`, fontSize: 11, bold: true, color: '#111827', alignment: 'right', margin: [0, 5, 0, 0] },
                {
                  margin: [0, 10, 0, 0],
                  table: {
                    widths: ['auto'],
                    body: [[{ text: badge.label, bold: true, color: badge.color, fillColor: badge.bg, margin: [12, 5, 12, 5], fontSize: 9 }]]
                  },
                  layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 }
                },
              ]
            }
          ]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 519, y2: 0, lineWidth: 1, lineColor: '#E5E7EB' }], margin: [0, 18, 0, 18] },
        {
          columns: [
            {
              width: '55%',
              stack: [
                { text: 'FACTURÉ À', style: 'sectionTitle', margin: [0, 0, 0, 7] },
                { text: invoiceData.clientName || '-', fontSize: 14, bold: true, color: '#111827' },
                ...(invoiceData.clientAddress ? [{ text: invoiceData.clientAddress, color: '#475569', margin: [0, 5, 0, 0] }] : []),
                ...((invoiceData.clientPhone || invoiceData.clientEmail)
                  ? [{ text: [invoiceData.clientPhone, invoiceData.clientEmail].filter(Boolean).join(' | '), color: '#475569', margin: [0, 5, 0, 0] }]
                  : []),
              ],
            },
            {
              width: '45%',
              table: {
                widths: ['*', 'auto'],
                body: [
                  infoLine('Date facture', this.formatDate(invoiceData.date || new Date())),
                  infoLine('Échéance', this.formatDate(invoiceData.dueDate)),
                  infoLine('Devise', invoiceData.currency || 'GNF'),
                ],
              },
              layout: {
                hLineWidth: (i: number) => i === 0 ? 0 : 0.5,
                vLineWidth: () => 0,
                hLineColor: () => '#E5E7EB',
                paddingLeft: () => 10,
                paddingRight: () => 10,
                paddingTop: () => 7,
                paddingBottom: () => 7,
                fillColor: () => '#F8FAFC',
              },
            },
          ],
          margin: [0, 0, 0, 20],
        },
        {
          table: {
            headerRows: 1,
            widths: [26, '*', 48, 82, 88],
            body: [
              [
                { text: '#', style: 'th', alignment: 'center' },
                { text: 'Désignation', style: 'th' },
                { text: 'Qté', style: 'th', alignment: 'center' },
                { text: 'Prix unit.', style: 'th', alignment: 'right' },
                { text: 'Montant', style: 'th', alignment: 'right' }
              ],
              ...items
            ]
          },
          layout: {
            fillColor: (rowIndex: number) => rowIndex === 0 ? '#0F3460' : rowIndex % 2 === 0 ? '#F8FAFC' : '#FFFFFF',
            hLineColor: () => '#E5E7EB',
            vLineWidth: () => 0,
            hLineWidth: () => 0.5,
            paddingLeft: () => 9,
            paddingRight: () => 9,
            paddingTop: () => 8,
            paddingBottom: () => 8
          }
        },
        {
          columns: [
            {
              width: '*',
              margin: [0, 18, 20, 0],
              stack: invoiceData.notes
                ? [
                    { text: 'NOTES', style: 'sectionTitle', margin: [0, 0, 0, 6] },
                    { text: invoiceData.notes, color: '#475569', lineHeight: 1.25 },
                  ]
                : [
                    { text: 'CONDITIONS', style: 'sectionTitle', margin: [0, 0, 0, 6] },
                    { text: 'Paiement à effectuer selon les conditions convenues avec le client.', color: '#475569', lineHeight: 1.25 },
                  ],
            },
            {
              width: 215,
              margin: [0, 18, 0, 0],
              table: { widths: ['*', 'auto'], body: totalsBody },
              layout: {
                hLineWidth: (i: number) => i === 0 ? 0 : 0.5,
                vLineWidth: () => 0,
                hLineColor: () => '#E5E7EB',
                paddingLeft: () => 10,
                paddingRight: () => 10,
                paddingTop: () => 8,
                paddingBottom: () => 8,
                fillColor: (rowIndex: number) => rowIndex === totalsBody.findIndex(row => row[0]?.text === 'NET À PAYER') ? '#EFF6FF' : '#FFFFFF',
              },
            }
          ]
        },
        {
          columns: [
            {
              width: '*',
              margin: [0, 28, 12, 0],
              stack: [
                { text: 'Signature', style: 'sectionTitle', margin: [0, 0, 0, 10] },
                assets.signature ? { image: assets.signature, fit: [150, 58] } : { text: ' ', margin: [0, 24, 0, 0] },
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 170, y2: 0, lineWidth: 0.5, lineColor: '#94A3B8' }], margin: [0, 6, 0, 4] },
                { text: invoiceData.organisation?.name || 'MATKOLLA', bold: true, color: '#0F3460', fontSize: 9 },
              ],
            },
            {
              width: '*',
              margin: [12, 28, 0, 0],
              stack: [
                { text: 'Cachet', style: 'sectionTitle', alignment: 'right', margin: [0, 0, 0, 10] },
                assets.stamp
                  ? { image: assets.stamp, fit: [110, 84], alignment: 'right' }
                  : { text: 'Cachet de la société', alignment: 'right', color: '#CBD5E1', italics: true, margin: [0, 34, 0, 0] },
              ],
            },
          ],
        }
      ]
    };
  }

  private buildProfessionalReceiptDocDefinition(
    receiptData: PrintableReceiptData,
    assets: { logo?: string | null } = {}
  ): any {
    const statusColor = receiptData.status === 'COMPLETED' ? '#10B981' : receiptData.status === 'PENDING' ? '#F59E0B' : '#EF4444';
    const lineItems = [
      ['Client', receiptData.client?.name || '—'],
      ['Téléphone', receiptData.client?.phone || '—'],
      ['Référence', receiptData.reference || '—'],
      ['Statut', receiptData.status],
      ['Généré le', receiptData.generated_at || this.formatDate(new Date())]
    ];

    return {
      pageSize: 'A4',
      pageMargins: [36, 128, 36, 54],
      defaultStyle: { font: 'Roboto', fontSize: 9, color: '#111827' },
      styles: {
        titleSmall: { fontSize: 10, color: '#BFDBFE', bold: true, characterSpacing: 1.4 },
        titleLarge: { fontSize: 26, bold: true, color: '#FFFFFF' },
        headerMeta: { fontSize: 11, color: '#DCE7F5' },
        sectionTitle: { fontSize: 11, bold: true, color: '#0F3460', characterSpacing: 0.6 },
      },
      header: () => ({
        margin: [0, 0, 0, 0],
        stack: [
          {
            canvas: [
              { type: 'rect', x: 0, y: 0, w: 595.28, h: 110, color: '#0F172A' },
              { type: 'rect', x: 0, y: 110, w: 595.28, h: 4, color: statusColor }
            ]
          },
          {
            margin: [36, -88, 36, 0],
            columns: [
              {
                width: 110,
                stack: assets.logo ? [
                  { image: assets.logo, fit: [100, 72], alignment: 'left', margin: [0, 0, 0, 4] }
                ] : [
                  { text: 'MK', fontSize: 28, bold: true, color: '#FFFFFF', margin: [0, 8, 0, 0] }
                ]
              },
              {
                width: '*',
                margin: [10, 4, 0, 0],
                stack: [
                  { text: 'REÇU DE PAIEMENT', style: 'titleSmall' },
                  { text: receiptData.organisation?.name || 'MATKOLLA', fontSize: 14, bold: true, color: '#FFFFFF', margin: [0, 6, 0, 0] },
                  { text: receiptData.organisation?.address || '', style: 'headerMeta', margin: [0, 4, 0, 0] },
                  {
                    text: `${receiptData.organisation?.phone || ''}${receiptData.organisation?.phone && receiptData.organisation?.email ? ' • ' : ''}${receiptData.organisation?.email || ''}`,
                    style: 'headerMeta',
                    margin: [0, 3, 0, 0]
                  }
                ]
              },
              {
                width: 175,
                alignment: 'right',
                stack: [
                  { text: 'REÇU', style: 'titleLarge', alignment: 'right' },
                  { text: `N° ${receiptData.receipt_number}`, style: 'headerMeta', alignment: 'right', margin: [0, 6, 0, 0] },
                  {
                    margin: [0, 10, 0, 0],
                    alignment: 'right',
                    table: { widths: ['auto'], body: [[{
                      text: receiptData.status,
                      color: '#FFFFFF',
                      bold: true,
                      fontSize: 9,
                      fillColor: statusColor,
                      margin: [10, 4, 10, 4]
                    }]] },
                    layout: {
                      hLineWidth: () => 0, vLineWidth: () => 0,
                      paddingLeft: () => 0, paddingRight: () => 0,
                      paddingTop: () => 0, paddingBottom: () => 0
                    }
                  }
                ]
              }
            ]
          }
        ]
      }),
      footer: (currentPage: number, pageCount: number) => ({
        margin: [36, 0, 36, 18],
        columns: [
          {
            width: '*',
            text: receiptData.organisation?.footer_text || 'Document valable comme justificatif de paiement',
            fontSize: 8.5,
            color: '#64748B'
          },
          {
            width: 'auto',
            text: `Page ${currentPage} / ${pageCount}`,
            fontSize: 8.5,
            color: '#64748B'
          }
        ]
      }),
      content: [
        {
          columns: [
            {
              width: '58%',
              stack: [
                { text: 'INFORMATIONS', style: 'sectionTitle', margin: [0, 0, 0, 8] },
                {
                  table: { widths: ['*'], body: [[{
                    stack: [
                      { text: `N° ${receiptData.receipt_number}`, bold: true, fontSize: 14, color: '#111827' },
                      { text: `Date: ${this.formatDate(receiptData.payment_date)}`, margin: [0, 4, 0, 0], color: '#475569' },
                      { text: `Mode: ${receiptData.method}`, margin: [0, 4, 0, 0], color: '#475569' },
                      { text: `Type: ${receiptData.type}`, margin: [0, 4, 0, 0], color: '#475569' }
                    ],
                    margin: [12, 12, 12, 12]
                  }]]},
                  layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB' }
                }
              ]
            },
            {
              width: '42%',
              stack: [
                { text: 'MONTANT', style: 'sectionTitle', margin: [0, 0, 0, 8] },
                {
                  table: { widths: ['*'], body: [[{
                    stack: [
                      { text: this.formatMoney(receiptData.amount, receiptData.currency), bold: true, fontSize: 22, color: '#10B981', alignment: 'center' },
                      { text: receiptData.amount_gnf ? `≈ ${this.formatMoney(receiptData.amount_gnf, 'GNF')}` : '', alignment: 'center', color: '#64748B', margin: [0, 4, 0, 0] }
                    ],
                    margin: [12, 16, 12, 16]
                  }]]},
                  layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => '#F8FAFC' }
                }
              ]
            }
          ]
        },
        { text: 'DÉTAILS', style: 'sectionTitle', margin: [0, 18, 0, 8] },
        {
          table: {
            widths: ['*', 'auto'],
            body: lineItems.map(([label, value]) => [
              { text: String(label), color: '#475569' },
              { text: String(value), bold: true, alignment: 'right' }
            ])
          },
          layout: {
            hLineWidth: () => 0.6,
            vLineWidth: () => 0,
            hLineColor: () => '#E5E7EB',
            paddingLeft: () => 10,
            paddingRight: () => 10,
            paddingTop: () => 8,
            paddingBottom: () => 8
          }
        },
        receiptData.invoice ? {
          margin: [0, 16, 0, 0],
          table: {
            widths: ['*'],
            body: [[{
              stack: [
                { text: 'FACTURE ASSOCIÉE', style: 'sectionTitle', margin: [0, 0, 0, 8] },
                { text: `N° ${receiptData.invoice.invoice_number}`, bold: true, color: '#111827' },
                { text: `Total facture: ${this.formatMoney(receiptData.invoice.total_amount, receiptData.currency)}`, margin: [0, 4, 0, 0] },
                { text: `Déjà payé: ${this.formatMoney(receiptData.invoice.paid_amount, receiptData.currency)}`, margin: [0, 4, 0, 0], color: '#10B981' },
                { text: `Reste dû: ${this.formatMoney(receiptData.invoice.remaining_balance, receiptData.currency)}`, margin: [0, 4, 0, 0], color: '#EF4444' }
              ],
              margin: [12, 12, 12, 12]
            }]]
          },
          layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => '#EFF6FF' }
        } : {},
        {
          margin: [0, 22, 0, 0],
          columns: [
            {
              width: '50%',
              stack: [
                { text: 'SIGNATURE CLIENT', style: 'sectionTitle', margin: [0, 0, 0, 8] },
                {
                  table: { widths: ['*'], body: [[{
                    stack: [
                      { text: ' ', color: '#FFFFFF', margin: [0, 18, 0, 18] },
                      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 170, y2: 0, lineWidth: 0.5, lineColor: '#94A3B8' }], margin: [0, 8, 0, 4] },
                      { text: receiptData.client?.name || '—', bold: true, color: '#0F3460', fontSize: 9.4 }
                    ],
                    margin: [14, 16, 14, 14]
                  }]]},
                  layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB', fillColor: () => '#FFFFFF' }
                }
              ]
            },
            {
              width: '50%',
              margin: [8, 0, 0, 0],
              stack: [
                { text: 'CACHET / SIGNATURE CAISSE', style: 'sectionTitle', margin: [0, 0, 0, 8] },
                {
                  table: { widths: ['*'], body: [[{
                    stack: [
                      { text: ' ', color: '#FFFFFF', margin: [0, 18, 0, 18] },
                      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 170, y2: 0, lineWidth: 0.5, lineColor: '#94A3B8' }], margin: [0, 8, 0, 4] },
                      { text: receiptData.organisation?.name || 'MATKOLLA', bold: true, color: '#0F3460', fontSize: 9.4 }
                    ],
                    margin: [14, 16, 14, 14]
                  }]]},
                  layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB', fillColor: () => '#FFFFFF' }
                }
              ]
            }
          ]
        },
        {
          margin: [0, 22, 0, 0],
          columns: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 0.5, lineColor: '#E5E7EB' }] }]
        },
        {
          margin: [0, 12, 0, 0],
          text: receiptData.organisation?.footer_text || 'Merci pour votre confiance. Ce reçu fait foi de paiement.',
          fontSize: 8.6,
          color: '#94A3B8',
          alignment: 'center',
          italics: true
        }
      ]
    };
  }

  private openPrintWindow(title: string, bodyHtml: string): void {
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=1280,height=900');
    if (!popup) {
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${this.escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
    }
    * {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #e9eef5;
      font-family: "Segoe UI", Arial, sans-serif;
      color: #111827;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      padding: 24px;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 18px 60px rgba(15, 23, 42, 0.12);
    }
    @media print {
      body {
        background: #fff;
        padding: 0;
      }
      .page {
        width: auto;
        min-height: auto;
        border-radius: 0;
        box-shadow: none;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    ${bodyHtml}
  </div>
</body>
</html>`;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
  }

  private buildProfessionalInvoiceHtml(invoiceData: PrintableInvoiceData): string {
    const itemsHtml = (invoiceData.items || []).map((item, index) => `
      <tr>
        <td style="padding:12px 14px;border-bottom:1px solid #E5E7EB;color:#111827;">${index + 1}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #E5E7EB;color:#111827;">
          <div style="font-weight:700;">${this.escapeHtml(item.description || '')}</div>
        </td>
        <td style="padding:12px 14px;border-bottom:1px solid #E5E7EB;text-align:center;">${this.formatNumber(item.quantity)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #E5E7EB;text-align:right;">${this.formatMoney(item.unitPrice, invoiceData.currency)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #E5E7EB;text-align:right;font-weight:700;color:#0F3460;">${this.formatMoney(item.total, invoiceData.currency)}</td>
      </tr>
    `).join('');

    const statusLabel = (invoiceData.status || 'IMPAYE').toUpperCase();
    const statusColor = statusLabel === 'PAYE' ? '#10B981' : statusLabel === 'PARTIEL' ? '#F59E0B' : '#EF4444';

    return `
      <div style="padding:18px;background:linear-gradient(135deg,#0F172A 0%,#16213E 50%,#0F3460 100%);color:#fff;">
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">
          <div style="max-width:60%;">
            <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#BFDBFE;">Facture professionnelle</div>
            <div style="font-size:26px;font-weight:800;margin:6px 0 2px;">${this.escapeHtml(invoiceData.organisation?.name || 'GESTION MULTI-MODULES')}</div>
            <div style="font-size:12px;color:#DCE7F5;line-height:1.45;">${this.escapeHtml(invoiceData.organisation?.motto || 'Facturation détaillée et transparente')}</div>
            <div style="font-size:12px;color:#DCE7F5;line-height:1.45;margin-top:8px;">${this.escapeHtml(invoiceData.organisation?.address || '')}</div>
            <div style="font-size:12px;color:#DCE7F5;line-height:1.45;">${this.escapeHtml(invoiceData.organisation?.phone || '')} ${invoiceData.organisation?.email ? `• ${this.escapeHtml(invoiceData.organisation.email)}` : ''}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:34px;font-weight:900;line-height:1;">FACTURE</div>
            <div style="font-size:12px;color:#DCE7F5;margin-top:4px;">N° ${this.escapeHtml(invoiceData.invoiceNumber)}</div>
            <div style="margin-top:12px;display:inline-flex;align-items:center;padding:8px 12px;border-radius:999px;background:${statusColor};font-size:12px;font-weight:800;">
              ${this.escapeHtml(statusLabel)}
            </div>
          </div>
        </div>
      </div>

      <div style="padding:18px 22px 12px;">
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:-42px;">
          <div style="background:#F8FAFC;border:1px solid #E5E7EB;border-radius:14px;padding:14px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748B;">Date d'émission</div>
            <div style="margin-top:6px;font-size:14px;font-weight:800;color:#111827;">${this.formatDate(invoiceData.date)}</div>
          </div>
          <div style="background:#F8FAFC;border:1px solid #E5E7EB;border-radius:14px;padding:14px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748B;">Échéance</div>
            <div style="margin-top:6px;font-size:14px;font-weight:800;color:#111827;">${this.formatDate(invoiceData.dueDate)}</div>
          </div>
          <div style="background:#F8FAFC;border:1px solid #E5E7EB;border-radius:14px;padding:14px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748B;">Devise</div>
            <div style="margin-top:6px;font-size:14px;font-weight:800;color:#111827;">${this.escapeHtml(invoiceData.currency || 'GNF')}</div>
          </div>
          <div style="background:#F8FAFC;border:1px solid #E5E7EB;border-radius:14px;padding:14px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748B;">Taux GNF</div>
            <div style="margin-top:6px;font-size:14px;font-weight:800;color:#111827;">${invoiceData.currency !== 'GNF' ? this.formatNumber(invoiceData.exchangeRate || 1) : '1'}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1.2fr .8fr;gap:16px;margin-top:16px;">
          <div style="border:1px solid #E5E7EB;border-radius:16px;padding:16px;background:#fff;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748B;margin-bottom:8px;">Facturé à</div>
            <div style="font-size:18px;font-weight:800;color:#111827;">${this.escapeHtml(invoiceData.clientName)}</div>
            ${invoiceData.clientAddress ? `<div style="margin-top:8px;font-size:13px;color:#475569;line-height:1.5;">${this.escapeHtml(invoiceData.clientAddress)}</div>` : ''}
            <div style="margin-top:8px;font-size:13px;color:#475569;line-height:1.5;">
              ${invoiceData.clientPhone ? this.escapeHtml(invoiceData.clientPhone) : ''}
              ${invoiceData.clientPhone && invoiceData.clientEmail ? ' • ' : ''}
              ${invoiceData.clientEmail ? this.escapeHtml(invoiceData.clientEmail) : ''}
            </div>
          </div>
          <div style="border:1px solid #E5E7EB;border-radius:16px;padding:16px;background:linear-gradient(180deg,#F8FAFC 0%,#FFFFFF 100%);">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748B;margin-bottom:10px;">Résumé financier</div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;color:#475569;">
              <span>Sous-total</span>
              <strong style="color:#111827;">${this.formatMoney(invoiceData.subtotal, invoiceData.currency)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;color:#475569;">
              <span>Arriérés</span>
              <strong style="color:#F59E0B;">${this.formatMoney(invoiceData.previousBalance || 0, invoiceData.currency)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding-top:10px;border-top:1px dashed #CBD5E1;font-size:18px;color:#0F3460;">
              <span style="font-weight:800;">Total</span>
              <strong>${this.formatMoney(invoiceData.total, invoiceData.currency)}</strong>
            </div>
            ${invoiceData.currency !== 'GNF' && invoiceData.totalGnf ? `
              <div style="margin-top:10px;padding:10px 12px;border-radius:12px;background:#EFF6FF;color:#1D4ED8;font-size:12px;font-weight:700;">
                Équivalent GNF: ${this.formatMoney(invoiceData.totalGnf, 'GNF')}
              </div>
            ` : ''}
          </div>
        </div>

        <div style="margin-top:18px;border:1px solid #E5E7EB;border-radius:16px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#0F3460;color:#fff;">
                <th style="padding:12px 14px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.06em;">#</th>
                <th style="padding:12px 14px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.06em;">Description</th>
                <th style="padding:12px 14px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:.06em;">Qté</th>
                <th style="padding:12px 14px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:.06em;">PU</th>
                <th style="padding:12px 14px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:.06em;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml || `
                <tr>
                  <td colspan="5" style="padding:18px;text-align:center;color:#64748B;">Aucune ligne de facturation</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>

        ${invoiceData.notes ? `
          <div style="margin-top:16px;border-left:4px solid #10B981;background:#F0FDF4;border-radius:12px;padding:14px 16px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#047857;margin-bottom:6px;font-weight:800;">Notes</div>
            <div style="font-size:13px;line-height:1.6;color:#14532D;white-space:pre-wrap;">${this.escapeHtml(invoiceData.notes)}</div>
          </div>
        ` : ''}

        <div style="margin-top:18px;display:flex;justify-content:space-between;gap:16px;align-items:flex-end;">
          <div style="font-size:12px;color:#64748B;line-height:1.5;max-width:70%;">
            Merci pour votre confiance.<br>
            Cette facture peut être imprimée ou enregistrée en PDF depuis la boîte d'impression du navigateur.
          </div>
          <div style="text-align:right;font-size:12px;color:#94A3B8;">
            Généré le ${this.formatDate(new Date())}
          </div>
        </div>
      </div>
    `;
  }

  private buildSimpleReceiptHtml(data: {
    title: string;
    receiptNumber: string;
    date: Date;
    amount: number;
    currency: string;
    paymentMethod: string;
    clientName?: string;
    description?: string;
  }): string {
    return `
      <div style="padding:24px;">
        <div style="border-radius:18px;background:linear-gradient(135deg,#111827 0%,#1F2937 100%);color:#fff;padding:24px;">
          <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#93C5FD;">${this.escapeHtml(data.title)}</div>
          <div style="font-size:28px;font-weight:900;margin-top:8px;">Reçu ${this.escapeHtml(data.receiptNumber)}</div>
        </div>
        <div style="margin-top:18px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;">
          <div style="border:1px solid #E5E7EB;border-radius:14px;padding:14px;">
            <div style="font-size:11px;text-transform:uppercase;color:#64748B;">Date</div>
            <div style="font-weight:800;margin-top:6px;">${this.formatDate(data.date)}</div>
          </div>
          <div style="border:1px solid #E5E7EB;border-radius:14px;padding:14px;">
            <div style="font-size:11px;text-transform:uppercase;color:#64748B;">Mode de paiement</div>
            <div style="font-weight:800;margin-top:6px;">${this.escapeHtml(data.paymentMethod)}</div>
          </div>
        </div>
        <div style="margin-top:14px;border:1px solid #E5E7EB;border-radius:14px;padding:16px;">
          <div style="font-size:11px;text-transform:uppercase;color:#64748B;">Client</div>
          <div style="font-size:18px;font-weight:800;margin-top:6px;">${this.escapeHtml(data.clientName || '—')}</div>
          ${data.description ? `<div style="margin-top:8px;color:#475569;line-height:1.6;">${this.escapeHtml(data.description)}</div>` : ''}
        </div>
        <div style="margin-top:16px;padding:18px;border-radius:16px;background:#EFF6FF;border:1px solid #BFDBFE;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:13px;color:#1D4ED8;font-weight:700;">Montant</span>
          <strong style="font-size:26px;color:#0F3460;">${this.formatMoney(data.amount, data.currency)}</strong>
        </div>
      </div>
    `;
  }

  private buildLegacyInvoiceHtml(invoiceData: {
    invoiceNumber: string;
    date: Date;
    dueDate: Date;
    clientName: string;
    clientAddress?: string;
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    subtotal: number;
    tax?: number;
    total: number;
    currency: string;
  }): string {
    const itemsHtml = (invoiceData.items || []).map((item, index) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;">${index + 1}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;">${this.escapeHtml(item.description)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;text-align:center;">${this.formatNumber(item.quantity)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;text-align:right;">${this.formatMoney(item.unitPrice, invoiceData.currency)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;text-align:right;font-weight:700;">${this.formatMoney(item.total, invoiceData.currency)}</td>
      </tr>
    `).join('');

    return `
      <div style="padding:24px;">
        <div style="font-size:28px;font-weight:900;color:#111827;">FACTURE</div>
        <div style="margin-top:8px;color:#475569;">N° ${this.escapeHtml(invoiceData.invoiceNumber)} • ${this.formatDate(invoiceData.date)} • Échéance ${this.formatDate(invoiceData.dueDate)}</div>
        <div style="margin-top:20px;border:1px solid #E5E7EB;border-radius:14px;padding:16px;">
          <div style="font-size:12px;color:#64748B;text-transform:uppercase;">Client</div>
          <div style="font-size:18px;font-weight:800;margin-top:6px;">${this.escapeHtml(invoiceData.clientName)}</div>
          ${invoiceData.clientAddress ? `<div style="margin-top:6px;color:#475569;">${this.escapeHtml(invoiceData.clientAddress)}</div>` : ''}
        </div>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <thead>
            <tr style="background:#0F3460;color:#fff;">
              <th style="padding:10px 12px;text-align:left;">#</th>
              <th style="padding:10px 12px;text-align:left;">Description</th>
              <th style="padding:10px 12px;text-align:center;">Qté</th>
              <th style="padding:10px 12px;text-align:right;">PU</th>
              <th style="padding:10px 12px;text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div style="display:flex;justify-content:flex-end;margin-top:16px;">
          <div style="width:320px;border:1px solid #E5E7EB;border-radius:14px;padding:14px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Sous-total</span><strong>${this.formatMoney(invoiceData.subtotal, invoiceData.currency)}</strong></div>
            ${invoiceData.tax ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Taxe</span><strong>${this.formatMoney(invoiceData.tax, invoiceData.currency)}</strong></div>` : ''}
            <div style="display:flex;justify-content:space-between;padding-top:10px;border-top:1px dashed #CBD5E1;"><span style="font-weight:800;">Total</span><strong>${this.formatMoney(invoiceData.total, invoiceData.currency)}</strong></div>
          </div>
        </div>
      </div>
    `;
  }

  private buildRentalContractHtml(contractData: {
    contractNumber: string;
    propertyName: string;
    tenantName: string;
    landlordName: string;
    startDate: Date;
    endDate?: Date;
    rentAmount: number;
    currency: string;
    paymentFrequency: string;
    terms?: string;
  }): string {
    return `
      <div style="padding:24px;">
        <div style="background:linear-gradient(135deg,#0F172A 0%,#0F3460 100%);color:#fff;border-radius:18px;padding:24px;">
          <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#BFDBFE;">Contrat de location</div>
          <div style="font-size:28px;font-weight:900;margin-top:8px;">${this.escapeHtml(contractData.contractNumber)}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px;">
          <div style="border:1px solid #E5E7EB;border-radius:14px;padding:14px;"><div style="font-size:11px;text-transform:uppercase;color:#64748B;">Bien</div><div style="font-weight:800;margin-top:6px;">${this.escapeHtml(contractData.propertyName)}</div></div>
          <div style="border:1px solid #E5E7EB;border-radius:14px;padding:14px;"><div style="font-size:11px;text-transform:uppercase;color:#64748B;">Locataire</div><div style="font-weight:800;margin-top:6px;">${this.escapeHtml(contractData.tenantName)}</div></div>
          <div style="border:1px solid #E5E7EB;border-radius:14px;padding:14px;"><div style="font-size:11px;text-transform:uppercase;color:#64748B;">Bailleur</div><div style="font-weight:800;margin-top:6px;">${this.escapeHtml(contractData.landlordName)}</div></div>
          <div style="border:1px solid #E5E7EB;border-radius:14px;padding:14px;"><div style="font-size:11px;text-transform:uppercase;color:#64748B;">Paiement</div><div style="font-weight:800;margin-top:6px;">${this.escapeHtml(contractData.paymentFrequency)}</div></div>
        </div>
        <div style="margin-top:16px;border:1px solid #E5E7EB;border-radius:14px;padding:16px;">
          <div style="display:flex;justify-content:space-between;"><span>Date de début</span><strong>${this.formatDate(contractData.startDate)}</strong></div>
          ${contractData.endDate ? `<div style="display:flex;justify-content:space-between;margin-top:8px;"><span>Date de fin</span><strong>${this.formatDate(contractData.endDate)}</strong></div>` : ''}
          <div style="display:flex;justify-content:space-between;margin-top:8px;"><span>Loyer</span><strong>${this.formatMoney(contractData.rentAmount, contractData.currency)}</strong></div>
        </div>
        ${contractData.terms ? `<div style="margin-top:16px;border-left:4px solid #0F3460;background:#EFF6FF;border-radius:12px;padding:14px 16px;white-space:pre-wrap;line-height:1.65;color:#1E3A8A;">${this.escapeHtml(contractData.terms)}</div>` : ''}
      </div>
    `;
  }

  private buildFinancialReportHtml(reportData: {
    title: string;
    period: string;
    date: Date;
    sections: Array<{
      title: string;
      data: Array<{ label: string; value: string }>;
    }>;
  }): string {
    const sections = reportData.sections.map(section => `
      <div style="margin-top:16px;border:1px solid #E5E7EB;border-radius:14px;overflow:hidden;">
        <div style="background:#0F3460;color:#fff;padding:12px 14px;font-weight:800;">${this.escapeHtml(section.title)}</div>
        <div style="padding:12px 14px;">
          ${section.data.map(item => `
            <div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #F3F4F6;">
              <span style="color:#475569;">${this.escapeHtml(item.label)}</span>
              <strong style="color:#111827;text-align:right;">${this.escapeHtml(item.value)}</strong>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    return `
      <div style="padding:24px;">
        <div style="background:linear-gradient(135deg,#111827 0%,#0F3460 100%);color:#fff;border-radius:18px;padding:24px;">
          <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#BFDBFE;">Rapport financier</div>
          <div style="font-size:28px;font-weight:900;margin-top:8px;">${this.escapeHtml(reportData.title)}</div>
          <div style="margin-top:6px;color:#DCE7F5;">Période: ${this.escapeHtml(reportData.period)} • Généré le ${this.formatDate(reportData.date)}</div>
        </div>
        ${sections}
      </div>
    `;
  }

  private escapeHtml(value: string | number | null | undefined): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private formatDate(value?: string | Date): string {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('fr-FR');
  }

  // Remplace les espaces fines insécables (U+202F) et insécables (U+00A0) que Intl 'fr-FR'
  // insère et que la police Roboto embarquée par pdfmake ne rend pas.
  private normalizeSpaces(s: string): string {
    return s.replace(/[  ]/g, ' ');
  }

  private formatNumber(value: number | string | null | undefined): string {
    const parsed = Number(value || 0);
    return this.normalizeSpaces(new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(parsed));
  }

  private formatMoney(value: number | string | null | undefined, currency = 'GNF'): string {
    const formatted = this.normalizeSpaces(new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Number(value || 0)));
    return `${formatted} ${currency}`;
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'PDF service error';

    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return throwError(() => new Error(errorMessage));
  }
}
