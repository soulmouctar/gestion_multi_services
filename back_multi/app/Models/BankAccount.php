<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BankAccount extends Model
{
    protected $fillable = [
        'tenant_id', 'bank_name', 'account_number', 'account_name',
        'account_type', 'currency', 'opening_balance', 'current_balance',
        'is_active', 'description',
    ];

    protected $casts = [
        'opening_balance' => 'float',
        'current_balance' => 'float',
        'is_active'       => 'boolean',
    ];

    public function transactions()
    {
        return $this->hasMany(BankTransaction::class);
    }

    /**
     * Recalculate current_balance from all COMPLETED transactions.
     */
    public function recalculateBalance(): float
    {
        $credits = $this->transactions()
            ->whereIn('transaction_type', ['DEPOT', 'REMISE_CHEQUE', 'VIREMENT_ENTRANT'])
            ->where('status', 'COMPLETED')
            ->sum('amount');

        $debits = $this->transactions()
            ->whereIn('transaction_type', ['RETRAIT', 'VIREMENT_SORTANT'])
            ->where('status', 'COMPLETED')
            ->sum('amount');

        $this->current_balance = $this->opening_balance + $credits - $debits;
        $this->save();

        return (float) $this->current_balance;
    }
}
