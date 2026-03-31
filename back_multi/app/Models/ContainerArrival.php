<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ContainerArrival extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'container_id',
        'supplier_id',
        'arrival_date',
        'purchase_price',
        'currency',
        'product_type',
        'total_quantity',
        'remaining_quantity',
        'description',
        'status'
    ];

    protected $casts = [
        'purchase_price' => 'decimal:2',
        'arrival_date' => 'date'
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

    public function sales()
    {
        return $this->hasMany(ContainerSale::class);
    }
}
