<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Unit extends Model
{
    use HasFactory, SoftDeletes;

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
