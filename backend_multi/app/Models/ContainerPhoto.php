<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ContainerPhoto extends Model
{
    use HasFactory;

    protected $fillable = [
        'container_id',
        'image_path',
    ];

    public function container()
    {
        return $this->belongsTo(Container::class);
    }
}
