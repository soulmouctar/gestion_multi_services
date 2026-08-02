<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Support\UploadUrl;

class Tenant extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'email',
        'phone',
        'address',
        'logo',
        'subscription_status',
    ];

    protected $appends = ['logo_url'];

    /**
     * URL absolue du logo du tenant (utilise pour les PDFs et l'UI).
     */
    public function getLogoUrlAttribute(): ?string
    {
        if (!$this->logo) return null;
        if (str_starts_with($this->logo, 'http')) return $this->logo;
        return UploadUrl::make($this->logo);
    }

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function modules()
    {
        return $this->belongsToMany(Module::class, 'tenant_modules')
            ->withPivot('is_active')
            ->withTimestamps();
    }

    public function subscriptions()
    {
        return $this->hasMany(Subscription::class);
    }

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function containers()
    {
        return $this->hasMany(Container::class);
    }

    public function clients()
    {
        return $this->hasMany(Client::class);
    }

    public function suppliers()
    {
        return $this->hasMany(Supplier::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function invoices()
    {
        return $this->hasMany(Invoice::class);
    }

    public function locations()
    {
        return $this->hasMany(Location::class);
    }

    public function drivers()
    {
        return $this->hasMany(Driver::class);
    }

    public function taxis()
    {
        return $this->hasMany(Taxi::class);
    }

    public function organisationSetting()
    {
        return $this->hasOne(OrganisationSetting::class);
    }
}
