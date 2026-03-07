<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VehicleExpense extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'taxi_id',
        'driver_id',
        'expense_date',
        'expense_type',
        'amount',
        'description',
        'receipt_number',
        'notes',
    ];

    protected $casts = [
        'expense_date' => 'date',
        'amount' => 'decimal:2',
    ];

    const EXPENSE_TYPES = [
        'CARBURANT' => 'Carburant',
        'ENTRETIEN' => 'Entretien',
        'REPARATION' => 'Réparation',
        'ASSURANCE' => 'Assurance',
        'VISITE_TECHNIQUE' => 'Visite technique',
        'AMENDE' => 'Amende',
        'LAVAGE' => 'Lavage',
        'AUTRE' => 'Autre',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function taxi()
    {
        return $this->belongsTo(Taxi::class);
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function getExpenseTypeLabelAttribute()
    {
        return self::EXPENSE_TYPES[$this->expense_type] ?? $this->expense_type;
    }
}
