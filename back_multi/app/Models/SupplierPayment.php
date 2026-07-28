<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SupplierPayment extends Model
{
    protected $fillable = [
        'tenant_id',
        'supplier_id',
        'amount',
        'currency',
        'target_currency',
        'exchange_rate',
        'amount_gnf',
        'converted_amount',
        'conversion_rate',
        'payment_method',
        'payment_date',
        'reference',
        'description',
        'status',
    ];

    protected $casts = [
        'payment_date'  => 'date',
        'amount'        => 'float',
        'exchange_rate' => 'float',
        'amount_gnf'    => 'float',
        'converted_amount' => 'float',
        'conversion_rate' => 'float',
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }
}
