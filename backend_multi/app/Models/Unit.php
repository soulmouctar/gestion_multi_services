<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Unit extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'conversion_value',
    ];

    protected $casts = [
        'conversion_value' => 'decimal:2',
    ];

    public function products()
    {
        return $this->hasMany(Product::class);
    }
}
