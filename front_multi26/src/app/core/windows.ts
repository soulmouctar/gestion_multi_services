import { IconName } from '../shared/icon';

/** Famille de produits : chacune a son propre menu. */
export type FamilyKey = 'pneus' | 'cosmetique';

export interface AppWindow {
  /** Adresse de la fenêtre, sans barre initiale. */
  path: string;
  title: string;
  icon: IconName;
  /** Ce que la fenêtre permet de faire, en une phrase. */
  purpose: string;
  /** Module du serveur dont dépend la fenêtre ; sans ce module, elle n'apparaît pas. */
  module?: string;
  /** Fenêtre de liste et de saisie décrite dans features/resource/resources.ts. */
  resource?: string;
  /** Famille de produits sur laquelle la fenêtre est verrouillée. */
  family?: FamilyKey;
  adminOnly?: boolean;
  /** Réservée au super administrateur (gestion de la plateforme). */
  superAdminOnly?: boolean;
}

export interface AppModule {
  id: string;
  title: string;
  icon: IconName;
  summary: string;
  /** Étapes du parcours de gestion, dans l'ordre. */
  flow: string[];
  windows: AppWindow[];
}

/** Les quatre fenêtres d'une famille de produits : mêmes écrans, verrouillés sur la famille. */
function familyWindows(prefix: string, family: FamilyKey, label: string, productTitle: string): AppWindow[] {
  return [
    { path: `${prefix}/sales`, family, module: 'COMMERCE', title: 'Ventes', icon: 'cart', purpose: `Vendre ${label}, à un client en compte ou au comptant.` },
    { path: `${prefix}/stock`, family, module: 'COMMERCE', title: 'Stock', icon: 'box', purpose: 'Voir ce qui est entré, vendu, avarié et ce qu\'il reste.' },
    { path: `${prefix}/products`, family, module: 'COMMERCE', title: productTitle, icon: 'tag', purpose: 'Tenir le catalogue et ses prix.' },
    { path: `${prefix}/containers`, family, module: 'COMMERCE', title: 'Conteneurs', icon: 'ship', purpose: 'Recevoir les conteneurs et suivre la rentabilité de chacun.' },
  ];
}

function resource(path: string, module: string, key: string, title: string, icon: IconName, purpose: string): AppWindow {
  return { path, module, resource: key, title, icon, purpose };
}

function platform(path: string, key: string, title: string, icon: IconName, purpose: string): AppWindow {
  return { path, resource: key, title, icon, purpose, superAdminOnly: true };
}

/**
 * Cartographie de l'application : modules, parcours et fenêtres.
 * Le menu, les routes et le tableau de bord en découlent.
 */
export const MODULES: AppModule[] = [
  {
    id: 'tyres',
    title: 'Pneus',
    icon: 'tire',
    summary: 'Les pneus, dimension par dimension : du conteneur à la vente.',
    flow: ['Conteneur', 'Stock', 'Vente', 'Encaissement'],
    windows: familyWindows('tyres', 'pneus', 'des pneus', 'Dimensions'),
  },
  {
    id: 'cosmetics',
    title: 'Cosmétique',
    icon: 'drop',
    summary: 'Le cosmétique, vendu à la pièce, au demi-carton et au carton.',
    flow: ['Conteneur', 'Stock', 'Vente', 'Encaissement'],
    windows: familyWindows('cosmetics', 'cosmetique', 'du cosmétique', 'Produits'),
  },
  {
    id: 'textile',
    title: 'Textile',
    icon: 'shirt',
    summary: 'Le conteneur, son arrivage, ses ventes de balles et les comptes des clients.',
    flow: ['Conteneur envoyé', 'Livré', 'Photos', 'Ventes', 'Encaissements', 'Situation client'],
    windows: [
      { path: 'textile/containers', module: 'CONTAINER', title: 'Conteneurs', icon: 'ship', purpose: 'Enregistrer un conteneur envoyé, puis le marquer livré.' },
      { path: 'textile/arrivals', module: 'CONTAINER', title: 'Arrivages et photos', icon: 'camera', purpose: 'Joindre les photos de l\'arrivage au conteneur livré.' },
      { path: 'textile/sales', module: 'CONTAINER', title: 'Ventes', icon: 'cart', purpose: 'Vendre les balles d\'un conteneur livré.' },
      { path: 'textile/payments', module: 'CONTAINER', title: 'Encaissements', icon: 'wallet', purpose: 'Encaisser un client en devise ou en GNF, au taux du jour.' },
      { path: 'textile/payments-by-period', module: 'CONTAINER', title: 'Versements par période', icon: 'calendar', purpose: 'Consulter les versements des clients sur une période.' },
      { path: 'textile/client-statements', module: 'CONTAINER', title: 'Situation des clients', icon: 'chart', purpose: 'Connaître ce que chaque client doit, en GNF et en devise.' },
    ],
  },
  {
    id: 'commercial',
    title: 'Clients et fourniss.',
    icon: 'users',
    summary: 'Les comptes des clients des pneus et du cosmétique, et ceux des fournisseurs.',
    flow: [],
    windows: [
      { path: 'commercial/clients', module: 'CLIENTS_SUPPLIERS', title: 'Clients', icon: 'users', purpose: 'Voir la situation de chaque client et son relevé, par devise.' },
      { path: 'commercial/suppliers', module: 'CLIENTS_SUPPLIERS', title: 'Fournisseurs', icon: 'truck', purpose: 'Enregistrer les produits pris chez un fournisseur et ce qui lui est payé.' },
    ],
  },
  {
    id: 'taxi',
    title: 'Taxi',
    icon: 'car',
    summary: 'Les véhicules, leurs conducteurs et les versements journaliers.',
    flow: ['Véhicule', 'Conducteur', 'Affectation', 'Versement journalier'],
    windows: [
      resource('taxi/vehicles', 'TAXI', 'taxis', 'Véhicules', 'car', 'Tenir les véhicules et l\'échéance de leurs papiers.'),
      resource('taxi/drivers', 'TAXI', 'drivers', 'Conducteurs', 'idcard', 'Tenir les conducteurs et leur versement convenu.'),
      resource('taxi/assignments', 'TAXI', 'taxi-assignments', 'Affectations', 'link', 'Affecter un conducteur à un véhicule.'),
      resource('taxi/daily-payments', 'TAXI', 'daily-payments', 'Versements journaliers', 'wallet', 'Enregistrer ce que chaque conducteur verse chaque jour.'),
      resource('taxi/expenses', 'TAXI', 'vehicle-expenses', 'Dépenses des véhicules', 'wrench', 'Enregistrer carburant, entretien et réparations.'),
    ],
  },
  {
    id: 'rental',
    title: 'Location',
    icon: 'key',
    summary: 'Les logements à louer, les baux et les loyers encaissés.',
    flow: ['Emplacement', 'Bâtiment', 'Logement', 'Bail', 'Loyer'],
    windows: [
      resource('rental/locations', 'RENTAL', 'locations', 'Emplacements', 'pin', 'Tenir la liste des sites.'),
      resource('rental/buildings', 'RENTAL', 'buildings', 'Bâtiments', 'building', 'Tenir les bâtiments de chaque site.'),
      resource('rental/units', 'RENTAL', 'housing-units', 'Logements', 'door', 'Tenir chaque logement, son loyer et son occupation.'),
      resource('rental/floors', 'RENTAL', 'floors', 'Étages', 'layers', 'Tenir les étages des immeubles.'),
      resource('rental/unit-types', 'RENTAL', 'unit-configurations', 'Types de logement', 'sliders', 'Définir les modèles de logement.'),
      resource('rental/leases', 'RENTAL', 'leases', 'Baux', 'file', 'Enregistrer le locataire, son logement et son loyer.'),
      resource('rental/rent-payments', 'RENTAL', 'lease-payments', 'Loyers encaissés', 'receipt', 'Encaisser les loyers, mois par mois.'),
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    icon: 'coins',
    summary: 'Les encaissements, les devises, les dépenses et la banque.',
    flow: [],
    windows: [
      { path: 'finance/statistics', module: 'STATISTICS', title: 'Statistiques', icon: 'chart', purpose: 'Voir les marges, la trésorerie et l\'activité de chaque module.' },
      { path: 'finance/payments', module: 'FINANCE', title: 'Encaissements', icon: 'receipt', purpose: 'Retrouver chaque versement des clients, avec son taux et son reçu.' },
      { path: 'finance/exchange-rates', module: 'FINANCE', title: 'Taux du jour', icon: 'exchange', purpose: 'Saisir le taux du jour de chaque devise en GNF.' },
      resource('finance/expenses', 'EXPENSES', 'personal-expenses', 'Dépenses', 'coins', 'Enregistrer les dépenses courantes de l\'entreprise.'),
      resource('finance/bank-accounts', 'BANKING', 'bank-accounts', 'Comptes bancaires', 'bank', 'Tenir la liste des comptes bancaires.'),
      resource('finance/bank-transactions', 'BANKING', 'bank-transactions', 'Opérations bancaires', 'card', 'Enregistrer dépôts, retraits, chèques et virements.'),
    ],
  },
  {
    id: 'admin',
    title: 'Administration',
    icon: 'shield',
    summary: 'L\'organisation, ses utilisateurs et ses réglages.',
    flow: [],
    windows: [
      { path: 'admin/tenants', title: 'Organisations', icon: 'building', purpose: 'Gérer les entreprises clientes de la plateforme et leurs modules.', superAdminOnly: true },
      platform('admin/subscription-plans', 'subscription-plans', 'Formules d\'abonnement', 'list', 'Définir les formules proposées aux organisations.'),
      platform('admin/subscriptions', 'subscriptions', 'Abonnements', 'card', 'Suivre l\'abonnement de chaque organisation.'),
      platform('admin/roles', 'roles', 'Rôles', 'shield', 'Consulter les rôles de la plateforme.'),
      { path: 'admin/organisation', title: 'Mon organisation', icon: 'home', purpose: 'Tenir l\'identité de l\'entreprise : nom, logo, coordonnées.', adminOnly: true },
      { path: 'admin/users', title: 'Utilisateurs', icon: 'idcard', purpose: 'Gérer les comptes et leurs droits.', adminOnly: true },
      { path: 'admin/settings', title: 'Paramètres', icon: 'sliders', purpose: 'Régler la déconnexion automatique, le thème et la couleur.', adminOnly: true },
    ],
  },
];

export const ALL_WINDOWS: AppWindow[] = MODULES.flatMap((module) => module.windows);

export function findWindow(path: string): { module: AppModule; window: AppWindow } | undefined {
  for (const module of MODULES) {
    const window = module.windows.find((candidate) => candidate.path === path);
    if (window) {
      return { module, window };
    }
  }
  return undefined;
}
