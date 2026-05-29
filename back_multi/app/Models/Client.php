<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
class Client extends Model
{
    use HasFactory;

    public const TYPE_GENERAL = 'GENERAL';
    public const TYPE_PNEUS = 'PNEUS';
    public const TYPE_TEXTILE = 'TEXTILE';
    public const TYPE_COSMETIQUES = 'COSMETIQUES';
    public const TYPE_CONTAINER_PAGNE = 'CONTAINER_PAGNE';

    public const TYPES = [
        self::TYPE_GENERAL,
        self::TYPE_PNEUS,
        self::TYPE_TEXTILE,
        self::TYPE_COSMETIQUES,
        self::TYPE_CONTAINER_PAGNE,
    ];

    protected $fillable = [
        'tenant_id',
        'client_type',
        'name',
        'phone1',
        'phone2',
        'email',
        'photo',
        'address',
        'notes',
    ];

    protected $appends = ['photo_url'];

    protected $attributes = [
        'client_type' => self::TYPE_GENERAL,
    ];

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

    public function invoices()
    {
        return $this->hasMany(Invoice::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function productReturns()
    {
        return $this->hasMany(ProductReturn::class);
    }

    public function getTotalDebtAttribute(): float
    {
        $invoiceDebt = (float) $this->invoices()
            ->whereIn('status', ['IMPAYE', 'PARTIEL'])
            ->sum(\DB::raw('total_amount - paid_amount'));

        $returnCredits = (float) $this->productReturns()
            ->whereNull('invoice_id')
            ->where('status', 'APPROVED')
            ->sum('client_credit_amount');

        return max(0, $invoiceDebt - $returnCredits);
    }
}
