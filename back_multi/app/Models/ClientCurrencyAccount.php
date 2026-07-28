<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClientCurrencyAccount extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'client_id',
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

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    /**
     * Recupere ou cree le compte d'un client dans une devise donnee.
     * Le compte GNF est marque comme principal a la creation.
     */
    public static function getOrCreate(int $clientId, int $tenantId, string $currency): self
    {
        $currency = strtoupper($currency);
        return self::firstOrCreate(
            ['client_id' => $clientId, 'currency' => $currency],
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
     * Applique un debit (vente, intérêt) — augmente la dette client.
     */
    public function applyDebit(float $amount): void
    {
        $this->current_balance = (float) $this->current_balance + $amount;
        $this->total_debit     = (float) $this->total_debit + $amount;
        $this->save();
    }

    /**
     * Applique un credit (paiement, avoir retour) — reduit la dette client.
     */
    public function applyCredit(float $amount): void
    {
        $this->current_balance = (float) $this->current_balance - $amount;
        $this->total_credit    = (float) $this->total_credit + $amount;
        $this->save();
    }
}
