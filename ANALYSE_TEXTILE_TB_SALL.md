# Analyse — Système de gestion T.B.SALL (Textile / Pneus / Parfums)

> Comparaison du fichier `TEXTILE T.B.SALL.xlsx` (workflow réel du client) avec
> l'implémentation actuelle de la plateforme `gestion_multi_services`.

---

## 1. Le métier (rappel)

Grossiste-importateur basé en Guinée qui vend à des **revendeurs** (clients
réguliers, comptes-courants ouverts) :

- **Textiles** (marque Phoenix, etc.) en **balles / pièces**
- **Pneus**, **parfums**, **cosmétiques** en **carton / douzaine / unité**
- Vente principalement **à crédit** → recouvrement étalé
- **Multi-devises** (GNF + USD)
- Application d'**intérêts** sur les comptes longuement débiteurs

---

## 2. Système Excel observé

### 2.1 Structure du classeur

| Feuille | Rôle |
|---|---|
| `INDEX` | Récap consolidé : 1 ligne par client → debit / credit / solde GNF + USD + reste à payer + intérêts cumulés |
| `VENTE` | Journal global de toutes les ventes (chronologique) |
| `SALL`  | Compte **intérêts** — débit/crédit des intérêts appliqués sur dettes |
| 1 feuille par client | Grand livre individuel chronologique |

### 2.2 Colonnes par feuille client

```
DATE | DÉSIGNATION | QTÉ | TAUX | UNITAIRE GNF | DÉBIT GNF | CRÉDIT GNF | SOLDE GNF | UNITAIRE USD | DÉBIT USD | CRÉDIT USD | SOLDE USD | CUMUL GNF
```

- Solde GNF / Solde USD = **solde courant ligne par ligne**
- Cumul GNF = solde global (les soldes USD reconvertis en GNF au taux)

### 2.3 Types d'opérations identifiés

| Désignation Excel | Sens métier |
|---|---|
| `Phoenix Aïcha` | Vente du produit "Phoenix" sourcé via le fournisseur **Aïcha** |
| `Machine à coudre` | Vente d'un article hors textile |
| `Paiement` | Règlement client |
| `Paiement Koto Bory` | Règlement effectué **par un tiers** au nom de ce client |
| `Avance` | Pré-paiement → solde négatif (le client a un crédit chez nous) |
| `Retour` | Marchandise rendue → crédit |
| `RABAI` (Rabais) | Réduction commerciale |
| `Échantillon` | Article offert (gratuité) |
| `SALL` | Transfert de la dette vers le **compte intérêts** |

### 2.4 Spécificités importantes

- **Dual currency simultané** : sur une même ligne il peut y avoir un débit GNF *et* un débit USD (rare mais réel)
- **Quantités fractionnaires** : ex. 7.5 cartons (demi-carton, demi-douzaine…)
- **Soldes négatifs** : autorisés (avances client)
- **Référencement croisé** : un paiement saisi sur la feuille A peut concerner la feuille B (paiement par tiers)
- **Intérêts** : ~15% appliqués sur les soldes débiteurs anciens, suivis dans la feuille SALL

---

## 3. Implémentation actuelle — ce qui colle ✅

| Besoin métier | Statut | Détails |
|---|---|---|
| Types de clients (textile, pneus, …) | ✅ | `Client::TYPES` = `TEXTILE`, `PNEUS`, `COSMETIQUES`, `CONTAINER_PAGNE`, `GENERAL` |
| Packaging carton / douzaine / unité | ✅ | `Product` : `units_per_carton`, `carton_purchase_price`, `carton_selling_price`, `dozen_price` |
| Multi-devise (GNF/USD) | ✅ | `Invoice.currency` + `exchange_rate` + `total_amount_gnf`. Idem `Payment` |
| Type de vente par ligne | ✅ | `InvoiceItem.sale_type` (`UNIT` / `CARTON` / `DOZEN`) |
| Avance client | ✅ | `ClientAdvance` avec suivi `used_amount` / `remaining_amount` |
| Retour produit | ✅ | `ProductReturn` |
| Fournisseurs | ✅ | `Supplier` |

---

## 4. Manques identifiés ❌

### 🔴 Priorité 1 — bloquant pour le métier

#### P1.1 — Compte client (ledger générique)
Pas de page "grand livre client" générique. Il existe `containers/client-account/:id`
mais **uniquement pour le module conteneur**. Pour le module commercial (textile,
pneus…) on n'a qu'un statistique éclatée.

**Besoin** : une vue chronologique unique listant Ventes + Paiements + Retours + Avances + Rabais + Intérêts du client, avec **solde courant ligne par ligne**, exportable PDF/Excel.

#### P1.2 — Source fournisseur sur chaque ligne de vente
`InvoiceItem` ne porte pas de `supplier_id`. Dans Excel, `Phoenix Aïcha` indique
que ce lot vient du fournisseur Aïcha → calcul de marge et traçabilité des lots.

### 🟠 Priorité 2 — important

#### P2.1 — Module intérêts (compte SALL)
Pas de structure pour :
- taux d'intérêt par client (ou par dette)
- date de bascule en intérêt
- compte intérêts distinct du principal

#### P2.2 — Types d'opérations "Échantillon" et "Rabais"
Pas de marqueur `is_sample` ni de ligne dédiée "Rabais" sur `InvoiceItem`.

### 🟡 Priorité 3 — nice to have

#### P3.1 — Paiement par tiers
`Payment.client_id` est unique. Besoin d'un `paid_by_client_id` distinct du
`credited_to_client_id`.

#### P3.2 — Double devise sur une même opération
Une ligne avec à la fois débit GNF + débit USD. Rare — à confirmer avec le client.

#### P3.3 — Index consolidé (vue tableau de bord)
Tableau listant tous les clients d'un type avec leur situation globale
(debit, credit, solde GNF, solde USD, reste à payer, intérêts).

---

## 5. Plan d'implémentation

### ✅ Étape 1 — P1.1 Compte client ledger générique (DONE)
- **Backend** : `ClientController::getLedger($clientId)` fusionne Invoices + Payments + ContainerSales + ContainerPayments + Advances + Returns + InterestCharges en ordre **ASC** avec solde courant ligne par ligne.
- **Route** : `GET /api/clients/{id}/ledger?from=&to=&type=`
- **Frontend** : `views/clients/client-ledger/client-ledger.component.ts` (route `/clients/ledger/:id`).
- **UI** : KPIs (débit, crédit, solde final), filtres période + type, tableau Excel-style, export CSV, impression.
- **Accès** : bouton vert "Compte client" sur chaque carte de `/clients/list`.

### ✅ Étape 2 — P1.2 supplier_id sur InvoiceItem (DONE)
- Migration `2026_06_10_100000_add_supplier_id_to_invoice_items_table.php`.
- `InvoiceItem.fillable` + relation `supplier()`.
- `InvoiceController` : validation, persistance + relations chargées (`items.supplier`).
- Formulaire facture : nouvelle colonne "Fournisseur" entre "Produit" et "Conditionnement".
- Ledger : désignation enrichie `"Phoenix Aïcha (fact. #...)"` quand fournisseur connu.

### ✅ Étape 3 — P2.1 Module intérêts (compte SALL) (DONE)
- Migration `2026_06_11_100000_create_client_interest_charges_table.php`.
- Modèle `ClientInterestCharge` (principal_amount, interest_rate, amount, paid_amount, status, …).
- `ClientInterestController` : `indexForClient`, `store`, `update`, `destroy`.
- Routes : `GET /clients/{id}/interest-charges`, CRUD `client-interest-charges`.
- Ledger : intégration comme ligne `type=interest` (DEBIT) avec filtre dédié.
- UI : bouton rouge "Intérêt" + modal sur la page compte client (calcul auto capital × taux).

### ✅ Étape 4 — P2.2 Échantillon / Rabais (DONE)
- Migration `2026_06_11_110000_add_sample_and_discount_to_invoice_items.php` (`is_sample`, `discount_amount`).
- `InvoiceItem.fillable` + casts + `InvoiceController` : calcul du `line_total` qui force à 0 si échantillon, applique rabais sinon.
- Frontend : 2 nouvelles colonnes dans le formulaire facture (Rabais + Échantillon avec switch). Total ligne affiche un badge "Offert" si échantillon.
- Ledger : tag `[échantillon]` dans la désignation quand la facture ne contient qu'un seul article offert ; sinon mention "dont X échantillon(s)".

### ✅ Étape 5 — P3.1 Paiement par tiers (DONE — frontend & backend)
- Migration `2026_06_11_120000_add_paid_by_client_to_payments.php`.
- `Payment.fillable` + relation `paidByClient()`.
- `PaymentController` : validation `paid_by_client_id` (doit être différent du `client_id`), persistance, et chargement de la relation dans toutes les méthodes (`index`, `show`, `update`).
- Ledger : type_label devient "Paiement (tiers)" et la désignation ajoute "— par {nom}".
- **Frontend** : nouveau dropdown "Payé par (tiers)" dans le formulaire de paiement (`payments-list`), exclusion auto du client courant, message d'erreur si tiers identique au client crédité. Badge "Réglé par {nom}" affiché dans la liste des paiements.

### ✅ Étape 6 — P3.3 INDEX consolidé multi-clients (DONE)
- Enrichissement de `getFinancialOverview` : ajout des **intérêts** (charged/paid/remaining) et des **crédits de retour** au calcul de la dette nette.
- Frontend : nouvelle page `views/clients/client-index/` (route `/clients/index`).
- UI : KPIs (clients/débiteurs/avance/soldés + reste à payer + intérêts dus), filtres (recherche, type client, statut), tableau triable colonnes (nom, total facturé, total payé, avance, intérêts, dette brute, reste à payer, statut), totaux en pied de tableau, export CSV, impression.
- Accès : bouton "INDEX" dans `/clients/list`.

### ✅ Étape 7 — P3.2 Double devise (GNF + USD parallèles) (DONE)
- **Approche** : pas de "ligne mixte GNF+USD" (mauvaise idée — complexifie inutilement) ; à la place, **deux soldes courants parallèles indépendants** comme dans l'Excel. Chaque ligne contribue uniquement au solde de SA devise.
- **Backend `getLedger`** :
  - Chaque ligne carte sa `currency` propre.
  - Calcul de `balance_gnf` et `balance_usd` parallèles (l'un n'impacte pas l'autre).
  - Pour les ventes/paiements en USD : utilise le montant USD natif (`total_amount`), pas la conversion GNF.
  - Nouveau summary : `total_debit_gnf`/`total_credit_gnf`/`final_balance_gnf` + `total_debit_usd`/`total_credit_usd`/`final_balance_usd` + flag `has_usd`.
- **Frontend `client-ledger`** :
  - Affichage **conditionnel** des colonnes USD (visibles uniquement si le client a au moins une opération USD — `summary.has_usd === true`).
  - 6 colonnes au lieu de 3 quand USD actif : Débit GNF | Crédit GNF | Solde GNF | Débit USD | Crédit USD | Solde USD.
  - KPI : 2 cartes "Solde GNF" et "Solde USD" côte à côte ; remplacées par une seule carte synthèse si pas d'USD.
  - Export CSV adapté (en-têtes et colonnes selon présence USD).

---

_Document généré le 2026-06-10._
