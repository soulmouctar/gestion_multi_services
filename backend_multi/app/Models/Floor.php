<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Floor extends Model
{
    use HasFactory;

    protected $fillable = [
        'building_id',
        'floor_number',
    ];

    public function building()
    {
        return $this->belongsTo(Building::class);
    }

    public function housingUnits()
    {
        return $this->hasMany(HousingUnit::class);
    }
}
