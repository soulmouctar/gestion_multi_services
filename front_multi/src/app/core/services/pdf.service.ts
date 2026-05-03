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
  organisation: { name: string; address?: string; phone?: string; email?: string; footer_text?: string };
  generated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  private readonly API_URL = environment.apiUrl;

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
    const [logo, signature, stamp] = await Promise.all([
      this.resolveImageData(invoiceData.organisation?.logoUrl),
      this.resolveImageData(invoiceData.organisation?.signatureUrl),
      this.resolveImageData(invoiceData.organisation?.stampUrl)
    ]);
    const pdfMake = this.getPdfMake();
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

    this.openPrintWindow(
      `Facture ${invoiceData.invoiceNumber}`,
      this.buildProfessionalInvoiceHtml(invoiceData)
    );
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
    const pdfMake = this.getPdfMake();
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

    const docDefinition = this.buildProfessionalReceiptDocDefinition(receiptData);
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

  private getPdfMake(): any {
    return typeof window !== 'undefined' ? (window as any).pdfMake || null : null;
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
    const statusColor = status === 'PAYE' ? '#10B981' : status === 'PARTIEL' ? '#F59E0B' : '#EF4444';
    const metaCard = (label: string, value: string) => ({
      fillColor: '#F8FAFC',
      margin: [0, 0, 0, 0],
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: label, style: 'metaLabel' },
            { text: value, style: 'metaValue' }
          ],
          margin: [10, 10, 10, 10]
        }]]
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0
      }
    });

    const items = (invoiceData.items || []).length > 0
      ? invoiceData.items.map((item, index) => ([
          { text: String(index + 1), style: 'tableCell' },
          { text: item.description || 'Ligne de facture', style: 'tableCell' },
          { text: this.formatNumber(item.quantity), style: 'tableCell', alignment: 'center' },
          { text: this.formatMoney(item.unitPrice, invoiceData.currency), style: 'tableCell', alignment: 'right' },
          { text: this.formatMoney(item.total, invoiceData.currency), style: 'tableCell', alignment: 'right', bold: true, color: '#0F3460' }
        ]))
      : [[
          { text: '1', style: 'tableCell' },
          { text: invoiceData.notes || 'Ligne de facture', style: 'tableCell' },
          { text: '1', style: 'tableCell', alignment: 'center' },
          { text: this.formatMoney(invoiceData.subtotal, invoiceData.currency), style: 'tableCell', alignment: 'right' },
          { text: this.formatMoney(invoiceData.subtotal, invoiceData.currency), style: 'tableCell', alignment: 'right', bold: true, color: '#0F3460' }
        ]];
    const clientDetails = [
      { text: invoiceData.clientName, fontSize: 16, bold: true, color: '#111827' },
      ...(invoiceData.clientAddress ? [{ text: invoiceData.clientAddress, margin: [0, 6, 0, 0], color: '#475569' }] : []),
      ...((invoiceData.clientPhone || invoiceData.clientEmail)
        ? [{ text: [invoiceData.clientPhone, invoiceData.clientEmail].filter(Boolean).join(' • '), margin: [0, 6, 0, 0], color: '#475569' }]
        : [])
    ];
    const totalEquivalentBox = invoiceData.currency !== 'GNF' && invoiceData.totalGnf ? {
      margin: [0, 10, 0, 0],
      table: {
        widths: ['*'],
        body: [[{
          text: `Équivalent GNF: ${this.formatMoney(invoiceData.totalGnf, 'GNF')}`,
          bold: true,
          color: '#1D4ED8',
          margin: [10, 8, 10, 8]
        }]]
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        fillColor: () => '#EFF6FF'
      }
    } : null;
    const notesBox = invoiceData.notes ? {
      margin: [0, 16, 0, 0],
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: 'Notes', style: 'sectionTitle', margin: [0, 0, 0, 6] },
            { text: invoiceData.notes, style: 'noteText' }
          ],
          margin: [12, 12, 12, 12]
        }]]
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        fillColor: () => '#F0FDF4',
        hLineColor: () => '#BBF7D0',
        vLineColor: () => '#BBF7D0'
      }
    } : null;

    return {
      pageSize: 'A4',
      pageMargins: [36, 118, 36, 54],
      info: {
        title: `Facture ${invoiceData.invoiceNumber}`,
        subject: 'Facture professionnelle'
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 9,
        color: '#111827'
      },
      styles: {
        titleSmall: {
          fontSize: 10,
          color: '#BFDBFE',
          bold: true,
          characterSpacing: 1.4
        },
        titleLarge: {
          fontSize: 26,
          bold: true,
          color: '#FFFFFF'
        },
        headerMeta: {
          fontSize: 12,
          color: '#DCE7F5'
        },
        docTitle: {
          fontSize: 24,
          bold: true,
          color: '#FFFFFF'
        },
        sectionTitle: {
          fontSize: 11,
          bold: true,
          color: '#0F3460',
          characterSpacing: 0.6
        },
        tableHeader: {
          fontSize: 8.6,
          bold: true,
          color: '#FFFFFF'
        },
        metaLabel: {
          fontSize: 8.5,
          color: '#64748B',
          bold: true,
          characterSpacing: 0.4
        },
        metaValue: {
          fontSize: 12.5,
          color: '#111827',
          bold: true
        },
        tableCell: {
          fontSize: 8.8,
          color: '#111827'
        },
        noteText: {
          fontSize: 9.2,
          color: '#334155',
          lineHeight: 1.35
        }
      },
      pageBreakBefore: () => false,
      header: () => ({
        margin: [0, 0, 0, 0],
        stack: [
          {
            canvas: [
              { type: 'rect', x: 0, y: 0, w: 595.28, h: 100, color: '#0F172A' },
              { type: 'rect', x: 0, y: 100, w: 595.28, h: 8, color: '#0F3460' }
            ]
          },
          {
            margin: [36, -78, 36, 0],
            columns: [
              {
                width: 92,
                stack: assets.logo ? [
                  { image: assets.logo, fit: [86, 62], alignment: 'left', margin: [0, 0, 0, 4] }
                ] : [
                  { text: invoiceData.organisation?.name || 'GESTION MULTI-MODULES', style: 'headerMeta', bold: true }
                ]
              },
              {
                width: '*',
                stack: [
                  { text: 'FACTURE PROFESSIONNELLE', style: 'titleSmall' },
                  { text: invoiceData.organisation?.name || 'GESTION MULTI-MODULES', style: 'headerMeta', bold: true, margin: [0, 6, 0, 0] },
                  { text: invoiceData.organisation?.motto || 'Facturation détaillée et transparente', style: 'headerMeta', margin: [0, 3, 0, 0] },
                  { text: invoiceData.organisation?.address || '', style: 'headerMeta', margin: [0, 3, 0, 0] },
                  {
                    text: `${invoiceData.organisation?.phone || ''}${invoiceData.organisation?.phone && invoiceData.organisation?.email ? ' • ' : ''}${invoiceData.organisation?.email || ''}`,
                    style: 'headerMeta',
                    margin: [0, 3, 0, 0]
                  }
                ]
              },
              {
                width: 170,
                alignment: 'right',
                stack: [
                  { text: 'FACTURE', style: 'titleLarge', alignment: 'right' },
                  { text: `N° ${invoiceData.invoiceNumber}`, style: 'headerMeta', alignment: 'right', margin: [0, 4, 0, 0] },
                  { text: status, alignment: 'right', margin: [0, 8, 0, 0], color: '#FFFFFF', bold: true, fillColor: statusColor }
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
            text: invoiceData.organisation?.footerText || invoiceData.organisation?.phone || invoiceData.organisation?.email || 'Merci pour votre confiance',
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
          table: {
            widths: ['*', '*', '*', '*'],
            body: [[
              metaCard('Date d’émission', this.formatDate(invoiceData.date || new Date())),
              metaCard('Échéance', this.formatDate(invoiceData.dueDate)),
              metaCard('Devise', invoiceData.currency || 'GNF'),
              metaCard('Taux GNF', invoiceData.currency !== 'GNF' ? this.formatNumber(invoiceData.exchangeRate || 1) : '1')
            ]]
          },
          layout: {
            hLineWidth: () => 0,
            vLineWidth: () => 0,
            paddingLeft: () => 0,
            paddingRight: () => 0,
            paddingTop: () => 0,
            paddingBottom: () => 0
          }
        },
        {
          columns: [
            {
              width: '58%',
              margin: [0, 14, 8, 0],
              stack: [
                { text: 'FACTURÉ À', style: 'sectionTitle', margin: [0, 0, 0, 8] },
                {
                  table: {
                    widths: ['*'],
                    body: [[{
                      stack: clientDetails,
                      margin: [12, 12, 12, 12]
                    }]]
                  },
                  layout: {
                    hLineWidth: () => 1,
                    vLineWidth: () => 1,
                    hLineColor: () => '#E5E7EB',
                    vLineColor: () => '#E5E7EB',
                    fillColor: () => '#FFFFFF'
                  }
                }
              ]
            },
            {
              width: '42%',
              margin: [8, 14, 0, 0],
              stack: [
                { text: 'RÉSUMÉ FINANCIER', style: 'sectionTitle', margin: [0, 0, 0, 8] },
                {
                  table: {
                    widths: ['*', 'auto'],
                    body: [
                      [{ text: 'Sous-total', bold: false, color: '#475569' }, { text: this.formatMoney(invoiceData.subtotal, invoiceData.currency), alignment: 'right', bold: true }],
                      [{ text: 'Arriérés', bold: false, color: '#475569' }, { text: this.formatMoney(invoiceData.previousBalance || 0, invoiceData.currency), alignment: 'right', bold: true, color: '#F59E0B' }],
                      [{ text: 'Total facture', bold: true, color: '#0F3460' }, { text: this.formatMoney(invoiceData.total, invoiceData.currency), alignment: 'right', bold: true, color: '#0F3460', fontSize: 12 }]
                    ]
                  },
                  layout: {
                    hLineWidth: (i: number) => i === 0 ? 0 : 0.6,
                    vLineWidth: () => 0,
                    hLineColor: () => '#E5E7EB',
                    paddingLeft: () => 10,
                    paddingRight: () => 10,
                    paddingTop: () => 8,
                    paddingBottom: () => 8,
                    fillColor: (rowIndex: number) => rowIndex === 2 ? '#EFF6FF' : '#FFFFFF'
                  }
                },
                ...(totalEquivalentBox ? [totalEquivalentBox] : [])
              ]
            }
          ]
        },
        { text: 'LIGNES DE FACTURATION', style: 'sectionTitle', margin: [0, 18, 0, 8] },
        {
          table: {
            headerRows: 1,
            widths: [24, '*', 48, 78, 78],
            body: [
              [
                { text: '#', style: 'tableHeader' },
                { text: 'Description', style: 'tableHeader' },
                { text: 'Qté', style: 'tableHeader', alignment: 'center' },
                { text: 'PU', style: 'tableHeader', alignment: 'right' },
                { text: 'Total', style: 'tableHeader', alignment: 'right' }
              ],
              ...items
            ]
          },
          layout: {
            fillColor: (rowIndex: number) => rowIndex === 0 ? '#0F3460' : rowIndex % 2 === 0 ? '#F8FAFC' : '#FFFFFF',
            hLineColor: () => '#E5E7EB',
            vLineColor: () => '#E5E7EB',
            hLineWidth: () => 0.6,
            vLineWidth: () => 0.6,
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 7,
            paddingBottom: () => 7
          }
        },
        {
          columns: [
            {
              width: '*',
              margin: [0, 16, 8, 0],
              stack: [
                { text: 'VALIDATION', style: 'sectionTitle', margin: [0, 0, 0, 8] },
                {
                  table: {
                    widths: ['*'],
                    body: [[{
                      stack: [
                        { text: 'QR de validation', bold: true, color: '#0F3460', margin: [0, 0, 0, 6] },
                        { text: 'Scannez pour vérifier la facture.', color: '#475569', fontSize: 8.8 },
                        { text: `${invoiceData.invoiceNumber} | ${invoiceData.clientName} | ${this.formatMoney(invoiceData.total, invoiceData.currency)} | ${this.formatDate(invoiceData.date || new Date())}`, color: '#64748B', fontSize: 7.4, margin: [0, 6, 0, 0] }
                      ],
                      margin: [12, 12, 12, 12]
                    }]]
                  },
                  layout: {
                    hLineWidth: () => 0,
                    vLineWidth: () => 0,
                    fillColor: () => '#F8FAFC'
                  }
                }
              ]
            },
            {
              width: 120,
              margin: [8, 16, 0, 0],
              alignment: 'center',
              stack: [
                {
                  qr: `${invoiceData.invoiceNumber} | ${invoiceData.clientName} | ${this.formatMoney(invoiceData.total, invoiceData.currency)} | ${this.formatDate(invoiceData.date || new Date())}`,
                  fit: 92,
                  alignment: 'center',
                  margin: [0, 4, 0, 6]
                },
                { text: 'Vérification', fontSize: 8, color: '#64748B', alignment: 'center' }
              ]
            }
          ]
        },
        {
          columns: [
            {
              width: '50%',
              margin: [0, 8, 6, 0],
              stack: [
                { text: 'Signature', style: 'sectionTitle', margin: [0, 0, 0, 8] },
                {
                  table: {
                    widths: ['*'],
                    body: [[{
                      stack: [
                        assets.signature ? { image: assets.signature, fit: [160, 70], alignment: 'left' } : { text: 'Signature non fournie', color: '#94A3B8', italics: true },
                        { text: invoiceData.organisation?.name || 'GESTION MULTI-MODULES', margin: [0, 8, 0, 0], bold: true, color: '#111827' }
                      ],
                      margin: [12, 12, 12, 12]
                    }]]
                  },
                  layout: {
                    hLineWidth: () => 0,
                    vLineWidth: () => 0,
                    fillColor: () => '#FFFFFF'
                  }
                }
              ]
            },
            {
              width: '50%',
              margin: [6, 8, 0, 0],
              stack: [
                { text: 'Cachet', style: 'sectionTitle', margin: [0, 0, 0, 8] },
                {
                  table: {
                    widths: ['*'],
                    body: [[{
                      stack: [
                        assets.stamp ? { image: assets.stamp, fit: [120, 120], alignment: 'center' } : { text: 'Cachet non fourni', color: '#94A3B8', italics: true, alignment: 'center' }
                      ],
                      margin: [12, 12, 12, 12]
                    }]]
                  },
                  layout: {
                    hLineWidth: () => 0,
                    vLineWidth: () => 0,
                    fillColor: () => '#FFFFFF'
                  }
                }
              ]
            }
          ]
        },
        ...(notesBox ? [notesBox] : []),
        {
          margin: [0, 16, 0, 0],
          text: 'Merci pour votre confiance. Cette facture peut être téléchargée, imprimée ou enregistrée en PDF depuis la boîte de dialogue du navigateur.',
          fontSize: 8.8,
          color: '#64748B'
        }
      ]
    };
  }

  private buildProfessionalReceiptDocDefinition(receiptData: PrintableReceiptData): any {
    const statusColor = receiptData.status === 'COMPLETED' ? '#10B981' : receiptData.status === 'PENDING' ? '#F59E0B' : '#EF4444';
    const qrValue = [
      receiptData.receipt_number,
      receiptData.client?.name || '—',
      this.formatMoney(receiptData.amount, receiptData.currency),
      this.formatDate(receiptData.payment_date)
    ].join(' | ');
    const lineItems = [
      ['Client', receiptData.client?.name || '—'],
      ['Téléphone', receiptData.client?.phone || '—'],
      ['Référence', receiptData.reference || '—'],
      ['Statut', receiptData.status],
      ['Généré le', receiptData.generated_at || this.formatDate(new Date())]
    ];

    return {
      pageSize: 'A4',
      pageMargins: [36, 112, 36, 54],
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
              { type: 'rect', x: 0, y: 0, w: 595.28, h: 96, color: '#0F172A' },
              { type: 'rect', x: 0, y: 96, w: 595.28, h: 8, color: '#0F3460' }
            ]
          },
          {
            margin: [36, -76, 36, 0],
            columns: [
              {
                width: '*',
                stack: [
                  { text: 'REÇU PROFESSIONNEL', style: 'titleSmall' },
                  { text: receiptData.organisation?.name || 'GESTION MULTI-MODULES', style: 'headerMeta', bold: true, margin: [0, 6, 0, 0] },
                  { text: receiptData.organisation?.address || '', style: 'headerMeta', margin: [0, 3, 0, 0] },
                  {
                    text: `${receiptData.organisation?.phone || ''}${receiptData.organisation?.phone && receiptData.organisation?.email ? ' • ' : ''}${receiptData.organisation?.email || ''}`,
                    style: 'headerMeta',
                    margin: [0, 3, 0, 0]
                  }
                ]
              },
              {
                width: 170,
                alignment: 'right',
                stack: [
                  { text: 'REÇU', style: 'titleLarge', alignment: 'right' },
                  { text: receiptData.receipt_number, style: 'headerMeta', alignment: 'right', margin: [0, 4, 0, 0] },
                  { text: receiptData.status, alignment: 'right', margin: [0, 8, 0, 0], color: '#FFFFFF', bold: true, fillColor: statusColor }
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
          columns: [
            {
              width: '*',
              margin: [0, 16, 8, 0],
              stack: [
                { text: 'VALIDATION', style: 'sectionTitle', margin: [0, 0, 0, 8] },
                { text: 'QR de validation', bold: true, color: '#0F3460', margin: [0, 0, 0, 4] },
                { text: 'Scannez pour vérifier le reçu.', color: '#475569', fontSize: 8.8 }
              ]
            },
            {
              width: 120,
              margin: [8, 16, 0, 0],
              alignment: 'center',
              stack: [
                { qr: qrValue, fit: 92, alignment: 'center' },
                { text: 'Vérification', fontSize: 8, color: '#64748B', alignment: 'center' }
              ]
            }
          ]
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

    const runPrint = () => {
      try {
        popup.focus();
        popup.print();
      } catch {
        // no-op
      }
    };

    popup.onafterprint = () => popup.close();
    setTimeout(runPrint, 300);
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

  private formatNumber(value: number | string | null | undefined): string {
    const parsed = Number(value || 0);
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(parsed);
  }

  private formatMoney(value: number | string | null | undefined, currency = 'GNF'): string {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Number(value || 0));
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
