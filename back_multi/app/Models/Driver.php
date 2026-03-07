<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Driver extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'name',
        'phone',
        'contract_end',
        'status',
        'daily_rate',
    ];

    protected $casts = [
        'contract_end' => 'date',
        'daily_rate' => 'decimal:2',
    ];

    const STATUSES = [
        'ACTIVE' => 'Actif',
        'INACTIVE' => 'Inactif',
        'SUSPENDED' => 'Suspendu',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function taxiAssignments()
    {
        return $this->hasMany(TaxiAssignment::class);
    }

    public function activeAssignment()
    {
        return $this->hasOne(TaxiAssignment::class)
            ->whereNull('end_date')
            ->orWhere('end_date', '>=', now());
    }

    public function dailyPayments()
    {
        return $this->hasMany(DailyPayment::class);
    }

    public function vehicleExpenses()
    {
        return $this->hasMany(VehicleExpense::class);
    }

    public function isActive()
    {
        return $this->status === 'ACTIVE';
    }

    public function getStatusLabelAttribute()
    {
        return self::STATUSES[$this->status] ?? $this->status;
    }
}
