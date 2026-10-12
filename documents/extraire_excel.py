#!/usr/bin/env python3
"""
Lit les index des classeurs Excel et produit le fichier que charge
`php artisan excel:import` : produits, stocks, clients et soldes.

    python3 documents/extraire_excel.py

Seuls les index sont lus : le detail des feuilles (chaque vente, chaque
versement) reste dans les classeurs, les soldes sont repris comme soldes d'ouverture.
"""
import json
import re
import statistics
from pathlib import Path

import openpyxl

DOCUMENTS = Path(__file__).resolve().parent
SORTIE = DOCUMENTS.parent / 'back_multi' / 'storage' / 'app' / 'import' / 'excel.json'


def lignes(classeur, feuille=0):
    wb = openpyxl.load_workbook(DOCUMENTS / classeur, data_only=True, read_only=True)
    return [r for r in wb.worksheets[feuille].iter_rows(values_only=True) if any(c is not None for c in r)]


def nombre(valeur):
    return float(valeur) if isinstance(valeur, (int, float)) else 0.0


def propre(texte):
    return re.sub(r'\s+', ' ', str(texte).strip().strip("'")).strip()


anomalies = []


def clients(classeur, famille, exclus=()):
    """Index des clients : colonnes solde GNF (E) et solde USD (H)."""
    resultat = []
    for ligne in lignes(classeur)[2:]:
        if not ligne[1] or not isinstance(ligne[0], (int, float)):
            continue
        nom = propre(ligne[1])
        gnf, usd = round(nombre(ligne[4])), round(nombre(ligne[7]), 2)
        # Lignes vides du modele (« Client 97 ») et comptes qui ne sont pas des clients
        if re.fullmatch(r'Client \d+', nom):
            if gnf or usd:
                anomalies.append(f"{classeur} : ligne modele « {nom} » avec un solde ({gnf} GNF, {usd} USD), ignoree")
            continue
        if nom.upper() in exclus:
            anomalies.append(f"{classeur} : « {nom} » n'est pas un client (journal), ligne ignoree")
            continue
        resultat.append({'name': nom, 'type': famille, 'gnf': gnf, 'usd': usd})
    return resultat


def cosmetiques():
    """Index du stock : designation, reste en pieces, reste en cartons."""
    resultat = []
    for ligne in lignes('STOCK COSMETIQUE.xlsx')[1:]:
        if not ligne[1]:
            continue
        nom, pieces, cartons = propre(ligne[1]), round(nombre(ligne[2])), nombre(ligne[3])
        par_carton = round(pieces / cartons) if cartons > 0 and pieces > 0 else 1
        if cartons > 0 and pieces > 0 and abs(pieces / cartons - par_carton) > 0.01:
            anomalies.append(f"Cosmetique « {nom} » : {pieces} pieces pour {cartons:g} cartons ne tombe pas juste, {par_carton} pieces par carton retenu")
        resultat.append({'name': nom, 'family': 'cosmetique', 'stock': pieces, 'per_carton': par_carton})
    return resultat


def pneus():
    """Index du stock : dimension, quantite."""
    resultat = []
    for ligne in lignes('STOCK PNEU JAPONAIS .xlsx')[2:]:
        if not ligne[1]:
            continue
        brut = str(ligne[1])
        # Le classeur des pneus contient des renvois vers d'anciennes feuilles de cosmetique
        if '!' in brut or not re.search(r'\d', brut) or not re.search(r'R|/|-', brut.upper()):
            anomalies.append(f"Pneus : « {propre(brut)} » n'est pas une dimension, ligne ignoree")
            continue
        nom, stock = propre(brut), round(nombre(ligne[2]))
        if stock < 0:
            anomalies.append(f"Pneu « {nom} » : stock negatif ({stock}) dans le classeur, repris a 0")
            stock = 0
        resultat.append({'name': nom, 'family': 'pneus', 'stock': stock, 'per_carton': 1})
    return resultat


def taux_usd():
    """Taux USD releves dans les feuilles du textile : la mediane sert a valoriser les soldes en USD."""
    wb = openpyxl.load_workbook(DOCUMENTS / 'TEXTILE T.B.SALL.xlsx', data_only=True, read_only=True)
    releves = [
        ligne[3]
        for feuille in wb.worksheets[1:]
        for ligne in feuille.iter_rows(min_row=3, max_col=4, values_only=True)
        if len(ligne) > 3 and isinstance(ligne[3], (int, float)) and 5000 < ligne[3] < 20000
    ]
    return round(statistics.median(releves)) if releves else None


donnees = {
    'clients': clients('COSMETIQUE NOUVEAU.xlsx', 'COSMETIQUES') + clients('TEXTILE T.B.SALL.xlsx', 'TEXTILE', exclus=('VENTE',)),
    'products': cosmetiques() + pneus(),
    'usd_rate': taux_usd(),
    'anomalies': anomalies,
}

SORTIE.parent.mkdir(parents=True, exist_ok=True)
SORTIE.write_text(json.dumps(donnees, ensure_ascii=False, indent=1), encoding='utf-8')
print(f"{len(donnees['clients'])} clients, {len(donnees['products'])} produits, taux USD releve : {donnees['usd_rate']}")
print(f"{len(anomalies)} anomalie(s) notee(s) → {SORTIE}")
