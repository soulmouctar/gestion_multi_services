<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Container extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'container_number',
        'shipping_number',
        'bl_number',
        'capacity',
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
}
