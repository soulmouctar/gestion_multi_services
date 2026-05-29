<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ContainerPhoto extends Model
{
    use HasFactory;

    protected $fillable = [
        'container_id',
        'container_arrival_id',
        'product_id',
        'image_path',
        'description',
    ];

    protected $appends = ['image_url'];

    public function getImageUrlAttribute(): ?string
    {
        if (!$this->image_path) return null;
        if (str_starts_with($this->image_path, 'http')) return $this->image_path;
        return asset($this->image_path);
    }

    public function container()
    {
        return $this->belongsTo(Container::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function arrival()
    {
        return $this->belongsTo(ContainerArrival::class, 'container_arrival_id');
    }
}
