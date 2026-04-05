<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Lease extends Model
{
    protected $fillable = [
        'tenant_id', 'housing_unit_id', 'renter_name', 'renter_phone',
        'renter_email', 'start_date', 'end_date', 'monthly_rent',
        'deposit_amount', 'currency', 'payment_day', 'status', 'notes',
    ];

    protected $casts = [
        'start_date'     => 'date',
        'end_date'       => 'date',
        'monthly_rent'   => 'decimal:2',
        'deposit_amount' => 'decimal:2',
        'payment_day'    => 'integer',
    ];

    public function housingUnit()
    {
        return $this->belongsTo(HousingUnit::class);
    }

    public function payments()
    {
        return $this->hasMany(LeasePayment::class);
    }
}
