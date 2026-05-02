<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Supplier extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'name',
        'email',
        'phone1',
        'phone2',
        'photo',
        'address',
        'notes',
        'currency',
    ];

    protected $appends = ['photo_url'];

    public function getPhotoUrlAttribute(): ?string
    {
        if (!$this->photo) return null;
        return Storage::disk('public')->url($this->photo);
    }

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }
}
