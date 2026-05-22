import { Injectable } from '@angular/core';
import { PaymentReceipt, ClientBalance, ClientBalanceSummary, Payment } from './payment.service';

const DARK = '#0F172A';
const BLUE = '#0F3460';
const GREEN = '#10B981';
const RED = '#EF4444';
const AMBER = '#F59E0B';
const GRAY = '#6B7280';
const BG = '#F8FAFC';

@Injectable({ providedIn: 'root' })
export class PaymentPdfService {

  // ─── pdfMake lazy init ────────────────────────────────────────────────────

  private _pm: any = null;

  private async pm(): Promise<any> {
    if (this._pm) return this._pm;
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const mod = await import('pdfmake/build/pdfmake');
      const pm = (mod as any).default ?? mod;

      pm.fonts = {
        Helvetica: {
          normal: 'Helvetica',
          bold: 'Helvetica-Bold',
          italics: 'Helvetica-Oblique',
          bolditalics: 'Helvetica-BoldOblique',
        },
      };

      this._pm = pm;
      return pm;
    } catch {
      return null;
    }
  }

  // ─── 1. Reçu de paiement ─────────────────────────────────────────────────

  async downloadReceipt(receipt: PaymentReceipt, logoDataUrl?: string): Promise<void> {
    const pm = await this.pm();
    if (!pm) { this.printReceiptHtml(receipt); return; }

    const doc = this.buildReceiptDoc(receipt, logoDataUrl);
    try {
      pm.createPdf(doc).download(`recu-${receipt.receipt_number}.pdf`);
    } catch {
      this.printReceiptHtml(receipt);
    }
  }

  async printReceipt(receipt: PaymentReceipt, logoDataUrl?: string): Promise<void> {
    const pm = await this.pm();
    if (!pm) { this.printReceiptHtml(receipt); return; }

    const doc = this.buildReceiptDoc(receipt, logoDataUrl);
    try {
      pm.createPdf(doc).print();
    } catch {
      this.printReceiptHtml(receipt);
    }
  }

  // ─── 2. Situation client individuelle ────────────────────────────────────

  async downloadClientSituation(balance: ClientBalance, orgName: string): Promise<void> {
    const pm = await this.pm();
    if (!pm) { this.printClientHtml(balance, orgName); return; }
    try {
      pm.createPdf(this.buildClientDoc(balance, orgName))
        .download(`situation-${balance.client.name.replace(/\s+/g, '-')}.pdf`);
    } catch {
      this.printClientHtml(balance, orgName);
    }
  }

  async printClientSituation(balance: ClientBalance, orgName: string): Promise<void> {
    const pm = await this.pm();
    if (!pm) { this.printClientHtml(balance, orgName); return; }
    try {
      pm.createPdf(this.buildClientDoc(balance, orgName)).print();
    } catch {
      this.printClientHtml(balance, orgName);
    }
  }

  // ─── 3. Situation de tous les clients ────────────────────────────────────

  async downloadAllClientsSituation(clients: ClientBalanceSummary[], orgName: string): Promise<void> {
    const pm = await this.pm();
    if (!pm) { this.printAllClientsHtml(clients, orgName); return; }
    try {
      pm.createPdf(this.buildAllClientsDoc(clients, orgName)).download(`situation-clients-${this.dateStr()}.pdf`);
    } catch {
      this.printAllClientsHtml(clients, orgName);
    }
  }

  async printAllClientsSituation(clients: ClientBalanceSummary[], orgName: string): Promise<void> {
    const pm = await this.pm();
    if (!pm) { this.printAllClientsHtml(clients, orgName); return; }
    try {
      pm.createPdf(this.buildAllClientsDoc(clients, orgName)).print();
    } catch {
      this.printAllClientsHtml(clients, orgName);
    }
  }

  // ─── 4. Liste des paiements ───────────────────────────────────────────────

  async downloadPaymentsList(payments: Payment[], orgName: string): Promise<void> {
    const pm = await this.pm();
    if (!pm) { this.printPaymentsHtml(payments, orgName); return; }
    try {
      pm.createPdf(this.buildPaymentsListDoc(payments, orgName)).download(`paiements-${this.dateStr()}.pdf`);
    } catch {
      this.printPaymentsHtml(payments, orgName);
    }
  }

  async printPaymentsList(payments: Payment[], orgName: string): Promise<void> {
    const pm = await this.pm();
    if (!pm) { this.printPaymentsHtml(payments, orgName); return; }
    try {
      pm.createPdf(this.buildPaymentsListDoc(payments, orgName)).print();
    } catch {
      this.printPaymentsHtml(payments, orgName);
    }
  }

  // ─── 5. Situation fournisseur individuel ─────────────────────────────────

  async downloadSupplierSituation(history: any, orgName: string): Promise<void> {
    const pm = await this.pm();
    if (!pm) { this.printSupplierHtml(history, orgName); return; }
    try {
      pm.createPdf(this.buildSupplierDoc(history, orgName))
        .download(`fournisseur-${(history.supplier?.name || 'x').replace(/\s+/g, '-')}.pdf`);
    } catch {
      this.printSupplierHtml(history, orgName);
    }
  }

  async printSupplierSituation(history: any, orgName: string): Promise<void> {
    const pm = await this.pm();
    if (!pm) { this.printSupplierHtml(history, orgName); return; }
    try {
      pm.createPdf(this.buildSupplierDoc(history, orgName)).print();
    } catch {
      this.printSupplierHtml(history, orgName);
    }
  }

  // ─── 6. Situation de tous les fournisseurs ───────────────────────────────

  async downloadAllSuppliersSituation(data: any, orgName: string): Promise<void> {
    const pm = await this.pm();
    if (!pm) { this.printAllSuppliersHtml(data, orgName); return; }
    try {
      pm.createPdf(this.buildAllSuppliersDoc(data, orgName)).download(`fournisseurs-${this.dateStr()}.pdf`);
    } catch {
      this.printAllSuppliersHtml(data, orgName);
    }
  }

  async printAllSuppliersSituation(data: any, orgName: string): Promise<void> {
    const pm = await this.pm();
    if (!pm) { this.printAllSuppliersHtml(data, orgName); return; }
    try {
      pm.createPdf(this.buildAllSuppliersDoc(data, orgName)).print();
    } catch {
      this.printAllSuppliersHtml(data, orgName);
    }
  }

  // ─── 7. Situation tenant (position globale) ───────────────────────────────

  async downloadTenantSituation(data: any, orgName: string): Promise<void> {
    const pm = await this.pm();
    if (!pm) { this.printTenantHtml(data, orgName); return; }
    try {
      pm.createPdf(this.buildTenantDoc(data, orgName)).download(`situation-tenant-${this.dateStr()}.pdf`);
    } catch {
      this.printTenantHtml(data, orgName);
    }
  }

  async printTenantSituation(data: any, orgName: string): Promise<void> {
    const pm = await this.pm();
    if (!pm) { this.printTenantHtml(data, orgName); return; }
    try {
      pm.createPdf(this.buildTenantDoc(data, orgName)).print();
    } catch {
      this.printTenantHtml(data, orgName);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DOC DEFINITIONS
  // ═══════════════════════════════════════════════════════════════

  private baseDoc(title: string) {
    return {
      pageSize: 'A4',
      pageMargins: [36, 110, 36, 50] as [number, number, number, number],
      defaultStyle: { font: 'Helvetica', fontSize: 9, color: '#111827' },
      info: { title },
      styles: {
        h1:  { fontSize: 22, bold: true, color: '#FFFFFF' },
        h2:  { fontSize: 13, bold: true, color: BLUE },
        sub: { fontSize: 8.5, color: '#DCE7F5' },
        lbl: { fontSize: 8, color: GRAY, bold: true },
        val: { fontSize: 11, bold: true, color: '#111827' },
        th:  { fontSize: 8.5, bold: true, color: '#FFFFFF', fillColor: BLUE },
        td:  { fontSize: 8.5, color: '#374151' },
        tda: { fontSize: 8.5, color: '#374151', alignment: 'right' as const },
      },
    };
  }

  private headerBlock(orgName: string, subtitle: string, right: string) {
    return {
      margin: [0, 0, 0, 0],
      stack: [
        { canvas: [{ type: 'rect', x: 0, y: 0, w: 595.28, h: 95, color: DARK }] },
        {
          margin: [36, -78, 36, 0],
          columns: [
            {
              width: '*',
              stack: [
                { text: subtitle.toUpperCase(), style: 'sub', characterSpacing: 1.2 },
                { text: orgName || 'GESTION MULTI-MODULES', style: 'h1', margin: [0, 5, 0, 0] },
              ],
            },
            {
              width: 'auto',
              alignment: 'right' as const,
              stack: [
                { text: right, style: 'sub', alignment: 'right' as const },
                { text: this.formatDate(new Date()), style: 'sub', alignment: 'right' as const, margin: [0, 3, 0, 0] },
              ],
            },
          ],
        },
      ],
    };
  }

  private footerFn(orgName: string) {
    return (page: number, pages: number) => ({
      margin: [36, 0, 36, 16],
      columns: [
        { width: '*', text: `${orgName} — Document généré le ${this.formatDate(new Date())}`, fontSize: 7.5, color: GRAY },
        { width: 'auto', text: `Page ${page}/${pages}`, fontSize: 7.5, color: GRAY },
      ],
    });
  }

  private tableLayout() {
    return {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0,
      hLineColor: () => '#E5E7EB',
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6,
      fillColor: (row: number) => (row === 0 ? BLUE : row % 2 === 0 ? BG : '#FFFFFF'),
    };
  }

  private kpiTable(items: Array<{ label: string; value: string; color?: string }>) {
    const cols = items.map(({ label, value, color }) => ({
      stack: [
        { text: label, style: 'lbl', margin: [0, 0, 0, 4] },
        { text: value, fontSize: 13, bold: true, color: color || '#111827' },
      ],
      margin: [10, 12, 10, 12],
    }));
    return {
      table: {
        widths: items.map(() => '*'),
        body: [cols],
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: (i: number) => (i === 0 || i === items.length ? 0 : 0.6),
        vLineColor: () => '#E5E7EB',
        fillColor: () => BG,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
      margin: [0, 10, 0, 14],
    };
  }

  // ─── Receipt doc ──────────────────────────────────────────────────────────

  private buildReceiptDoc(r: PaymentReceipt, logoDataUrl?: string): any {
    const statusColor = { COMPLETED: GREEN, PENDING: AMBER, FAILED: RED, CANCELLED: GRAY }[r.status] ?? GRAY;
    const qrVal = `${r.receipt_number} | ${r.client?.name || ''} | ${this.fmoney(r.amount, r.currency)} | ${this.formatDate(r.payment_date)}`;

    const logoBlock = logoDataUrl
      ? { image: logoDataUrl, fit: [50, 50], alignment: 'center' as const, margin: [0, 0, 0, 8] }
      : null;

    const invoiceSection: any[] = [];
    if (r.invoice) {
      invoiceSection.push(
        { text: 'FACTURE ASSOCIÉE', style: 'h2', margin: [0, 14, 0, 6] },
        {
          table: {
            widths: ['*', '*', '*'],
            body: [
              [
                { text: 'TOTAL FACTURE', style: 'lbl', alignment: 'center' as const },
                { text: 'DÉJÀ PAYÉ', style: 'lbl', alignment: 'center' as const },
                { text: 'RESTE DÛ', style: 'lbl', alignment: 'center' as const },
              ],
              [
                { text: this.fmoney(r.invoice.total_amount, r.currency), bold: true, alignment: 'center' as const, margin: [0, 4, 0, 4] },
                { text: this.fmoney(r.invoice.paid_amount, r.currency), bold: true, alignment: 'center' as const, color: GREEN, margin: [0, 4, 0, 4] },
                {
                  text: this.fmoney(r.invoice.remaining_balance, r.currency),
                  bold: true, alignment: 'center' as const,
                  color: r.invoice.remaining_balance > 0 ? RED : GREEN,
                  margin: [0, 4, 0, 4],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5, vLineWidth: (i: number) => (i > 0 && i < 3 ? 0.5 : 0),
            hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB',
            fillColor: () => BG,
            paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 4, paddingBottom: () => 4,
          },
        }
      );
    }

    return {
      ...this.baseDoc(`Reçu ${r.receipt_number}`),
      pageMargins: [40, 40, 40, 50] as [number, number, number, number],
      header: () => null,
      footer: this.footerFn(r.organisation.name),
      content: [
        // Logo + org
        ...(logoBlock ? [logoBlock] : []),
        { text: r.organisation.name, fontSize: 15, bold: true, alignment: 'center' as const, color: '#111827' },
        ...(r.organisation.address || r.organisation.phone
          ? [{ text: [r.organisation.address, r.organisation.phone].filter(Boolean).join('  ·  '), fontSize: 8.5, color: GRAY, alignment: 'center' as const, margin: [0, 2, 0, 0] }]
          : []),
        { canvas: [{ type: 'line', x1: 60, y1: 8, x2: 455, y2: 8, lineWidth: 1.5, lineColor: BLUE }] },
        { text: 'REÇU DE PAIEMENT', fontSize: 10, bold: true, color: BLUE, alignment: 'center' as const, characterSpacing: 1.5, margin: [0, 6, 0, 14] },

        // N° + date
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'N° REÇU', style: 'lbl' },
                { text: r.receipt_number, fontSize: 14, bold: true, color: BLUE, fontFamily: 'monospace' },
              ],
            },
            {
              width: 'auto',
              alignment: 'right' as const,
              stack: [
                { text: 'DATE', style: 'lbl', alignment: 'right' as const },
                { text: this.formatDate(r.payment_date), fontSize: 12, bold: true, alignment: 'right' as const },
              ],
            },
          ],
          margin: [0, 0, 0, 10],
        },

        // Client
        ...(r.client ? [{
          table: {
            widths: ['*'],
            body: [[{
              stack: [
                { text: 'CLIENT', style: 'lbl', margin: [0, 0, 0, 4] },
                { text: r.client.name, fontSize: 13, bold: true, color: '#111827' },
                ...(r.client.phone ? [{ text: r.client.phone, fontSize: 9, color: GRAY, margin: [0, 2, 0, 0] }] : []),
              ],
              margin: [12, 10, 12, 10],
            }]],
          },
          layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => BG },
          margin: [0, 0, 0, 12],
        }] : []),

        // Montant
        {
          table: {
            widths: ['*'],
            body: [[{
              stack: [
                { text: 'MONTANT PAYÉ', fontSize: 8.5, color: 'rgba(255,255,255,0.7)', alignment: 'center' as const, characterSpacing: 1.2, margin: [0, 0, 0, 4] },
                { text: `${this.fnum(r.amount)} ${r.currency}`, fontSize: 26, bold: true, color: '#FFFFFF', alignment: 'center' as const },
                { text: this.methodLabel(r.method), fontSize: 9.5, color: 'rgba(255,255,255,0.8)', alignment: 'center' as const, margin: [0, 4, 0, 0] },
                ...(r.amount_gnf && r.currency !== 'GNF'
                  ? [{ text: `Valeur comptable : ${this.fmoney(r.amount_gnf, 'GNF')}`, fontSize: 8, color: 'rgba(255,255,255,0.6)', alignment: 'center' as const, margin: [0, 2, 0, 0] }]
                  : []),
              ],
              margin: [16, 16, 16, 16],
            }]],
          },
          layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => DARK },
          margin: [0, 0, 0, 14],
        },

        // Détails
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              [{ text: 'Type', color: GRAY }, { text: this.typeLabel(r.type), bold: true, alignment: 'right' as const }],
              ...(r.reference ? [[{ text: 'Référence', color: GRAY }, { text: r.reference, bold: true, alignment: 'right' as const }]] : []),
              ...(r.currency !== 'GNF' && r.exchange_rate
                ? [[{ text: 'Taux de change', color: GRAY }, { text: `${r.exchange_rate} → GNF`, bold: true, alignment: 'right' as const }]]
                : []),
              [
                { text: 'Statut', color: GRAY },
                {
                  text: this.statusLabel(r.status),
                  bold: true, alignment: 'right' as const,
                  color: statusColor,
                },
              ],
              ...(r.description ? [[{ text: 'Note', color: GRAY }, { text: r.description, alignment: 'right' as const, color: '#374151' }]] : []),
            ],
          },
          layout: {
            hLineWidth: () => 0.5, vLineWidth: () => 0,
            hLineColor: () => '#E5E7EB',
            paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 7, paddingBottom: () => 7,
          },
          margin: [0, 0, 0, 4],
        },

        // Invoice section
        ...invoiceSection,

        // QR + footer note
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'Généré le ' + this.formatDate(new Date()), fontSize: 8, color: GRAY, margin: [0, 14, 0, 0] },
                { text: 'Ce document fait foi de paiement — ' + r.organisation.name, fontSize: 7.5, color: '#9CA3AF', margin: [0, 2, 0, 0] },
              ],
            },
            {
              width: 80,
              stack: [
                { qr: qrVal, fit: 72, alignment: 'right' as const },
              ],
              margin: [0, 8, 0, 0],
            },
          ],
          margin: [0, 10, 0, 0],
        },
      ],
    };
  }

  // ─── Client doc ───────────────────────────────────────────────────────────

  private buildClientDoc(b: ClientBalance, orgName: string): any {
    const base = this.baseDoc(`Situation client — ${b.client.name}`);
    return {
      ...base,
      header: () => this.headerBlock(orgName, 'Situation Client', b.client.name),
      footer: this.footerFn(orgName),
      content: [
        // KPIs
        this.kpiTable([
          { label: 'TOTAL FACTURÉ', value: this.fmoney(b.total_invoiced, 'GNF') },
          { label: 'TOTAL PAYÉ', value: this.fmoney(b.total_paid, 'GNF'), color: GREEN },
          { label: 'SOLDE RESTANT', value: this.fmoney(b.total_remaining, 'GNF'), color: b.total_remaining > 0 ? RED : GREEN },
          { label: 'CRÉDIT DISPONIBLE', value: this.fmoney(b.available_credit_gnf ?? 0, 'GNF'), color: GREEN },
        ]),

        // Info client
        {
          table: { widths: ['*'], body: [[{
            columns: [
              { width: 'auto', stack: [
                { text: b.client.name, fontSize: 14, bold: true, color: '#111827' },
                ...(b.client.phone ? [{ text: b.client.phone, fontSize: 9, color: GRAY, margin: [0, 2, 0, 0] }] : []),
              ], margin: [12, 10, 12, 10] },
            ],
          }]] },
          layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => BG },
          margin: [0, 0, 0, 14],
        },

        // Factures
        { text: 'FACTURES', style: 'h2', margin: [0, 0, 0, 6] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 70, 70, 70, 50, 50],
            body: [
              [
                { text: 'N° Facture', style: 'th' },
                { text: 'Échéance', style: 'th' },
                { text: 'Total (GNF)', style: 'th', alignment: 'right' as const },
                { text: 'Payé (GNF)', style: 'th', alignment: 'right' as const },
                { text: 'Reste (GNF)', style: 'th', alignment: 'right' as const },
                { text: 'Statut', style: 'th' },
                { text: 'Devise', style: 'th' },
              ],
              ...b.invoices.map(inv => [
                { text: inv.invoice_number, style: 'td', bold: true },
                { text: inv.due_date || '—', style: 'td' },
                { text: this.fnum(inv.total_amount_gnf ?? inv.total_amount), style: 'tda' },
                { text: this.fnum(inv.paid_amount_gnf ?? inv.paid_amount), style: 'tda', color: GREEN },
                {
                  text: this.fnum(inv.remaining_balance_gnf ?? inv.remaining_balance),
                  style: 'tda',
                  color: (inv.remaining_balance_gnf ?? inv.remaining_balance) > 0 ? RED : GREEN,
                  bold: true,
                },
                { text: this.invoiceStatusLabel(inv.status), style: 'td', color: this.invoiceStatusColor(inv.status) },
                { text: 'GNF', style: 'td' },
              ]),
              ...(b.invoices.length === 0 ? [[{ text: 'Aucune facture', colSpan: 7, alignment: 'center' as const, color: GRAY, style: 'td' }, ...Array(6).fill({})]] : []),
            ],
          },
          layout: this.tableLayout(),
          margin: [0, 0, 0, 14],
        },

        // Paiements
        { text: 'HISTORIQUE DES PAIEMENTS', style: 'h2', margin: [0, 0, 0, 6] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', 80, '*'],
            body: [
              [
                { text: 'N° Reçu', style: 'th' },
                { text: 'Date', style: 'th' },
                { text: 'Mode', style: 'th' },
                { text: 'Montant', style: 'th', alignment: 'right' as const },
                { text: 'Description', style: 'th' },
              ],
              ...b.recent_payments.map(p => [
                { text: p.receipt_number, style: 'td', bold: true, color: BLUE },
                { text: p.payment_date, style: 'td' },
                { text: this.methodLabel(p.method), style: 'td' },
                { text: `${this.fnum(p.amount)} ${p.currency}`, style: 'tda', bold: true, color: GREEN },
                { text: '', style: 'td' },
              ]),
              ...(b.recent_payments.length === 0 ? [[{ text: 'Aucun paiement', colSpan: 5, alignment: 'center' as const, color: GRAY, style: 'td' }, ...Array(4).fill({})]] : []),
            ],
          },
          layout: this.tableLayout(),
        },
      ],
    };
  }

  // ─── All clients doc ──────────────────────────────────────────────────────

  private buildAllClientsDoc(clients: ClientBalanceSummary[], orgName: string): any {
    const totalFacture = clients.reduce((s, c) => s + c.total_invoiced, 0);
    const totalPaye   = clients.reduce((s, c) => s + c.total_paid, 0);
    const totalReste  = clients.reduce((s, c) => s + c.total_remaining, 0);

    return {
      ...this.baseDoc('Situation de tous les clients'),
      header: () => this.headerBlock(orgName, 'Situation Globale Clients', `${clients.length} client(s)`),
      footer: this.footerFn(orgName),
      content: [
        this.kpiTable([
          { label: 'TOTAL FACTURÉ', value: this.fmoney(totalFacture, 'GNF') },
          { label: 'TOTAL ENCAISSÉ', value: this.fmoney(totalPaye, 'GNF'), color: GREEN },
          { label: 'SOLDE IMPAYÉ', value: this.fmoney(totalReste, 'GNF'), color: totalReste > 0 ? RED : GREEN },
          { label: 'NB CLIENTS', value: String(clients.length) },
        ]),
        { text: 'DÉTAIL PAR CLIENT', style: 'h2', margin: [0, 0, 0, 6] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 80, 80, 80, 50, 40],
            body: [
              [
                { text: 'Client', style: 'th' },
                { text: 'Téléphone', style: 'th' },
                { text: 'Facturé', style: 'th', alignment: 'right' as const },
                { text: 'Payé', style: 'th', alignment: 'right' as const },
                { text: 'Reste', style: 'th', alignment: 'right' as const },
                { text: 'Factures', style: 'th', alignment: 'center' as const },
                { text: '%', style: 'th', alignment: 'center' as const },
              ],
              ...clients.map(c => {
                const pct = c.total_invoiced > 0 ? Math.min(100, Math.round(c.total_paid / c.total_invoiced * 100)) : 100;
                return [
                  { text: c.client_name, style: 'td', bold: true },
                  { text: c.client_phone || '—', style: 'td' },
                  { text: this.fnum(c.total_invoiced), style: 'tda' },
                  { text: this.fnum(c.total_paid), style: 'tda', color: GREEN },
                  { text: this.fnum(c.total_remaining), style: 'tda', bold: true, color: c.total_remaining > 0 ? RED : GREEN },
                  { text: String(c.invoice_count), style: 'td', alignment: 'center' as const },
                  { text: `${pct}%`, style: 'td', alignment: 'center' as const, color: pct >= 100 ? GREEN : pct >= 50 ? AMBER : RED },
                ];
              }),
              ...(clients.length === 0 ? [[{ text: 'Aucun client', colSpan: 7, alignment: 'center' as const, color: GRAY, style: 'td' }, ...Array(6).fill({})]] : []),
              // Totals row
              [
                { text: 'TOTAL', bold: true, style: 'td', fillColor: BG },
                { text: '', style: 'td', fillColor: BG },
                { text: this.fnum(totalFacture), style: 'tda', bold: true, fillColor: BG },
                { text: this.fnum(totalPaye), style: 'tda', bold: true, color: GREEN, fillColor: BG },
                { text: this.fnum(totalReste), style: 'tda', bold: true, color: totalReste > 0 ? RED : GREEN, fillColor: BG },
                { text: '', style: 'td', fillColor: BG },
                { text: '', style: 'td', fillColor: BG },
              ],
            ],
          },
          layout: this.tableLayout(),
        },
      ],
    };
  }

  // ─── Payments list doc ────────────────────────────────────────────────────

  private buildPaymentsListDoc(payments: Payment[], orgName: string): any {
    const total = payments.reduce((s, p) => s + (p.amount_gnf ?? p.amount), 0);
    return {
      ...this.baseDoc('Liste des paiements'),
      header: () => this.headerBlock(orgName, 'Liste des Paiements', `${payments.length} paiement(s)`),
      footer: this.footerFn(orgName),
      content: [
        this.kpiTable([
          { label: 'NOMBRE DE PAIEMENTS', value: String(payments.length) },
          { label: 'TOTAL (GNF)', value: this.fmoney(total, 'GNF') },
        ]),
        { text: 'PAIEMENTS', style: 'h2', margin: [0, 0, 0, 6] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 80, 60, 50],
            body: [
              [
                { text: 'N° Reçu', style: 'th' },
                { text: 'Client', style: 'th' },
                { text: 'Date', style: 'th' },
                { text: 'Mode', style: 'th' },
                { text: 'Montant', style: 'th', alignment: 'right' as const },
                { text: 'Statut', style: 'th' },
                { text: 'Type', style: 'th' },
              ],
              ...payments.map(p => [
                { text: p.receipt_number || `#${p.id}`, style: 'td', bold: true, color: BLUE },
                { text: p.client?.name || '—', style: 'td' },
                { text: p.payment_date, style: 'td' },
                { text: this.methodLabel(p.method), style: 'td' },
                { text: `${this.fnum(p.amount)} ${p.currency}`, style: 'tda', bold: true, color: this.isIncoming(p.type) ? GREEN : RED },
                { text: this.statusLabel(p.status), style: 'td', color: this.statusColor(p.status) },
                { text: this.typeLabel(p.type), style: 'td' },
              ]),
              ...(payments.length === 0 ? [[{ text: 'Aucun paiement', colSpan: 7, alignment: 'center' as const, color: GRAY, style: 'td' }, ...Array(6).fill({})]] : []),
              [
                { text: 'TOTAL GNF', bold: true, style: 'td', fillColor: BG, colSpan: 4 }, {}, {}, {},
                { text: this.fnum(total), style: 'tda', bold: true, fillColor: BG },
                { text: '', style: 'td', fillColor: BG },
                { text: '', style: 'td', fillColor: BG },
              ],
            ],
          },
          layout: this.tableLayout(),
        },
      ],
    };
  }

  // ─── Supplier doc ─────────────────────────────────────────────────────────

  private buildSupplierDoc(history: any, orgName: string): any {
    const s = history.supplier ?? {};
    const sum = history.summary ?? {};
    const arrivals: any[] = history.arrivals ?? [];
    const payments: any[] = history.payments ?? [];

    return {
      ...this.baseDoc(`Situation fournisseur — ${s.name}`),
      header: () => this.headerBlock(orgName, 'Situation Fournisseur', s.name),
      footer: this.footerFn(orgName),
      content: [
        this.kpiTable([
          { label: 'DETTE TOTALE (GNF)', value: this.fmoney(sum.total_debt_gnf, 'GNF') },
          { label: 'TOTAL VERSÉ (GNF)', value: this.fmoney(sum.total_paid_gnf, 'GNF'), color: GREEN },
          { label: 'SOLDE RESTANT', value: this.fmoney(sum.balance_gnf, 'GNF'), color: sum.balance_gnf > 0 ? RED : GREEN },
          { label: 'AVANCEMENT', value: `${sum.settle_pct ?? 0}%`, color: (sum.settle_pct ?? 0) >= 100 ? GREEN : AMBER },
        ]),

        // Info fournisseur
        {
          table: { widths: ['*'], body: [[{
            columns: [
              { width: '*', stack: [
                { text: s.name, fontSize: 14, bold: true, color: '#111827' },
                ...(s.category ? [{ text: s.category, fontSize: 9, color: GRAY, margin: [0, 2, 0, 0] }] : []),
                ...(s.phone1 ? [{ text: s.phone1, fontSize: 9, color: GRAY }] : []),
              ], margin: [12, 10, 12, 10] },
              { width: 'auto', stack: [
                { text: `${sum.arrival_count ?? 0} arrivages`, fontSize: 9, color: GRAY },
                { text: `${sum.payment_count ?? 0} versements`, fontSize: 9, color: GRAY, margin: [0, 2, 0, 0] },
              ], margin: [12, 10, 12, 10] },
            ],
          }]] },
          layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => BG },
          margin: [0, 0, 0, 14],
        },

        // Arrivages
        { text: 'ARRIVAGES (CONTENEURS)', style: 'h2', margin: [0, 0, 0, 6] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 80, 50, 80, 60],
            body: [
              [
                { text: 'Conteneur', style: 'th' },
                { text: 'Date', style: 'th' },
                { text: 'Montant', style: 'th', alignment: 'right' as const },
                { text: 'Devise', style: 'th' },
                { text: 'Valeur GNF', style: 'th', alignment: 'right' as const },
                { text: 'Statut', style: 'th' },
              ],
              ...arrivals.map(a => [
                { text: a.container_number || '—', style: 'td', bold: true, color: BLUE },
                { text: a.arrival_date || '—', style: 'td' },
                { text: this.fnum(a.purchase_price), style: 'tda' },
                { text: a.currency || 'GNF', style: 'td' },
                { text: this.fnum(a.purchase_price_gnf ?? a.purchase_price), style: 'tda', bold: true },
                { text: a.payment_status || '—', style: 'td', color: a.payment_status === 'SOLDE' ? GREEN : a.payment_status === 'PARTIEL' ? AMBER : RED },
              ]),
              ...(arrivals.length === 0 ? [[{ text: 'Aucun arrivage', colSpan: 6, alignment: 'center' as const, color: GRAY, style: 'td' }, ...Array(5).fill({})]] : []),
            ],
          },
          layout: this.tableLayout(),
          margin: [0, 0, 0, 14],
        },

        // Versements
        { text: 'VERSEMENTS EFFECTUÉS', style: 'h2', margin: [0, 0, 0, 6] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 60, 50, 60, 80, 80, '*'],
            body: [
              [
                { text: 'Date', style: 'th' },
                { text: 'Montant', style: 'th', alignment: 'right' as const },
                { text: 'Devise', style: 'th' },
                { text: 'Taux', style: 'th', alignment: 'right' as const },
                { text: 'Valeur GNF', style: 'th', alignment: 'right' as const },
                { text: 'Solde restant', style: 'th', alignment: 'right' as const },
                { text: 'Réf.', style: 'th' },
              ],
              ...payments.map(p => [
                { text: p.date || '—', style: 'td' },
                { text: this.fnum(p.amount), style: 'tda', bold: true, color: GREEN },
                { text: p.currency || 'GNF', style: 'td' },
                { text: p.exchange_rate ? this.fnum(p.exchange_rate) : '—', style: 'tda' },
                { text: this.fnum(p.amount_gnf ?? p.amount), style: 'tda', bold: true },
                { text: this.fnum(p.running_debt_gnf ?? 0), style: 'tda', color: (p.running_debt_gnf ?? 0) > 0 ? RED : GREEN },
                { text: p.reference || '—', style: 'td', color: GRAY },
              ]),
              ...(payments.length === 0 ? [[{ text: 'Aucun versement', colSpan: 7, alignment: 'center' as const, color: GRAY, style: 'td' }, ...Array(6).fill({})]] : []),
            ],
          },
          layout: this.tableLayout(),
        },
      ],
    };
  }

  // ─── All suppliers doc ────────────────────────────────────────────────────

  private buildAllSuppliersDoc(data: any, orgName: string): any {
    const suppliers: any[] = data.suppliers ?? [];
    const totals = data.totals ?? {};

    return {
      ...this.baseDoc('Situation de tous les fournisseurs'),
      header: () => this.headerBlock(orgName, 'Situation Globale Fournisseurs', `${suppliers.length} fournisseur(s)`),
      footer: this.footerFn(orgName),
      content: [
        this.kpiTable([
          { label: 'TOTAL ENGAGÉ (GNF)', value: this.fmoney(totals.total_debt_gnf, 'GNF') },
          { label: 'TOTAL VERSÉ (GNF)', value: this.fmoney(totals.total_paid_gnf, 'GNF'), color: GREEN },
          { label: 'SOLDE GLOBAL', value: this.fmoney(totals.balance_gnf, 'GNF'), color: (totals.balance_gnf ?? 0) > 0 ? RED : GREEN },
          { label: 'NB FOURNISSEURS', value: String(totals.supplier_count ?? suppliers.length) },
        ]),
        { text: 'DÉTAIL PAR FOURNISSEUR', style: 'h2', margin: [0, 0, 0, 6] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 80, 80, 80, 45],
            body: [
              [
                { text: 'Fournisseur', style: 'th' },
                { text: 'Catégorie', style: 'th' },
                { text: 'Téléphone', style: 'th' },
                { text: 'Engagé (GNF)', style: 'th', alignment: 'right' as const },
                { text: 'Versé (GNF)', style: 'th', alignment: 'right' as const },
                { text: 'Solde (GNF)', style: 'th', alignment: 'right' as const },
                { text: '%', style: 'th', alignment: 'center' as const },
              ],
              ...suppliers.map(s => [
                { text: s.name, style: 'td', bold: true },
                { text: s.category || '—', style: 'td', color: GRAY },
                { text: s.phone1 || '—', style: 'td' },
                { text: this.fnum(s.total_debt_gnf), style: 'tda' },
                { text: this.fnum(s.total_paid_gnf), style: 'tda', color: GREEN },
                { text: this.fnum(s.balance_gnf), style: 'tda', bold: true, color: s.balance_gnf > 0 ? RED : GREEN },
                { text: `${s.settle_pct ?? 0}%`, style: 'td', alignment: 'center' as const, color: (s.settle_pct ?? 0) >= 100 ? GREEN : AMBER },
              ]),
              ...(suppliers.length === 0 ? [[{ text: 'Aucun fournisseur', colSpan: 7, alignment: 'center' as const, color: GRAY, style: 'td' }, ...Array(6).fill({})]] : []),
              [
                { text: 'TOTAL', bold: true, style: 'td', fillColor: BG, colSpan: 3 }, {}, {},
                { text: this.fnum(totals.total_debt_gnf), style: 'tda', bold: true, fillColor: BG },
                { text: this.fnum(totals.total_paid_gnf), style: 'tda', bold: true, color: GREEN, fillColor: BG },
                { text: this.fnum(totals.balance_gnf), style: 'tda', bold: true, color: (totals.balance_gnf ?? 0) > 0 ? RED : GREEN, fillColor: BG },
                { text: '', style: 'td', fillColor: BG },
              ],
            ],
          },
          layout: this.tableLayout(),
        },
      ],
    };
  }

  // ─── Tenant situation doc ─────────────────────────────────────────────────

  private buildTenantDoc(data: any, orgName: string): any {
    const suppliers: any[] = data.suppliers ?? [];
    const totals = data.totals ?? {};
    const settled   = suppliers.filter(s => s.balance_gnf <= 0);
    const unsettled = suppliers.filter(s => s.balance_gnf > 0);

    return {
      ...this.baseDoc('Situation du Tenant'),
      header: () => this.headerBlock(orgName, 'Position Tenant / Consignataires', 'Débit • Crédit'),
      footer: this.footerFn(orgName),
      content: [
        // Global position
        this.kpiTable([
          { label: 'TOTAL ENGAGÉ', value: this.fmoney(totals.total_debt_gnf, 'GNF') },
          { label: 'TOTAL VERSÉ', value: this.fmoney(totals.total_paid_gnf, 'GNF'), color: GREEN },
          { label: 'SOLDE DÛ (DÉBIT)', value: this.fmoney(totals.balance_gnf, 'GNF'), color: RED },
          { label: 'FOURNISSEURS SOLDÉS', value: `${settled.length} / ${suppliers.length}` },
        ]),

        // Non soldés
        { text: 'FOURNISSEURS AVEC SOLDE EN ATTENTE', style: 'h2', margin: [0, 0, 0, 6] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 80, 80, 80, 45],
            body: [
              [
                { text: 'Fournisseur', style: 'th' },
                { text: 'Total engagé', style: 'th', alignment: 'right' as const },
                { text: 'Versé', style: 'th', alignment: 'right' as const },
                { text: 'SOLDE DÛ', style: 'th', alignment: 'right' as const },
                { text: 'Avance %', style: 'th', alignment: 'center' as const },
              ],
              ...unsettled.map(s => [
                { text: s.name, style: 'td', bold: true },
                { text: this.fnum(s.total_debt_gnf), style: 'tda' },
                { text: this.fnum(s.total_paid_gnf), style: 'tda', color: GREEN },
                { text: this.fnum(s.balance_gnf), style: 'tda', bold: true, color: RED },
                { text: `${s.settle_pct ?? 0}%`, style: 'td', alignment: 'center' as const, color: AMBER },
              ]),
              ...(unsettled.length === 0 ? [[{ text: 'Tous les fournisseurs sont soldés ✓', colSpan: 5, alignment: 'center' as const, color: GREEN, bold: true, style: 'td' }, ...Array(4).fill({})]] : []),
            ],
          },
          layout: this.tableLayout(),
          margin: [0, 0, 0, 14],
        },

        // Soldés
        { text: 'FOURNISSEURS SOLDÉS', style: 'h2', margin: [0, 0, 0, 6] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 80, 80, 80],
            body: [
              [
                { text: 'Fournisseur', style: 'th' },
                { text: 'Total engagé', style: 'th', alignment: 'right' as const },
                { text: 'Versé', style: 'th', alignment: 'right' as const },
                { text: 'Excédent', style: 'th', alignment: 'right' as const },
              ],
              ...settled.map(s => [
                { text: s.name, style: 'td', bold: true },
                { text: this.fnum(s.total_debt_gnf), style: 'tda' },
                { text: this.fnum(s.total_paid_gnf), style: 'tda', color: GREEN },
                { text: this.fnum(Math.max(0, s.total_paid_gnf - s.total_debt_gnf)), style: 'tda', color: GREEN },
              ]),
              ...(settled.length === 0 ? [[{ text: 'Aucun fournisseur soldé', colSpan: 4, alignment: 'center' as const, color: GRAY, style: 'td' }, ...Array(3).fill({})]] : []),
            ],
          },
          layout: this.tableLayout(),
        },
      ],
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // HTML FALLBACKS (si pdfmake ne charge pas)
  // ═══════════════════════════════════════════════════════════════

  private printReceiptHtml(r: PaymentReceipt): void {
    const statusColor = { COMPLETED: '#10B981', PENDING: '#F59E0B', FAILED: '#EF4444', CANCELLED: '#6B7280' }[r.status] ?? '#6B7280';
    this.openWin(`Reçu ${r.receipt_number}`, `
      <div style="max-width:500px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;padding:32px 0;">
        <div style="text-align:center;margin-bottom:20px;">
          <img src="/assets/images/logo/mat_kolla_hd.png" style="height:56px;" />
          <div style="font-size:1.1rem;font-weight:700;margin-top:8px;">${this.esc(r.organisation.name)}</div>
          <div style="font-size:.78rem;color:#6B7280;">${this.esc(r.organisation.address || '')} ${r.organisation.phone ? '· ' + this.esc(r.organisation.phone) : ''}</div>
          <div style="margin:14px 0;border-top:2px solid #0F3460;"></div>
          <div style="font-size:.9rem;font-weight:700;letter-spacing:1.5px;color:#0F3460;text-transform:uppercase;">Reçu de paiement</div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
          <div><div style="font-size:.72rem;color:#9CA3AF;text-transform:uppercase;letter-spacing:.4px;">N° Reçu</div>
            <div style="font-size:.95rem;font-weight:700;font-family:monospace;color:#0F3460;">${this.esc(r.receipt_number)}</div></div>
          <div style="text-align:right;"><div style="font-size:.72rem;color:#9CA3AF;text-transform:uppercase;letter-spacing:.4px;">Date</div>
            <div style="font-size:.9rem;font-weight:600;">${this.formatDate(r.payment_date)}</div></div>
        </div>
        ${r.client ? `<div style="background:#F8FAFC;border-radius:10px;padding:12px 14px;margin-bottom:16px;border:1px solid #E5E7EB;">
          <div style="font-size:.72rem;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Client</div>
          <div style="font-size:.95rem;font-weight:700;">${this.esc(r.client.name)}</div>
          ${r.client.phone ? `<div style="font-size:.8rem;color:#6B7280;">${this.esc(r.client.phone)}</div>` : ''}
        </div>` : ''}
        <div style="text-align:center;background:linear-gradient(135deg,#111827,#0F3460);border-radius:12px;padding:20px 16px;margin-bottom:16px;">
          <div style="font-size:.75rem;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Montant payé</div>
          <div style="font-size:1.7rem;font-weight:800;color:#fff;">${this.fnum(r.amount)} <span style="font-size:1rem;">${this.esc(r.currency)}</span></div>
          <div style="font-size:.8rem;color:rgba(255,255,255,.65);margin-top:6px;">${this.methodLabel(r.method)}</div>
          ${r.amount_gnf && r.currency !== 'GNF' ? `<div style="font-size:.75rem;color:rgba(255,255,255,.5);">Valeur comptable : ${this.fmoney(r.amount_gnf, 'GNF')}</div>` : ''}
        </div>
        <div style="margin-bottom:14px;">
          ${this.detailRow('Type', this.typeLabel(r.type))}
          ${r.reference ? this.detailRow('Référence', r.reference) : ''}
          ${r.currency !== 'GNF' && r.exchange_rate ? this.detailRow('Taux de change', `${r.exchange_rate} → GNF`) : ''}
          <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #F3F4F6;font-size:.82rem;">
            <span style="color:#9CA3AF;">Statut</span>
            <span style="font-weight:600;color:${statusColor};">${this.statusLabel(r.status)}</span>
          </div>
          ${r.description ? this.detailRow('Note', r.description) : ''}
        </div>
        ${r.invoice ? `<div style="border:1px solid #E5E7EB;border-radius:10px;padding:12px 14px;margin-bottom:14px;">
          <div style="font-size:.72rem;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Facture associée</div>
          <div style="font-weight:700;color:#111827;margin-bottom:8px;">${this.esc(r.invoice.invoice_number)}</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;">
            <div style="background:#F8FAFC;border-radius:7px;padding:8px;"><div style="font-size:.7rem;color:#9CA3AF;">Total facture</div><div style="font-size:.85rem;font-weight:700;">${this.fnum(r.invoice.total_amount)}</div></div>
            <div style="background:#ECFDF5;border-radius:7px;padding:8px;"><div style="font-size:.7rem;color:#9CA3AF;">Déjà payé</div><div style="font-size:.85rem;font-weight:700;color:#059669;">${this.fnum(r.invoice.paid_amount)}</div></div>
            <div style="background:${r.invoice.remaining_balance > 0 ? '#FEF2F2' : '#ECFDF5'};border-radius:7px;padding:8px;"><div style="font-size:.7rem;color:#9CA3AF;">Reste dû</div><div style="font-size:.85rem;font-weight:700;color:${r.invoice.remaining_balance > 0 ? '#DC2626' : '#059669'};">${this.fnum(r.invoice.remaining_balance)}</div></div>
          </div>
        </div>` : ''}
        <div style="text-align:center;padding-top:12px;border-top:1px solid #F3F4F6;">
          <div style="font-size:.72rem;color:#9CA3AF;">Généré le ${this.formatDate(new Date())}</div>
          <div style="font-size:.7rem;color:#D1D5DB;margin-top:2px;">Ce document fait foi de paiement — ${this.esc(r.organisation.name)}</div>
        </div>
      </div>
    `);
  }

  private printClientHtml(b: ClientBalance, orgName: string): void {
    this.openWin(`Situation client — ${b.client.name}`, `
      <h2 style="color:#0F3460;">${this.esc(b.client.name)}</h2>
      <p style="color:#6B7280;">${orgName}</p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0;">
        ${this.kpiCard('Total facturé', this.fmoney(b.total_invoiced, 'GNF'), '#1D4ED8')}
        ${this.kpiCard('Total payé', this.fmoney(b.total_paid, 'GNF'), '#059669')}
        ${this.kpiCard('Solde restant', this.fmoney(b.total_remaining, 'GNF'), b.total_remaining > 0 ? '#DC2626' : '#059669')}
        ${this.kpiCard('Crédit', this.fmoney(b.available_credit_gnf ?? 0, 'GNF'), '#059669')}
      </div>
      <h3>Factures</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#0F3460;color:#fff;">${['N°', 'Échéance', 'Total', 'Payé', 'Reste', 'Statut'].map(h => `<th style="padding:8px;">${h}</th>`).join('')}</tr></thead>
        <tbody>${b.invoices.map(inv => `<tr>
          <td style="padding:7px;border-bottom:1px solid #E5E7EB;">${this.esc(inv.invoice_number)}</td>
          <td style="padding:7px;border-bottom:1px solid #E5E7EB;">${inv.due_date || '—'}</td>
          <td style="padding:7px;border-bottom:1px solid #E5E7EB;text-align:right;">${this.fnum(inv.total_amount_gnf ?? inv.total_amount)}</td>
          <td style="padding:7px;border-bottom:1px solid #E5E7EB;text-align:right;color:#059669;">${this.fnum(inv.paid_amount_gnf ?? inv.paid_amount)}</td>
          <td style="padding:7px;border-bottom:1px solid #E5E7EB;text-align:right;color:${(inv.remaining_balance_gnf ?? inv.remaining_balance) > 0 ? '#DC2626' : '#059669'};font-weight:700;">${this.fnum(inv.remaining_balance_gnf ?? inv.remaining_balance)}</td>
          <td style="padding:7px;border-bottom:1px solid #E5E7EB;">${this.invoiceStatusLabel(inv.status)}</td>
        </tr>`).join('')}</tbody>
      </table>
    `);
  }

  private printAllClientsHtml(clients: ClientBalanceSummary[], orgName: string): void {
    const total = clients.reduce((s, c) => s + c.total_remaining, 0);
    this.openWin('Situation tous les clients', `
      <h2 style="color:#0F3460;">${orgName} — Situation clients</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#0F3460;color:#fff;">${['Client', 'Tel', 'Facturé', 'Payé', 'Reste', 'Factures'].map(h => `<th style="padding:8px;">${h}</th>`).join('')}</tr></thead>
        <tbody>${clients.map(c => `<tr>
          <td style="padding:7px;border-bottom:1px solid #E5E7EB;font-weight:700;">${this.esc(c.client_name)}</td>
          <td style="padding:7px;border-bottom:1px solid #E5E7EB;">${c.client_phone || '—'}</td>
          <td style="padding:7px;border-bottom:1px solid #E5E7EB;text-align:right;">${this.fnum(c.total_invoiced)}</td>
          <td style="padding:7px;border-bottom:1px solid #E5E7EB;text-align:right;color:#059669;">${this.fnum(c.total_paid)}</td>
          <td style="padding:7px;border-bottom:1px solid #E5E7EB;text-align:right;font-weight:700;color:${c.total_remaining > 0 ? '#DC2626' : '#059669'};">${this.fnum(c.total_remaining)}</td>
          <td style="padding:7px;border-bottom:1px solid #E5E7EB;text-align:center;">${c.invoice_count}</td>
        </tr>`).join('')}
        <tr style="background:#F8FAFC;font-weight:700;"><td colspan="4">TOTAL</td><td style="text-align:right;color:${total > 0 ? '#DC2626' : '#059669'};">${this.fnum(total)}</td><td></td></tr>
        </tbody>
      </table>
    `);
  }

  private printPaymentsHtml(payments: Payment[], orgName: string): void {
    this.openWin('Liste des paiements', `
      <h2 style="color:#0F3460;">${orgName} — Paiements</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#0F3460;color:#fff;">${['N° Reçu', 'Client', 'Date', 'Mode', 'Montant', 'Statut'].map(h => `<th style="padding:8px;">${h}</th>`).join('')}</tr></thead>
        <tbody>${payments.map(p => `<tr>
          <td style="padding:6px;border-bottom:1px solid #E5E7EB;font-family:monospace;color:#0F3460;">${p.receipt_number || '—'}</td>
          <td style="padding:6px;border-bottom:1px solid #E5E7EB;">${p.client?.name || '—'}</td>
          <td style="padding:6px;border-bottom:1px solid #E5E7EB;">${p.payment_date}</td>
          <td style="padding:6px;border-bottom:1px solid #E5E7EB;">${this.methodLabel(p.method)}</td>
          <td style="padding:6px;border-bottom:1px solid #E5E7EB;text-align:right;font-weight:700;color:${this.isIncoming(p.type) ? '#059669' : '#DC2626'};">${this.fnum(p.amount)} ${p.currency}</td>
          <td style="padding:6px;border-bottom:1px solid #E5E7EB;">${this.statusLabel(p.status)}</td>
        </tr>`).join('')}</tbody>
      </table>
    `);
  }

  private printSupplierHtml(history: any, orgName: string): void {
    const s = history.supplier ?? {};
    const sum = history.summary ?? {};
    this.openWin(`Situation fournisseur — ${s.name}`, `
      <h2 style="color:#0F3460;">${this.esc(s.name)}</h2>
      <p>${orgName}</p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0;">
        ${this.kpiCard('Dette totale', this.fmoney(sum.total_debt_gnf, 'GNF'), '#DC2626')}
        ${this.kpiCard('Total versé', this.fmoney(sum.total_paid_gnf, 'GNF'), '#059669')}
        ${this.kpiCard('Solde restant', this.fmoney(sum.balance_gnf, 'GNF'), sum.balance_gnf > 0 ? '#DC2626' : '#059669')}
        ${this.kpiCard('Avancement', `${sum.settle_pct ?? 0}%`, '#D97706')}
      </div>
      <h3>Versements</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#0F3460;color:#fff;">${['Date', 'Montant', 'Devise', 'Valeur GNF', 'Solde restant', 'Réf'].map(h => `<th style="padding:8px;">${h}</th>`).join('')}</tr></thead>
        <tbody>${(history.payments ?? []).map((p: any) => `<tr>
          <td style="padding:6px;border-bottom:1px solid #E5E7EB;">${p.date}</td>
          <td style="padding:6px;border-bottom:1px solid #E5E7EB;text-align:right;color:#059669;font-weight:700;">${this.fnum(p.amount)} ${p.currency}</td>
          <td style="padding:6px;border-bottom:1px solid #E5E7EB;">${p.currency}</td>
          <td style="padding:6px;border-bottom:1px solid #E5E7EB;text-align:right;">${this.fnum(p.amount_gnf ?? p.amount)}</td>
          <td style="padding:6px;border-bottom:1px solid #E5E7EB;text-align:right;font-weight:700;color:${(p.running_debt_gnf ?? 0) > 0 ? '#DC2626' : '#059669'};">${this.fnum(p.running_debt_gnf ?? 0)}</td>
          <td style="padding:6px;border-bottom:1px solid #E5E7EB;color:#6B7280;">${p.reference || '—'}</td>
        </tr>`).join('')}</tbody>
      </table>
    `);
  }

  private printAllSuppliersHtml(data: any, orgName: string): void {
    const suppliers: any[] = data.suppliers ?? [];
    const totals = data.totals ?? {};
    this.openWin('Situation tous les fournisseurs', `
      <h2 style="color:#0F3460;">${orgName} — Fournisseurs</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0;">
        ${this.kpiCard('Total engagé', this.fmoney(totals.total_debt_gnf, 'GNF'), '#1D4ED8')}
        ${this.kpiCard('Total versé', this.fmoney(totals.total_paid_gnf, 'GNF'), '#059669')}
        ${this.kpiCard('Solde global', this.fmoney(totals.balance_gnf, 'GNF'), (totals.balance_gnf ?? 0) > 0 ? '#DC2626' : '#059669')}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#0F3460;color:#fff;">${['Fournisseur', 'Catégorie', 'Engagé', 'Versé', 'Solde', '%'].map(h => `<th style="padding:8px;">${h}</th>`).join('')}</tr></thead>
        <tbody>${suppliers.map(s => `<tr>
          <td style="padding:6px;border-bottom:1px solid #E5E7EB;font-weight:700;">${this.esc(s.name)}</td>
          <td style="padding:6px;border-bottom:1px solid #E5E7EB;color:#6B7280;">${s.category || '—'}</td>
          <td style="padding:6px;border-bottom:1px solid #E5E7EB;text-align:right;">${this.fnum(s.total_debt_gnf)}</td>
          <td style="padding:6px;border-bottom:1px solid #E5E7EB;text-align:right;color:#059669;">${this.fnum(s.total_paid_gnf)}</td>
          <td style="padding:6px;border-bottom:1px solid #E5E7EB;text-align:right;font-weight:700;color:${s.balance_gnf > 0 ? '#DC2626' : '#059669'};">${this.fnum(s.balance_gnf)}</td>
          <td style="padding:6px;border-bottom:1px solid #E5E7EB;text-align:center;">${s.settle_pct ?? 0}%</td>
        </tr>`).join('')}</tbody>
      </table>
    `);
  }

  private printTenantHtml(data: any, orgName: string): void {
    this.printAllSuppliersHtml(data, orgName); // same structure but re-titled
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private openWin(title: string, body: string): void {
    const w = window.open('', '_blank', 'width=1100,height=850,noopener,noreferrer');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${this.esc(title)}</title>
    <style>*{box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:24px;background:#E9EEF5;color:#111827;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{max-width:900px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 18px 60px rgba(0,0,0,.12)}
    @media print{body{background:#fff;padding:0}.page{border-radius:0;box-shadow:none}.no-print{display:none!important}}</style></head>
    <body><div class="page"><div class="no-print" style="margin-bottom:16px;display:flex;gap:8px;">
      <button onclick="window.print()" style="background:#0F3460;color:#fff;border:none;border-radius:8px;padding:8px 18px;cursor:pointer;font-size:14px;">🖨 Imprimer / Enregistrer PDF</button>
      <button onclick="window.close()" style="background:#F3F4F6;color:#374151;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;">✕ Fermer</button>
    </div>${body}</div></body></html>`);
    w.document.close();
    w.focus();
  }

  private kpiCard(label: string, value: string, color: string): string {
    return `<div style="background:#F8FAFC;border:1px solid #E5E7EB;border-radius:10px;padding:14px;text-align:center;">
      <div style="font-size:11px;text-transform:uppercase;color:#6B7280;margin-bottom:6px;">${label}</div>
      <div style="font-size:1rem;font-weight:700;color:${color};">${value}</div>
    </div>`;
  }

  private detailRow(label: string, value: string): string {
    return `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #F3F4F6;font-size:.82rem;">
      <span style="color:#9CA3AF;">${label}</span>
      <span style="font-weight:600;color:#374151;">${this.esc(value)}</span>
    </div>`;
  }

  private esc(v: string | null | undefined): string {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private fnum(v: number | null | undefined): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(v ?? 0));
  }

  private fmoney(v: number | null | undefined, currency = 'GNF'): string {
    return `${this.fnum(v)} ${currency}`;
  }

  private formatDate(v: string | Date | null | undefined): string {
    if (!v) return '—';
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('fr-FR');
  }

  private dateStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private isIncoming(type: string): boolean { return type === 'CLIENT' || type === 'DEPOT'; }

  private typeLabel(t: string): string {
    return ({ CLIENT: 'Paiement Client', SUPPLIER: 'Fournisseur', DEPOT: 'Dépôt', RETRAIT: 'Retrait' } as any)[t] ?? t;
  }

  private methodLabel(m: string): string {
    return ({ ESPECES: 'Espèces', ORANGE_MONEY: 'Orange Money', WAVE: 'Wave', MTN_MONEY: 'MTN Money', VIREMENT: 'Virement', CHEQUE: 'Chèque' } as any)[m] ?? m;
  }

  private statusLabel(s: string): string {
    return ({ COMPLETED: 'Complété', PENDING: 'En attente', FAILED: 'Échoué', CANCELLED: 'Annulé' } as any)[s] ?? s;
  }

  private statusColor(s: string): string {
    return ({ COMPLETED: GREEN, PENDING: AMBER, FAILED: RED, CANCELLED: GRAY } as any)[s] ?? GRAY;
  }

  private invoiceStatusLabel(s: string): string {
    return ({ PAYE: 'Payée', PARTIEL: 'Partielle', IMPAYE: 'Impayée' } as any)[s] ?? s;
  }

  private invoiceStatusColor(s: string): string {
    return ({ PAYE: GREEN, PARTIEL: AMBER, IMPAYE: RED } as any)[s] ?? GRAY;
  }
}
