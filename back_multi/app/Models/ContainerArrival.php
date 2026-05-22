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
        'exchange_rate',
        'purchase_price_gnf',
        'product_type',
        'product_category_id',
        'total_quantity',
        'bale_quantity',
        'remaining_quantity',
        'description',
        'status'
    ];

    protected $casts = [
        'purchase_price'     => 'float',
        'exchange_rate'      => 'float',
        'purchase_price_gnf' => 'float',
        'arrival_date'       => 'date',
        'bale_quantity'      => 'integer',
    ];


    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

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

    public function productCategory()
    {
        return $this->belongsTo(ProductCategory::class, 'product_category_id');
    }

    public function photos()
    {
        return $this->hasMany(ContainerPhoto::class, 'container_arrival_id');
    }
}
