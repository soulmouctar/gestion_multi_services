<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TaxiAssignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'taxi_id',
        'driver_id',
        'start_date',
        'end_date',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    public function taxi()
    {
        return $this->belongsTo(Taxi::class);
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }
}
