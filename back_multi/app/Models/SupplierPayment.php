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
        'exchange_rate',
        'amount_gnf',
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
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }
}
