<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Payment extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'client_id',
        'paid_by_client_id',
        'supplier_id',
        'invoice_id',
        'receipt_number',
        'payment_group_id',
        'type',
        'method',
        'amount',
        'currency',
        'target_currency',
        'target_account_id',
        'exchange_rate',
        'amount_gnf',
        'converted_amount',
        'conversion_rate',
        'proof',
        'reference',
        'description',
        'status',
        'payment_date',
    ];

    protected $casts = [
        'amount'           => 'decimal:2',
        'exchange_rate'    => 'decimal:4',
        'amount_gnf'       => 'decimal:2',
        'converted_amount' => 'decimal:2',
        'conversion_rate'  => 'decimal:6',
        'payment_date'     => 'date',
    ];

    public function targetAccount()
    {
        return $this->belongsTo(ClientCurrencyAccount::class, 'target_account_id');
    }

    public function getAmountGnfAttribute($value): float
    {
        if ($value !== null && $value !== '') {
            return (float) $value;
        }

        return (float) $this->amount;
    }

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function paidByClient()
    {
        return $this->belongsTo(Client::class, 'paid_by_client_id');
    }

    public function invoice()
    {
        return $this->belongsTo(Invoice::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }
}
