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
        'capacity_min',
        'capacity_max',
        'interest_rate',
    ];

    protected $casts = [
        'interest_rate' => 'decimal:2',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function photos()
    {
        return $this->hasMany(ContainerPhoto::class);
    }
}
