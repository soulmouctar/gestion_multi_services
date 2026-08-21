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
        'currency',
        'exchange_rate',
        'total_amount_gnf',
        'applied_to_invoice_amount',
        'client_credit_amount',
        'refund_amount',
        'client_advance_id',
        'refund_payment_id',
        'return_date',
        'product_received',
        'reintegrate_to_stock',
        'account_impact',
        'status',
        'notes',
    ];

    protected $casts = [
        'quantity'                   => 'decimal:2',
        'unit_price'                 => 'decimal:2',
        'total_amount'               => 'decimal:2',
        'exchange_rate'              => 'decimal:4',
        'total_amount_gnf'           => 'decimal:2',
        'applied_to_invoice_amount'  => 'decimal:2',
        'client_credit_amount'       => 'decimal:2',
        'refund_amount'              => 'decimal:2',
        'product_received'           => 'boolean',
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

    public function clientAdvance()
    {
        return $this->belongsTo(ClientAdvance::class);
    }

    public function refundPayment()
    {
        return $this->belongsTo(Payment::class, 'refund_payment_id');
    }
}
