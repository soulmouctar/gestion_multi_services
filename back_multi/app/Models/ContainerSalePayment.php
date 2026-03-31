<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ContainerSalePayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'container_sale_id',
        'client_id',
        'amount',
        'currency',
        'payment_method',
        'payment_date',
        'reference',
        'notes',
        'payment_type'
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'payment_date' => 'date'
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function containerSale()
    {
        return $this->belongsTo(ContainerSale::class);
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    protected static function booted()
    {
        static::created(function ($payment) {
            $payment->containerSale->updatePaymentStatus();
        });

        static::deleted(function ($payment) {
            $payment->containerSale->updatePaymentStatus();
        });
    }
}
