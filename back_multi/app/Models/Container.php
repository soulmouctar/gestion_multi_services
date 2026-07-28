<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Container extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'container_number',
        'shipping_number',
        'bl_number',
        'capacity',
        'expected_product_category_id',
        'delivery_status',
        'entry_port',
        'entry_date',
        'expected_delivery_date',
    ];

    protected $casts = [
        'capacity' => 'integer',
        'entry_date' => 'date',
        'expected_delivery_date' => 'date',
    ];


    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function photos()
    {
        return $this->hasMany(ContainerPhoto::class);
    }

    public function expectedCategory()
    {
        return $this->belongsTo(ProductCategory::class, 'expected_product_category_id');
    }
}
