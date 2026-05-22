<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeasePayment extends Model
{
    protected $fillable = [
        'tenant_id', 'lease_id', 'period_month', 'amount', 'currency',
        'payment_date', 'payment_method', 'reference', 'receipt_number', 'status', 'notes',
    ];

    protected $casts = [
        'payment_date' => 'date',
        'amount'       => 'decimal:2',
    ];


    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function lease()
    {
        return $this->belongsTo(Lease::class);
    }
}
