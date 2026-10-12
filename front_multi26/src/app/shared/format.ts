import { HttpErrorResponse } from '@angular/common/http';
import { Pipe, PipeTransform } from '@angular/core';

const INTEGER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const DATE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Montant complet, jamais abrégé : 969 000 000 GNF. Le GNF n'a pas de centimes. */
export function formatMoney(value: unknown, currency = 'GNF'): string {
  const amount = Number(value) || 0;
  const code = (currency || 'GNF').toUpperCase();
  return `${(code === 'GNF' ? INTEGER : DECIMAL).format(amount)} ${code}`;
}

export function formatNumber(value: unknown): string {
  return DECIMAL.format(Number(value) || 0);
}

/** Date du jour au format attendu par les champs date et par l'API. */
export function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(value: unknown, currency = 'GNF'): string {
    return formatMoney(value, currency);
  }
}

@Pipe({ name: 'num' })
export class NumberPipe implements PipeTransform {
  transform(value: unknown): string {
    return formatNumber(value);
  }
}

@Pipe({ name: 'day' })
export class DayPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    // Les dates de l'API sont des jours : on lit la partie date sans décalage horaire
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    return DATE.format(new Date(year, month - 1, day));
  }
}

/** Message lisible tiré d'une erreur de l'API : première erreur de validation, sinon le message. */
export function apiError(error: unknown, fallback = 'L\'opération a échoué. Réessayez.'): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }
  if (error.status === 0) {
    return 'Le serveur ne répond pas. Vérifiez votre connexion.';
  }
  const body = error.error as { message?: string; errors?: Record<string, string[] | string> } | null;
  const first = body?.errors ? Object.values(body.errors)[0] : undefined;
  const detail = Array.isArray(first) ? first[0] : first;
  const message = body?.message;
  // « Validation Error » ne dit rien à l'utilisateur : on préfère le détail
  return (message && message !== 'Validation Error' ? message : detail) || detail || fallback;
}
