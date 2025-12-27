<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Building extends Model
{
    use HasFactory;

    protected $fillable = [
        'location_id',
        'name',
        'type',
        'total_floors',
    ];

    public function location()
    {
        return $this->belongsTo(Location::class);
    }

    public function floors()
    {
        return $this->hasMany(Floor::class);
    }
}
