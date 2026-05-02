<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductReturn extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'product_id',
        'client_id',
        'invoice_id',
        'quantity',
        'unit_price',
        'total_amount',
        'applied_to_invoice_amount',
        'client_credit_amount',
        'return_date',
        'reintegrate_to_stock',
        'account_impact',
        'status',
        'notes',
    ];

    protected $casts = [
        'quantity'                   => 'decimal:2',
        'unit_price'                 => 'decimal:2',
        'total_amount'               => 'decimal:2',
        'applied_to_invoice_amount'  => 'decimal:2',
        'client_credit_amount'       => 'decimal:2',
        'reintegrate_to_stock'       => 'boolean',
        'return_date'                => 'date',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function invoice()
    {
        return $this->belongsTo(Invoice::class);
    }
}
