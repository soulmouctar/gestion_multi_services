<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
class Supplier extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'name',
        'category',
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
        if (str_starts_with($this->photo, 'http')) return $this->photo;
        $path = ltrim($this->photo, '/');
        if (!str_starts_with($path, 'uploads/')) {
            $path = 'uploads/' . $path;
        }
        return asset($path);
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

    public function supplierPayments()
    {
        return $this->hasMany(SupplierPayment::class);
    }

    public function containerArrivals()
    {
        return $this->hasMany(ContainerArrival::class);
    }
}
