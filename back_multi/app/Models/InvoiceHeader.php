<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InvoiceHeader extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'name',
        'logo_url',
        'company_name',
        'address',
        'city',
        'postal_code',
        'country',
        'phone',
        'email',
        'website',
        'tax_number',
        'registration_number',
        'bank_details',
        'footer_text',
        'is_default',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime'
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    // Scope pour obtenir l'en-tête par défaut
    public function scopeDefault($query)
    {
        return $query->where('is_default', true);
    }

    // Scope pour filtrer par tenant
    public function scopeForTenant($query, $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    // Accessors
    public function getFullAddressAttribute()
    {
        return trim($this->address . "\n" . $this->city . ' ' . $this->postal_code . "\n" . $this->country);
    }

    public function getFormattedBankDetailsAttribute()
    {
        if (!$this->bank_details) {
            return null;
        }
        
        return nl2br(e($this->bank_details));
    }

    // Helper methods
    public function duplicate($newName = null)
    {
        $duplicate = $this->replicate();
        $duplicate->name = $newName ?: $this->name . ' (Copie)';
        $duplicate->is_default = false;
        $duplicate->save();
        
        return $duplicate;
    }

    public function setAsDefault()
    {
        // Désactiver tous les autres en-têtes par défaut pour ce tenant
        static::forTenant($this->tenant_id)
            ->where('id', '!=', $this->id)
            ->update(['is_default' => false]);
        
        // Activer celui-ci comme par défaut
        $this->update(['is_default' => true]);
        
        return $this;
    }
}
