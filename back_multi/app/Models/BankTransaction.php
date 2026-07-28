<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class BankTransaction extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'bank_account_id', 'user_id', 'transaction_type',
        'amount', 'currency', 'exchange_rate', 'amount_gnf', 'transaction_date', 'reference', 'description',
        'proof_file', 'proof_type', 'status', 'balance_after',
    ];

    protected $casts = [
        'amount'           => 'float',
        'exchange_rate'    => 'float',
        'amount_gnf'       => 'float',
        'balance_after'    => 'float',
        'transaction_date' => 'date:Y-m-d',
    ];


    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function bankAccount()
    {
        return $this->belongsTo(BankAccount::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function isCredit(): bool
    {
        return in_array($this->transaction_type, ['DEPOT', 'REMISE_CHEQUE', 'VIREMENT_ENTRANT']);
    }
}
