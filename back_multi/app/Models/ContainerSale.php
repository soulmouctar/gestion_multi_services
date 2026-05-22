<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

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
        'exchange_rate',
        'sale_price_gnf',
        'amount_paid',
        'amount_paid_gnf',
        'remaining_amount',
        'remaining_amount_gnf',
        'is_installment',
        'installment_count',
        'sale_date',
        'due_date',
        'notes',
        'status'
    ];

    protected $casts = [
        'sale_price' => 'decimal:2',
        'exchange_rate' => 'decimal:4',
        'sale_price_gnf' => 'decimal:2',
        'amount_paid' => 'decimal:2',
        'amount_paid_gnf' => 'decimal:2',
        'remaining_amount' => 'decimal:2',
        'remaining_amount_gnf' => 'decimal:2',
        'is_installment' => 'boolean',
        'sale_date' => 'date',
        'due_date' => 'date'
    ];


    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

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
        $totalPaid = 0;
        $supportsGnfTracking = Schema::hasColumn($this->getTable(), 'amount_paid_gnf')
            && Schema::hasColumn($this->getTable(), 'remaining_amount_gnf')
            && Schema::hasColumn($this->getTable(), 'sale_price_gnf')
            && Schema::hasColumn('container_sale_payments', 'amount_gnf');

        if ($supportsGnfTracking) {
            $totalPaidGnf = (float) $this->payments()->sum('amount_gnf');
            $exchangeRate = (float) ($this->exchange_rate ?: 1);
            $this->amount_paid_gnf = $totalPaidGnf;
            $this->remaining_amount_gnf = max(0, (float) $this->sale_price_gnf - $totalPaidGnf);

            if (($this->currency ?? 'GNF') === 'GNF' || $exchangeRate <= 0) {
                $this->amount_paid = $totalPaidGnf;
                $this->remaining_amount = max(0, (float) $this->sale_price - $totalPaidGnf);
            } else {
                $this->amount_paid = round($totalPaidGnf / $exchangeRate, 2);
                $this->remaining_amount = round(max(0, (float) $this->remaining_amount_gnf / $exchangeRate), 2);
            }
        } else {
            $totalPaid = (float) $this->payments()->sum('amount');
            $this->amount_paid = $totalPaid;
            $this->remaining_amount = max(0, (float) $this->sale_price - $totalPaid);
        }
        
        if ($this->remaining_amount <= 0) {
            $this->status = 'PAYE_TOTAL';
            $this->remaining_amount = 0;
            if ($supportsGnfTracking) {
                $this->remaining_amount_gnf = 0;
            }
        } elseif ($totalPaid > 0) {
            $this->status = 'PAYE_PARTIEL';
        } elseif ($supportsGnfTracking && ($this->amount_paid_gnf ?? 0) > 0) {
            $this->status = 'PAYE_PARTIEL';
        }
        
        $this->save();
    }
}
