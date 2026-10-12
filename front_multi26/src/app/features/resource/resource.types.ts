/** Ligne renvoyée par le serveur : sa forme dépend de la ressource. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export interface Option {
  value: string | number;
  label: string;
}

export interface Column {
  label: string;
  value: (row: Row) => string | number | null | undefined;
  /** Mise en forme : montant complet, date, nombre ou pastille de statut. */
  kind?: 'money' | 'day' | 'num' | 'badge';
  /** Devise d'un montant ; GNF par défaut. */
  currency?: (row: Row) => string;
  /** Libellé et couleur d'une pastille, par valeur. */
  badges?: Record<string, { label: string; tone: string }>;
  /** Seconde ligne, plus discrète. */
  sub?: (row: Row) => string | null | undefined;
}

export interface Field {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'month' | 'select' | 'textarea';
  required?: boolean;
  options?: Option[];
  /** Options chargées d'une autre ressource. */
  optionsFrom?: { endpoint: string; query?: Record<string, string | number>; label: (item: Row) => string };
  /** Valeur de départ à la création ; « today » et « month » donnent la date et le mois du jour. */
  initial?: string | number | null;
  /** Champ absent du formulaire de modification (clé fixée à la création). */
  createOnly?: boolean;
  /** Occupe toute la largeur du formulaire. */
  full?: boolean;
  hint?: string;
}

/** Description d'une fenêtre de liste et de saisie. */
export interface ResourceConfig {
  eyebrow: string;
  title: string;
  description: string;
  /** Liste, modification et suppression : `endpoint`, `endpoint/{id}`. */
  endpoint: string;
  /** Création à une autre adresse (ex. un loyer se crée sous son bail). */
  createEndpoint?: (body: Row) => string;
  /** Suppression à une autre adresse. */
  deleteEndpoint?: (row: Row) => string;
  addLabel: string;
  /** Nom de la ligne dans les messages : « le véhicule RC200 ». */
  name: (row: Row) => string;
  columns: Column[];
  fields: Field[];
  /** Texte parcouru par la recherche. */
  searchText: (row: Row) => string;
  /** Faux pour une liste en lecture seule. */
  creatable?: boolean;
  editable?: boolean;
  deletable?: boolean;
  /** Pièce jointe d'une ligne : envoi d'un fichier, et lien vers celui déjà joint. */
  attachment?: { label: string; endpoint: (row: Row) => string; field: string; accept: string; url: (row: Row) => string | null | undefined };
  /** Corps envoyé au serveur, si les champs du formulaire ne suffisent pas. */
  toBody?: (value: Row) => Row;
  /** Reçu imprimable d'une ligne (ex. un loyer encaissé). */
  receipt?: { title: string; number: (row: Row) => string | number; date: (row: Row) => string; lines: (row: Row) => { label: string; value: string; main?: boolean }[] };
}
