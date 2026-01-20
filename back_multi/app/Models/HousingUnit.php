<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HousingUnit extends Model
{
    use HasFactory;

    protected $fillable = [
        'floor_id',
        'unit_configuration_id',
        'rent_amount',
        'status',
    ];

    protected $casts = [
        'rent_amount' => 'decimal:2',
    ];

    public function floor()
    {
        return $this->belongsTo(Floor::class);
    }

    public function configuration()
    {
        return $this->belongsTo(UnitConfiguration::class, 'unit_configuration_id');
    }
}
