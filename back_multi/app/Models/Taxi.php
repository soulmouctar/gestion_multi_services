<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Taxi extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'plate_number',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function assignments()
    {
        return $this->hasMany(TaxiAssignment::class);
    }
}
