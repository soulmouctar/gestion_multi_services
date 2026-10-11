<?php

namespace App\Support;

use App\Models\Currency;
use App\Models\ExchangeRate;

/**
 * Taux d'une devise vers le GNF (nombre de GNF pour 1 unite de la devise).
 *
 * Aucune devise etrangere utilisee ici ne vaut 1 GNF ou moins : un taux <= 1
 * signale une devise non configuree. L'accepter enregistrait 5 000 USD comme
 * 5 000 GNF et faussait tous les totaux en GNF.
 */
class GnfRate
{
    /** Taux exploitable (> 1), ou null s'il n'est ni fourni ni configure. GNF vaut toujours 1. */
    public static function resolve(?int $tenantId, ?string $currency, $provided = null): ?float
    {
        $currency = strtoupper($currency ?: 'GNF');
        if ($currency === 'GNF') {
            return 1.0;
        }
        if ($provided !== null && $provided !== '' && self::usable((float) $provided)) {
            return round((float) $provided, 4);
        }

        $row = Currency::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->where('code', $currency)
            ->first();
        if ($row && self::usable((float) $row->exchange_rate)) {
            return round((float) $row->exchange_rate, 4);
        }

        if ($row) {
            $latest = ExchangeRate::where('currency_id', $row->id)
                ->orderByDesc('rate_date')->orderByDesc('id')
                ->value('rate');
            if ($latest !== null && self::usable((float) $latest)) {
                return round((float) $latest, 4);
            }
        }

        return null;
    }

    public static function usable(float $rate): bool
    {
        return $rate > 1;
    }

    public static function missingMessage(string $currency): string
    {
        $currency = strtoupper($currency);
        return "Taux {$currency} → GNF manquant : saisissez le taux du jour ou configurez la devise dans Finance › Devises.";
    }
}
