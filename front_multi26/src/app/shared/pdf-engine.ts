// Moteur PDF, chargé à la première impression seulement (il pèse plus d'un mégaoctet avec ses polices).
//
// pdfmake est importé ici de façon statique, et c'est ce fichier-ci qui est chargé à la demande :
// le serveur de développement écrit mal l'adresse d'une dépendance chargée à la demande quand le
// chemin du projet contient une apostrophe, ce qui est le cas sur ce poste.
import pdfMake from 'pdfmake/build/pdfmake';
import * as fonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

/** Ce que l'on utilise de pdfmake 0.2 : les polices sont passées à chaque document. */
interface PdfMake {
  createPdf(definition: TDocumentDefinitions, layouts?: unknown, fonts?: unknown, vfs?: Record<string, string>): { open(): void };
}

// Selon la version, le fichier de polices exporte la table directement ou sous pdfMake.vfs
const bundle = ((fonts as Record<string, unknown>)['default'] ?? fonts) as Record<string, unknown>;
const vfs = ((bundle['pdfMake'] as { vfs?: unknown } | undefined)?.vfs ?? bundle['vfs'] ?? bundle) as Record<string, string>;

/** Ouvre le document dans un nouvel onglet, prêt à imprimer. */
export function openPdf(definition: TDocumentDefinitions): void {
  (pdfMake as unknown as PdfMake).createPdf(definition, undefined, undefined, vfs).open();
}
