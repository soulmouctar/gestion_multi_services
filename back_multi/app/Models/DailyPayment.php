<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DailyPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'taxi_assignment_id',
        'driver_id',
        'taxi_id',
        'payment_date',
        'expected_amount',
        'paid_amount',
        'balance',
        'status',
        'notes',
    ];

    protected $casts = [
        'payment_date' => 'date',
        'expected_amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'balance' => 'decimal:2',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function taxiAssignment()
    {
        return $this->belongsTo(TaxiAssignment::class);
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function taxi()
    {
        return $this->belongsTo(Taxi::class);
    }

    public static function boot()
    {
        parent::boot();

        static::saving(function ($model) {
            $model->balance = $model->expected_amount - $model->paid_amount;
            
            if ($model->paid_amount >= $model->expected_amount) {
                $model->status = 'PAID';
            } elseif ($model->paid_amount > 0) {
                $model->status = 'PARTIAL';
            } elseif ($model->status !== 'EXCUSED') {
                $model->status = 'UNPAID';
            }
        });
    }
}
