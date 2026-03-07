<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Contact extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'type',
        'name',
        'value',
        'description',
        'is_default',
        'is_active'
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime'
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    // Scope pour obtenir le contact par défaut d'un type donné
    public function scopeDefault($query, $type = null)
    {
        $query = $query->where('is_default', true);
        
        if ($type) {
            $query->where('type', $type);
        }
        
        return $query;
    }

    // Scope pour filtrer par type
    public function scopeOfType($query, $type)
    {
        return $query->where('type', $type);
    }

    // Scope pour les contacts actifs
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    // Scope pour filtrer par tenant
    public function scopeForTenant($query, $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    // Méthode statique pour obtenir les types de contact disponibles
    public static function getContactTypes()
    {
        return [
            'phone' => 'Téléphone',
            'email' => 'Email',
            'address' => 'Adresse',
            'website' => 'Site Web',
            'fax' => 'Fax',
            'whatsapp' => 'WhatsApp',
            'telegram' => 'Telegram'
        ];
    }
}
