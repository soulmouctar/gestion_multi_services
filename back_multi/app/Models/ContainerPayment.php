<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ContainerPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'container_id',
        'type',
        'amount',
        'currency',
        'payment_method',
        'payment_date',
        'reference',
        'description',
        'status',
        'supplier_id',
        'client_id'
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'payment_date' => 'date'
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function container()
    {
        return $this->belongsTo(Container::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }
}
