<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ContainerPhoto extends Model
{
    use HasFactory;

    protected $fillable = [
        'container_id',
        'product_id',
        'image_path',
        'description',
    ];

    public function container()
    {
        return $this->belongsTo(Container::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
