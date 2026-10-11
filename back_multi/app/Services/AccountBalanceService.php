<?php

namespace App\Services;

use App\Models\ClientAdvance;
use App\Models\ClientCurrencyAccount;
use App\Models\ClientInterestCharge;
use App\Models\ContainerArrival;
use App\Models\ContainerSale;
use App\Models\ContainerSalePayment;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\ProductReturn;
use App\Models\SupplierCurrencyAccount;
use App\Models\SupplierPayment;
use App\Models\SupplierPurchase;

/**
 * Situation d'un client ou d'un fournisseur, par devise, recalculee a partir
 * des ecritures (factures, ventes conteneurs, versements, avances, retours…).
 *
 * C'est la source unique des soldes : les comptes-devises ne sont plus tenus
 * par increments (+/- a chaque operation), ce qui les laissait faux des qu'un
 * chemin oubliait de les mettre a jour (suppression groupee, corbeille,
 * facture, annulation…). Ils sont resynchronises ici apres chaque ecriture.
 *
 * Chaque devise est un compte independant : un montant USD n'est jamais
 * additionne a un montant GNF.
 */
class AccountBalanceService
{
    /** Statuts de frais d'interets qui pesent sur le compte. */
    private const ACTIVE_INTEREST = ['PENDING', 'PARTIAL', 'PAID'];

    private static function cur(?string $currency): string
    {
        return strtoupper($currency ?: 'GNF');
    }

    private static function add(array &$totals, ?string $currency, float $debit, float $credit): void
    {
        $currency = self::cur($currency);
        $totals[$currency] ??= ['debit' => 0.0, 'credit' => 0.0];
        $totals[$currency]['debit']  += $debit;
        $totals[$currency]['credit'] += $credit;
    }

    private static function finalize(array $totals): array
    {
        ksort($totals);
        foreach ($totals as $currency => $row) {
            $totals[$currency] = [
                'debit'   => round($row['debit'], 2),
                'credit'  => round($row['credit'], 2),
                'balance' => round($row['debit'] - $row['credit'], 2),
            ];
        }
        return $totals;
    }

    /**
     * Montant propre d'une facture : ses lignes, sans le solde anterieur
     * reporte. Ce report rappelle une dette deja portee par les factures
     * precedentes ; le recompter doublerait la dette du client.
     */
    public static function invoiceOwnAmount(Invoice $invoice): float
    {
        return max(0, round((float) $invoice->total_amount - (float) ($invoice->previous_balance_amount ?? 0), 2));
    }

    /**
     * Versement conteneur exprime dans la devise de la vente qu'il regle.
     * Un versement en GNF sur une vente en USD credite donc le compte USD,
     * au taux de la vente (meme regle que ContainerSale::updatePaymentStatus).
     */
    public static function containerPaymentCredit(ContainerSalePayment $payment, ?ContainerSale $sale): array
    {
        $paymentCurrency = self::cur($payment->currency);
        $saleCurrency = $sale ? self::cur($sale->currency) : $paymentCurrency;
        $amount = (float) $payment->amount;

        if ($paymentCurrency === $saleCurrency) {
            return [$saleCurrency, $amount];
        }

        $amountGnf = $payment->amount_gnf !== null
            ? (float) $payment->amount_gnf
            : $amount * (float) ($payment->exchange_rate ?: 1);
        if ($saleCurrency === 'GNF') {
            return ['GNF', round($amountGnf, 2)];
        }

        $saleRate = (float) ($sale->exchange_rate ?: 0);
        return $saleRate > 0
            ? [$saleCurrency, round($amountGnf / $saleRate, 2)]
            : [$paymentCurrency, $amount];
    }

    /**
     * Debits, credits et solde d'un client par devise.
     * Solde positif : le client nous doit. Solde negatif : il est en avance.
     *
     * @return array<string, array{debit: float, credit: float, balance: float}>
     */
    public static function clientTotals(int $clientId, int $tenantId, ?int $excludeInvoiceId = null, ?string $before = null): array
    {
        $totals = [];
        // $before : ne retenir que les ecritures strictement anterieures a cette
        // date, pour obtenir le solde d'ouverture d'un releve sur une periode.
        $until = fn (string $column) => fn ($q) => $before ? $q->whereDate($column, '<', $before) : $q;

        Invoice::where('tenant_id', $tenantId)->where('client_id', $clientId)
            ->when($excludeInvoiceId, fn ($q) => $q->where('id', '!=', $excludeInvoiceId))
            ->tap($until('created_at'))
            ->get(['id', 'currency', 'total_amount', 'previous_balance_amount'])
            ->each(function ($invoice) use (&$totals) {
                self::add($totals, $invoice->currency, self::invoiceOwnAmount($invoice), 0.0);
            });

        Payment::where('tenant_id', $tenantId)->where('client_id', $clientId)
            ->where('type', 'CLIENT')->where('status', 'COMPLETED')
            ->tap($until('payment_date'))
            ->get(['id', 'amount', 'currency', 'target_currency', 'converted_amount'])
            ->each(function (Payment $payment) use (&$totals) {
                $credit = $payment->converted_amount !== null ? (float) $payment->converted_amount : (float) $payment->amount;
                self::add($totals, $payment->target_currency ?: $payment->currency, 0.0, $credit);
            });

        // Toutes les ventes actives servent a convertir les versements ; seules
        // celles de la periode sont portees au debit.
        $sales = ContainerSale::where('tenant_id', $tenantId)->where('client_id', $clientId)
            ->where('status', '!=', 'ANNULE')
            ->get(['id', 'currency', 'sale_price', 'exchange_rate', 'sale_date'])
            ->keyBy('id');
        foreach ($sales as $sale) {
            if ($before && $sale->sale_date && $sale->sale_date->format('Y-m-d') >= $before) {
                continue;
            }
            self::add($totals, $sale->currency, (float) $sale->sale_price, 0.0);
        }

        ContainerSalePayment::where('tenant_id', $tenantId)->where('client_id', $clientId)
            ->whereIn('container_sale_id', $sales->keys())
            ->where(fn ($q) => $q->whereNull('payment_type')->orWhere('payment_type', '!=', 'AVANCE'))
            ->tap($until('payment_date'))
            ->get()
            ->each(function (ContainerSalePayment $payment) use (&$totals, $sales) {
                [$currency, $credit] = self::containerPaymentCredit($payment, $sales->get($payment->container_sale_id));
                self::add($totals, $currency, 0.0, $credit);
            });

        ClientAdvance::where('tenant_id', $tenantId)->where('client_id', $clientId)
            ->tap($until('payment_date'))
            ->get(['id', 'amount', 'currency'])
            ->each(function ($advance) use (&$totals) {
                self::add($totals, $advance->currency, 0.0, (float) $advance->amount);
            });

        ClientInterestCharge::where('tenant_id', $tenantId)->where('client_id', $clientId)
            ->whereIn('status', self::ACTIVE_INTEREST)
            ->tap($until('charge_date'))
            ->get(['id', 'amount', 'paid_amount', 'currency'])
            ->each(function ($charge) use (&$totals) {
                self::add($totals, $charge->currency, (float) $charge->amount, (float) ($charge->paid_amount ?? 0));
            });

        ProductReturn::where('tenant_id', $tenantId)->where('client_id', $clientId)
            ->where('status', 'APPROVED')->whereNull('client_advance_id')
            ->tap($until('return_date'))
            ->get(['id', 'client_credit_amount', 'currency'])
            ->each(function ($return) use (&$totals) {
                self::add($totals, $return->currency, 0.0, (float) $return->client_credit_amount);
            });

        return self::finalize($totals);
    }

    /** Ce que le client doit encore dans une devise (0 s'il est a jour ou en avance). */
    public static function clientDebt(int $clientId, int $tenantId, string $currency, ?int $excludeInvoiceId = null): float
    {
        $totals = self::clientTotals($clientId, $tenantId, $excludeInvoiceId);
        return max(0, (float) ($totals[self::cur($currency)]['balance'] ?? 0));
    }

    /**
     * Debits, credits et solde d'un fournisseur par devise.
     * Solde positif : nous lui devons. Solde negatif : avance versee.
     *
     * @return array<string, array{debit: float, credit: float, balance: float}>
     */
    public static function supplierTotals(int $supplierId, int $tenantId): array
    {
        $totals = [];

        ContainerArrival::where('tenant_id', $tenantId)->where('supplier_id', $supplierId)
            ->get(['id', 'currency', 'purchase_price'])
            ->each(function ($arrival) use (&$totals) {
                self::add($totals, $arrival->currency, (float) $arrival->purchase_price, 0.0);
            });

        SupplierPurchase::where('tenant_id', $tenantId)->where('supplier_id', $supplierId)
            ->get(['id', 'currency', 'total_amount'])
            ->each(function ($purchase) use (&$totals) {
                self::add($totals, $purchase->currency, (float) $purchase->total_amount, 0.0);
            });

        SupplierPayment::where('tenant_id', $tenantId)->where('supplier_id', $supplierId)
            ->where(fn ($q) => $q->whereNull('status')->orWhere('status', 'COMPLETED'))
            ->get(['id', 'amount', 'currency', 'target_currency', 'converted_amount'])
            ->each(function ($payment) use (&$totals) {
                $credit = $payment->converted_amount !== null ? (float) $payment->converted_amount : (float) $payment->amount;
                self::add($totals, $payment->target_currency ?: $payment->currency, 0.0, $credit);
            });

        return self::finalize($totals);
    }

    /** Realigne les comptes-devises d'un client sur ses ecritures. */
    public static function syncClient(?int $clientId, ?int $tenantId): void
    {
        if (!$clientId || !$tenantId) {
            return;
        }
        $totals = self::clientTotals($clientId, $tenantId);
        $accounts = ClientCurrencyAccount::where('client_id', $clientId)->get()->keyBy(fn ($a) => self::cur($a->currency));

        foreach ($totals as $currency => $row) {
            if (!$accounts->has($currency)) {
                $accounts->put($currency, ClientCurrencyAccount::getOrCreate($clientId, $tenantId, $currency));
            }
        }
        foreach ($accounts as $currency => $account) {
            $row = $totals[$currency] ?? ['debit' => 0.0, 'credit' => 0.0, 'balance' => 0.0];
            $account->forceFill([
                'total_debit'     => $row['debit'],
                'total_credit'    => $row['credit'],
                'current_balance' => $row['balance'],
            ]);
            if ($account->isDirty()) {
                $account->save();
            }
        }
    }

    /** Realigne les comptes-devises d'un fournisseur sur ses ecritures. */
    public static function syncSupplier(?int $supplierId, ?int $tenantId): void
    {
        if (!$supplierId || !$tenantId) {
            return;
        }
        $totals = self::supplierTotals($supplierId, $tenantId);
        $accounts = SupplierCurrencyAccount::where('supplier_id', $supplierId)->get()->keyBy(fn ($a) => self::cur($a->currency));

        foreach ($totals as $currency => $row) {
            if (!$accounts->has($currency)) {
                $accounts->put($currency, SupplierCurrencyAccount::getOrCreate($supplierId, $tenantId, $currency));
            }
        }
        foreach ($accounts as $currency => $account) {
            $row = $totals[$currency] ?? ['debit' => 0.0, 'credit' => 0.0, 'balance' => 0.0];
            $account->forceFill([
                'total_debit'     => $row['debit'],
                'total_credit'    => $row['credit'],
                'current_balance' => $row['balance'],
            ]);
            if ($account->isDirty()) {
                $account->save();
            }
        }
    }
}
