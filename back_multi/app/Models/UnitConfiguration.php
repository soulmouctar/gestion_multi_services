<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UnitConfiguration extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'bedrooms',
        'living_rooms',
        'bathrooms',
        'has_terrace',
    ];

    protected $casts = [
        'has_terrace' => 'boolean',
    ];

    public function housingUnits()
    {
        return $this->hasMany(HousingUnit::class);
    }
}
