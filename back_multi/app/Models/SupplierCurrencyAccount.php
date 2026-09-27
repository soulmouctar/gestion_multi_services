<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Compte-devise d'un fournisseur.
 *
 * Sens inverse du compte client : un solde positif signifie que NOUS devons
 * cette somme au fournisseur. Un solde negatif est une avance que nous lui
 * avons versee et qui reste a consommer.
 */
class SupplierCurrencyAccount extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'supplier_id',
        'currency',
        'is_primary',
        'current_balance',
        'total_debit',
        'total_credit',
        'label',
    ];

    protected $casts = [
        'is_primary'      => 'boolean',
        'current_balance' => 'decimal:2',
        'total_debit'     => 'decimal:2',
        'total_credit'    => 'decimal:2',
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    /** Recupere ou cree le compte d'un fournisseur dans une devise. */
    public static function getOrCreate(int $supplierId, int $tenantId, string $currency): self
    {
        $currency = strtoupper($currency);

        return self::firstOrCreate(
            ['supplier_id' => $supplierId, 'currency' => $currency],
            [
                'tenant_id'       => $tenantId,
                'is_primary'      => $currency === 'GNF',
                'current_balance' => 0,
                'total_debit'     => 0,
                'total_credit'    => 0,
            ]
        );
    }

    /**
     * Cree d'office les comptes GNF et USD d'un fournisseur.
     *
     * Les deux devises sont celles utilisees par l'activite ; les avoir des la
     * creation evite d'avoir a les ouvrir manuellement au premier versement.
     */
    public static function provisionDefaults(int $supplierId, int $tenantId): void
    {
        foreach (['GNF', 'USD'] as $currency) {
            self::getOrCreate($supplierId, $tenantId, $currency);
        }
    }

    /** Achat porte au compte : augmente ce que nous devons. */
    public function applyDebit(float $amount): void
    {
        $this->current_balance = (float) $this->current_balance + $amount;
        $this->total_debit     = (float) $this->total_debit + $amount;
        $this->save();
    }

    /** Versement au fournisseur : reduit ce que nous devons. */
    public function applyCredit(float $amount): void
    {
        $this->current_balance = (float) $this->current_balance - $amount;
        $this->total_credit    = (float) $this->total_credit + $amount;
        $this->save();
    }
}
