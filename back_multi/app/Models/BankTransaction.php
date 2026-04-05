<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BankTransaction extends Model
{
    protected $fillable = [
        'tenant_id', 'bank_account_id', 'user_id', 'transaction_type',
        'amount', 'currency', 'transaction_date', 'reference', 'description',
        'proof_file', 'proof_type', 'status', 'balance_after',
    ];

    protected $casts = [
        'amount'           => 'float',
        'balance_after'    => 'float',
        'transaction_date' => 'date:Y-m-d',
    ];

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
