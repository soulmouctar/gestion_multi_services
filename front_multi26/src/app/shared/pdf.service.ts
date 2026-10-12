import { inject, Injectable } from '@angular/core';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ToastService } from './toast.service';

interface Organisation {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
}

export interface PdfColumn {
  header: string;
  /** Les montants et les quantités s'alignent à droite. */
  align?: 'left' | 'right';
  /** Largeur pdfmake : « * » prend la place restante, « auto » suit le contenu. */
  width?: string | number;
}

export interface PdfTable {
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  rows: (string | number | null | undefined)[][];
  /** Lignes de total, en gras, sous le tableau. */
  totals?: (string | number | null | undefined)[][];
  /** Paysage pour les tableaux larges. */
  landscape?: boolean;
  /** Chiffres clés affichés en bandeau au-dessus du tableau. */
  facts?: { label: string; value: string }[];
}

export interface PdfReceipt {
  title: string;
  number: string | number;
  date: string;
  /** La première ligne nomme la personne, la ligne « main » porte le montant, les autres sont des détails. */
  lines: { label: string; value: string; main?: boolean }[];
  leftSignature?: string;
}

export interface PdfInvoice {
  title: string;
  number: string;
  date: string;
  client: string;
  clientPhone?: string | null;
  currency?: string;
  status?: 'PAYE' | 'PARTIEL' | 'IMPAYE';
  items: { designation: string; unit: string; quantity: string; unitPrice: string; total: string }[];
  totals: { label: string; value: string; strong?: boolean }[];
  note?: string | null;
}

// Charte des documents imprimés, reprise des reçus et factures de l'application d'origine
const DARK = '#0F172A';
const BLUE = '#0F3460';
const GREEN = '#10B981';
const GRAY = '#6B7280';
const SLATE = '#64748B';
const BG = '#F8FAFC';
const LINE = '#E5E7EB';

const A4 = { portrait: 595.28, landscape: 841.89 };
/** Logo en pleine définition, réservé à l'impression. */
const PRINT_LOGO = 'images/logo-print.png';

/** Les espaces insécables de la mise en forme française n'existent pas dans la police du PDF. */
function clean(value: unknown): string {
  return String(value ?? '').replace(/[   ]/g, ' ');
}

function frenchDate(value: string | Date): string {
  if (value instanceof Date) {
    return new Intl.DateTimeFormat('fr-FR').format(value);
  }
  const [year, month, day] = value.slice(0, 10).split('-');
  return day && month && year ? `${day}/${month}/${year}` : value;
}

/** Tableau à en-tête bleu et lignes alternées, comme sur les états d'origine. */
function striped(headerRows = 1) {
  return {
    hLineWidth: () => 0.5,
    vLineWidth: () => 0,
    hLineColor: () => LINE,
    paddingLeft: () => 8,
    paddingRight: () => 8,
    paddingTop: () => 6,
    paddingBottom: () => 6,
    fillColor: (row: number) => (row < headerRows ? BLUE : row % 2 === 0 ? BG : '#FFFFFF'),
  };
}

/**
 * États d'impression en PDF : reçus, factures, relevés et listes.
 * Texte vectoriel et logo en pleine définition : le document reste net à l'impression.
 */
@Injectable({ providedIn: 'root' })
export class PdfService {
  readonly #api = inject(ApiService);
  readonly #auth = inject(AuthService);
  readonly #toast = inject(ToastService);

  #organisation?: Promise<Organisation & { logo?: string }>;
  #organisationFor?: string;

  /** Reçu : encaissement d'un client, paiement à un fournisseur, loyer. */
  async receipt(model: PdfReceipt): Promise<void> {
    const organisation = await this.#loadOrganisation();
    const [party, ...others] = model.lines;
    const amount = others.find((line) => line.main);
    const details = others.filter((line) => !line.main);
    const contact = [organisation.address, organisation.phone].filter(Boolean).join('  ·  ');
    const qr = [model.number, party?.value, amount?.value, frenchDate(model.date)].filter(Boolean).map(clean).join(' | ');

    const content: Content[] = [
      ...(organisation.logo ? [{ image: organisation.logo, fit: [150, 62], alignment: 'center', margin: [0, 0, 0, 8] } as Content] : []),
      { text: clean(organisation.name), fontSize: 15, bold: true, alignment: 'center', color: '#111827' },
      ...(contact ? [{ text: clean(contact), fontSize: 8.5, color: GRAY, alignment: 'center', margin: [0, 2, 0, 0] } as Content] : []),
      { canvas: [{ type: 'line', x1: 60, y1: 8, x2: 455, y2: 8, lineWidth: 1.5, lineColor: BLUE }] },
      { text: clean(model.title).toUpperCase(), fontSize: 10, bold: true, color: BLUE, alignment: 'center', characterSpacing: 1.5, margin: [0, 6, 0, 14] },
      {
        margin: [0, 0, 0, 10],
        columns: [
          { width: '*', stack: [{ text: 'N° REÇU', style: 'lbl' }, { text: clean(model.number), fontSize: 14, bold: true, color: BLUE }] },
          { width: 'auto', stack: [{ text: 'DATE', style: 'lbl', alignment: 'right' }, { text: frenchDate(model.date), fontSize: 12, bold: true, alignment: 'right' }] },
        ],
      },
      ...(party
        ? [
            {
              margin: [0, 0, 0, 12],
              table: {
                widths: ['*'],
                body: [[{ margin: [12, 10, 12, 10], stack: [{ text: clean(party.label).toUpperCase(), style: 'lbl', margin: [0, 0, 0, 4] }, { text: clean(party.value), fontSize: 13, bold: true, color: '#111827' }] }]],
              },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => BG },
            } as Content,
          ]
        : []),
      ...(amount
        ? [
            {
              margin: [0, 0, 0, 14],
              table: {
                widths: ['*'],
                body: [
                  [
                    {
                      margin: [16, 16, 16, 16],
                      stack: [
                        { text: clean(amount.label).toUpperCase(), fontSize: 8.5, color: '#CBD5E1', alignment: 'center', characterSpacing: 1.2, margin: [0, 0, 0, 4] },
                        { text: clean(amount.value), fontSize: 26, bold: true, color: '#FFFFFF', alignment: 'center' },
                      ],
                    },
                  ],
                ],
              },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => DARK },
            } as Content,
          ]
        : []),
      ...(details.length
        ? [
            {
              margin: [0, 0, 0, 4],
              table: {
                widths: ['*', 'auto'],
                body: details.map((line) => [{ text: clean(line.label), color: GRAY }, { text: clean(line.value), bold: true, alignment: 'right' }]),
              },
              layout: { hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: () => LINE, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 7, paddingBottom: () => 7 },
            } as Content,
          ]
        : []),
      {
        margin: [0, 26, 0, 0],
        columns: [
          { width: '*', stack: [{ text: clean(model.leftSignature ?? 'Signature du client').toUpperCase(), style: 'lbl', margin: [0, 0, 0, 30] }, { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 170, y2: 0, lineWidth: 0.5, lineColor: '#94A3B8' }] }] },
          { width: '*', stack: [{ text: 'SIGNATURE ET CACHET', style: 'lbl', alignment: 'right', margin: [0, 0, 0, 30] }, { canvas: [{ type: 'line', x1: 87, y1: 0, x2: 257, y2: 0, lineWidth: 0.5, lineColor: '#94A3B8' }] }] },
        ],
      },
      {
        margin: [0, 16, 0, 0],
        columns: [
          {
            width: '*',
            stack: [
              { text: 'Généré le ' + frenchDate(new Date()), fontSize: 8, color: GRAY, margin: [0, 14, 0, 0] },
              { text: clean('Ce document fait foi de paiement — ' + organisation.name), fontSize: 7.5, color: '#9CA3AF', margin: [0, 2, 0, 0] },
            ],
          },
          { width: 80, margin: [0, 8, 0, 0], stack: [{ qr, fit: 72, alignment: 'right' }] },
        ],
      },
    ];

    await this.#open({ ...this.#base(`${model.title} ${model.number}`, organisation.name), pageMargins: [40, 40, 40, 50], content });
  }

  /** Facture d'une vente, avec ses lignes et ses totaux. */
  async invoice(model: PdfInvoice): Promise<void> {
    const organisation = await this.#loadOrganisation();
    const badge = {
      PAYE: { label: 'Payée', color: '#047857', bg: '#ECFDF5' },
      PARTIEL: { label: 'Partielle', color: '#B45309', bg: '#FFFBEB' },
      IMPAYE: { label: 'Impayée', color: '#B91C1C', bg: '#FEF2F2' },
    }[model.status ?? 'IMPAYE'];
    const contact = [organisation.address, [organisation.phone, organisation.email].filter(Boolean).join(' | ')].filter(Boolean);
    const info = (label: string, value: string): TableCell[] => [{ text: label, style: 'muted' }, { text: clean(value) || '-', alignment: 'right', bold: true, color: '#111827' }];
    const netIndex = model.totals.map((line) => !!line.strong).lastIndexOf(true);

    const content: Content[] = [
      {
        columns: [
          {
            width: '*',
            stack: [
              ...(organisation.logo ? [{ image: organisation.logo, fit: [108, 58], margin: [0, 0, 0, 8] } as Content] : []),
              { text: clean(organisation.name), fontSize: 14, bold: true, color: '#111827' },
              ...contact.map((line) => ({ text: clean(line), style: 'small', margin: [0, 3, 0, 0] }) as Content),
            ],
          },
          {
            width: 210,
            stack: [
              { text: clean(model.title).toUpperCase(), fontSize: 28, bold: true, color: BLUE, alignment: 'right' },
              { text: `N° ${clean(model.number)}`, fontSize: 11, bold: true, color: '#111827', alignment: 'right', margin: [0, 5, 0, 0] },
              {
                margin: [0, 10, 0, 0],
                columns: [
                  { width: '*', text: '' },
                  {
                    width: 'auto',
                    table: { body: [[{ text: badge.label, bold: true, color: badge.color, fillColor: badge.bg, margin: [12, 5, 12, 5], fontSize: 9 }]] },
                    layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
                  },
                ],
              },
            ],
          },
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 519, y2: 0, lineWidth: 1, lineColor: LINE }], margin: [0, 18, 0, 18] },
      {
        margin: [0, 0, 0, 20],
        columns: [
          {
            width: '55%',
            stack: [
              { text: 'FACTURÉ À', style: 'section', margin: [0, 0, 0, 7] },
              { text: clean(model.client) || '-', fontSize: 14, bold: true, color: '#111827' },
              ...(model.clientPhone ? [{ text: clean(model.clientPhone), color: '#475569', margin: [0, 5, 0, 0] } as Content] : []),
            ],
          },
          {
            width: '45%',
            table: { widths: ['*', 'auto'], body: [info('Date facture', frenchDate(model.date)), info('Devise', model.currency ?? 'GNF')] },
            layout: { hLineWidth: (i: number) => (i === 0 ? 0 : 0.5), vLineWidth: () => 0, hLineColor: () => LINE, paddingLeft: () => 10, paddingRight: () => 10, paddingTop: () => 7, paddingBottom: () => 7, fillColor: () => BG },
          },
        ],
      },
      {
        table: {
          headerRows: 1,
          widths: [26, '*', 62, 48, 86, 92],
          body: [
            [
              { text: '#', style: 'th', alignment: 'center' },
              { text: 'Désignation', style: 'th' },
              { text: 'Unité', style: 'th' },
              { text: 'Qté', style: 'th', alignment: 'center' },
              { text: 'Prix unit.', style: 'th', alignment: 'right' },
              { text: 'Montant', style: 'th', alignment: 'right' },
            ],
            ...model.items.map((item, index) => [
              { text: String(index + 1), style: 'td', alignment: 'center' },
              { text: clean(item.designation), style: 'td' },
              { text: clean(item.unit), style: 'td' },
              { text: clean(item.quantity), style: 'td', alignment: 'center' },
              { text: clean(item.unitPrice), style: 'td', alignment: 'right' },
              { text: clean(item.total), style: 'td', alignment: 'right', bold: true },
            ] as TableCell[]),
          ],
        },
        layout: { ...striped(), paddingLeft: () => 9, paddingRight: () => 9, paddingTop: () => 8, paddingBottom: () => 8 },
      },
      {
        columns: [
          {
            width: '*',
            margin: [0, 18, 20, 0],
            stack: model.note
              ? [{ text: 'NOTES', style: 'section', margin: [0, 0, 0, 6] }, { text: clean(model.note), color: '#475569', lineHeight: 1.25 }]
              : [{ text: 'CONDITIONS', style: 'section', margin: [0, 0, 0, 6] }, { text: 'Paiement à effectuer selon les conditions convenues avec le client.', color: '#475569', lineHeight: 1.25 }],
          },
          {
            width: 225,
            margin: [0, 18, 0, 0],
            table: {
              widths: ['*', 'auto'],
              body: model.totals.map((line, index) =>
                index === netIndex
                  ? [{ text: clean(line.label).toUpperCase(), bold: true, color: BLUE, fontSize: 10.5 }, { text: clean(line.value), alignment: 'right', bold: true, color: BLUE, fontSize: 13 }]
                  : info(line.label, line.value),
              ),
            },
            layout: {
              hLineWidth: (i: number) => (i === 0 ? 0 : 0.5),
              vLineWidth: () => 0,
              hLineColor: () => LINE,
              paddingLeft: () => 10,
              paddingRight: () => 10,
              paddingTop: () => 8,
              paddingBottom: () => 8,
              fillColor: (row: number) => (row === netIndex ? '#EFF6FF' : '#FFFFFF'),
            },
          },
        ],
      },
      {
        columns: [
          {
            width: '*',
            margin: [0, 28, 12, 0],
            stack: [
              { text: 'Signature', style: 'section', margin: [0, 0, 0, 34] },
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 170, y2: 0, lineWidth: 0.5, lineColor: '#94A3B8' }], margin: [0, 6, 0, 4] },
              { text: clean(organisation.name), bold: true, color: BLUE, fontSize: 9 },
            ],
          },
          {
            width: '*',
            margin: [12, 28, 0, 0],
            stack: [
              { text: 'Cachet', style: 'section', alignment: 'right', margin: [0, 0, 0, 10] },
              { text: 'Cachet de la société', alignment: 'right', color: '#CBD5E1', italics: true, margin: [0, 34, 0, 0] },
            ],
          },
        ],
      },
    ];

    await this.#open({
      ...this.#base(`${model.title} ${model.number}`, organisation.name),
      pageMargins: [38, 34, 38, 34],
      footer: (current: number, total: number) => ({
        margin: [38, 0, 38, 18],
        columns: [
          { width: '*', text: 'Merci pour votre confiance.', fontSize: 8, color: SLATE },
          { width: 'auto', text: `Page ${current} / ${total}`, fontSize: 8, color: SLATE },
        ],
      }),
      content,
    });
  }

  /** Liste : un bandeau de chiffres clés, puis le tableau. */
  async table(model: PdfTable): Promise<void> {
    await this.tables(model.title, model.subtitle ?? '', [{ ...model, title: '' }], !!model.landscape);
  }

  /** Relevé ou situation : un tableau par section (par devise, par exemple) sous le même bandeau. */
  async tables(title: string, subtitle: string, sections: PdfTable[], landscape = false): Promise<void> {
    const organisation = await this.#loadOrganisation();
    const content: Content[] = [];
    if (subtitle) {
      content.push({ text: clean(subtitle), color: GRAY, margin: [0, 0, 0, 4] });
    }
    for (const section of sections) {
      if (section.facts?.length) {
        content.push(this.#kpis(section.facts));
      }
      if (section.title) {
        content.push({ text: clean(section.title).toUpperCase(), style: 'h2', margin: [0, 10, 0, section.subtitle ? 2 : 6] });
      }
      if (section.title && section.subtitle) {
        content.push({ text: clean(section.subtitle), color: GRAY, margin: [0, 0, 0, 6] });
      }
      content.push(this.#table(section));
    }

    await this.#open({
      ...this.#base(title, organisation.name),
      pageOrientation: landscape ? 'landscape' : 'portrait',
      pageMargins: [36, 110, 36, 50],
      header: () => this.#band(organisation.name, title, landscape ? A4.landscape : A4.portrait),
      content,
    });
  }

  /** Bandeau sombre en tête de page : nature du document, organisation, date. */
  #band(organisation: string, title: string, width: number): Content {
    return {
      stack: [
        { canvas: [{ type: 'rect', x: 0, y: 0, w: width, h: 95, color: DARK }] },
        {
          margin: [36, -78, 36, 0],
          columns: [
            {
              width: '*',
              stack: [
                { text: clean(title).toUpperCase(), fontSize: 8.5, color: '#DCE7F5', characterSpacing: 1.2 },
                { text: clean(organisation), fontSize: 22, bold: true, color: '#FFFFFF', margin: [0, 5, 0, 0] },
              ],
            },
            { width: 'auto', stack: [{ text: 'Édité le', fontSize: 8.5, color: '#DCE7F5', alignment: 'right' }, { text: frenchDate(new Date()), fontSize: 8.5, color: '#DCE7F5', alignment: 'right', margin: [0, 3, 0, 0] }] },
          ],
        },
      ],
    };
  }

  /** Chiffres clés sur fond clair, séparés par un filet. */
  #kpis(items: { label: string; value: string }[]): Content {
    return {
      margin: [0, 6, 0, 10],
      table: {
        widths: items.map(() => '*'),
        body: [items.map((item) => ({ margin: [10, 12, 10, 12], stack: [{ text: clean(item.label).toUpperCase(), style: 'lbl', margin: [0, 0, 0, 4] }, { text: clean(item.value), fontSize: 13, bold: true, color: '#111827' }] }) as TableCell)],
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: (i: number) => (i === 0 || i === items.length ? 0 : 0.6),
        vLineColor: () => LINE,
        fillColor: () => BG,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
    };
  }

  #table(model: PdfTable): Content {
    if (!model.rows.length) {
      return { text: 'Aucune ligne.', color: GRAY, margin: [0, 6, 0, 8] };
    }
    const align = (index: number) => model.columns[index]?.align ?? 'left';
    // Un solde négatif (avance) ressort en vert, comme sur les relevés d'origine
    const tone = (value: unknown, index: number) => (align(index) === 'right' && /^-\s?\d/.test(clean(value)) ? GREEN : '#374151');
    return {
      margin: [0, 0, 0, 12],
      table: {
        headerRows: 1,
        widths: model.columns.map((column) => column.width ?? (column.align === 'right' ? 'auto' : '*')),
        body: [
          model.columns.map((column) => ({ text: column.header, style: 'th', alignment: column.align ?? 'left', noWrap: column.align === 'right' }) as TableCell),
          ...model.rows.map((row) => row.map((value, index) => ({ text: clean(value ?? '—'), style: 'td', alignment: align(index), color: tone(value, index), noWrap: align(index) === 'right' }) as TableCell)),
          ...(model.totals ?? []).map((row) => row.map((value, index) => ({ text: clean(value ?? ''), style: 'td', bold: true, color: BLUE, fillColor: '#EFF6FF', alignment: align(index), noWrap: align(index) === 'right' }) as TableCell)),
        ],
      },
      layout: striped(),
    };
  }

  #base(title: string, organisation: string): Pick<TDocumentDefinitions, 'pageSize' | 'defaultStyle' | 'info' | 'styles' | 'footer'> {
    return {
      pageSize: 'A4',
      defaultStyle: { fontSize: 9, color: '#111827' },
      info: { title: clean(title) },
      styles: {
        h2: { fontSize: 13, bold: true, color: BLUE },
        lbl: { fontSize: 8, color: GRAY, bold: true },
        section: { fontSize: 9.5, bold: true, color: BLUE, characterSpacing: 0.6 },
        muted: { fontSize: 8.4, color: SLATE },
        small: { fontSize: 8, color: SLATE },
        th: { fontSize: 8.5, bold: true, color: '#FFFFFF' },
        td: { fontSize: 8.5, color: '#374151' },
      },
      footer: (current: number, total: number) => ({
        margin: [36, 0, 36, 16],
        columns: [
          { width: '*', text: clean(`${organisation} — Document généré le ${frenchDate(new Date())}`), fontSize: 7.5, color: GRAY },
          { width: 'auto', text: `Page ${current}/${total}`, fontSize: 7.5, color: GRAY },
        ],
      }),
    };
  }

  async #open(definition: TDocumentDefinitions): Promise<void> {
    try {
      const { openPdf } = await import('./pdf-engine');
      openPdf(definition);
    } catch (error) {
      console.error(error);
      this.#toast.error('Le document n\'a pas pu être préparé. Réessayez.');
    }
  }

  /** Coordonnées et logo de l'organisation affichée, chargés une fois par organisation. */
  #loadOrganisation(): Promise<Organisation & { logo?: string }> {
    const key = String(this.#auth.managedTenant()?.id ?? this.#auth.user()?.tenant_id ?? '');
    if (!this.#organisation || this.#organisationFor !== key) {
      this.#organisationFor = key;
      this.#organisation = firstValueFrom(this.#api.get<Organisation | null>('organisation/tenant'))
        .catch(() => null)
        .then(async (tenant) => {
          const organisation: Organisation = tenant ?? { name: this.#auth.tenantName() || 'Mat Kolla', phone: null, email: null, address: null, logo_url: null };
          // Le logo de l'organisation d'abord ; à défaut, celui de l'application en pleine définition
          const logo = (organisation.logo_url ? await this.#image(organisation.logo_url) : undefined) ?? (await this.#image(PRINT_LOGO));
          return { ...organisation, logo };
        });
    }
    return this.#organisation;
  }

  /** Image en données intégrables au PDF ; indisponible ou illisible, le document s'en passe. */
  async #image(url: string): Promise<string | undefined> {
    try {
      const response = await fetch(new URL(url, window.location.origin).toString());
      if (!response.ok) {
        return undefined;
      }
      const blob = await response.blob();
      if (!/^image\/(png|jpe?g)$/.test(blob.type)) {
        return undefined;
      }
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch {
      return undefined;
    }
  }
}
