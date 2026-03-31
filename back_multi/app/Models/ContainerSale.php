<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ContainerSale extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'container_arrival_id',
        'client_id',
        'sale_type',
        'quantity_sold',
        'sale_price',
        'currency',
        'amount_paid',
        'remaining_amount',
        'is_installment',
        'installment_count',
        'sale_date',
        'due_date',
        'notes',
        'status'
    ];

    protected $casts = [
        'sale_price' => 'decimal:2',
        'amount_paid' => 'decimal:2',
        'remaining_amount' => 'decimal:2',
        'is_installment' => 'boolean',
        'sale_date' => 'date',
        'due_date' => 'date'
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function containerArrival()
    {
        return $this->belongsTo(ContainerArrival::class);
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function payments()
    {
        return $this->hasMany(ContainerSalePayment::class);
    }

    public function updatePaymentStatus()
    {
        $totalPaid = $this->payments()->sum('amount');
        $this->amount_paid = $totalPaid;
        $this->remaining_amount = $this->sale_price - $totalPaid;
        
        if ($this->remaining_amount <= 0) {
            $this->status = 'PAYE_TOTAL';
            $this->remaining_amount = 0;
        } elseif ($totalPaid > 0) {
            $this->status = 'PAYE_PARTIEL';
        }
        
        $this->save();
    }
}
