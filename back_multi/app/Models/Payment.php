<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'client_id',
        'paid_by_client_id',
        'supplier_id',
        'invoice_id',
        'receipt_number',
        'type',
        'method',
        'amount',
        'currency',
        'exchange_rate',
        'amount_gnf',
        'proof',
        'reference',
        'description',
        'status',
        'payment_date',
    ];

    protected $casts = [
        'amount'        => 'decimal:2',
        'exchange_rate' => 'decimal:4',
        'amount_gnf'    => 'decimal:2',
        'payment_date'  => 'date',
    ];

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
