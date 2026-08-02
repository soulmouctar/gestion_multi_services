<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Invoice extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'client_id',
        'invoice_number',
        'total_amount',
        'paid_amount',
        'items_subtotal_amount',
        'previous_balance_amount',
        'status',
        'due_date',
        'notes',
        'currency',
        'exchange_rate',
        'total_amount_gnf',
    ];

    protected $casts = [
        'total_amount'     => 'decimal:2',
        'paid_amount'      => 'decimal:2',
        'items_subtotal_amount' => 'decimal:2',
        'previous_balance_amount' => 'decimal:2',
        'exchange_rate'    => 'decimal:4',
        'total_amount_gnf' => 'decimal:2',
        'due_date'         => 'date',
    ];

    protected $appends = ['remaining_balance'];

    public function getRemainingBalanceAttribute(): float
    {
        return max(0, (float) $this->total_amount - (float) $this->paid_amount);
    }

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function items()
    {
        return $this->hasMany(InvoiceItem::class)->orderBy('sort_order')->orderBy('id');
    }

    public function productReturns()
    {
        return $this->hasMany(ProductReturn::class);
    }

    public function recalculatePaidAmount(bool $syncStatus = true): void
    {
        $invoiceCurrency = strtoupper((string) ($this->currency ?? 'GNF'));

        $paid = $this->payments()
            ->where('status', 'COMPLETED')
            ->get()
            ->sum(function (Payment $payment) use ($invoiceCurrency) {
                $paymentCurrency = strtoupper((string) ($payment->currency ?? 'GNF'));
                $targetCurrency = strtoupper((string) ($payment->target_currency ?: $paymentCurrency));

                if ($targetCurrency === $invoiceCurrency && $payment->converted_amount !== null) {
                    return (float) $payment->converted_amount;
                }

                if ($invoiceCurrency === 'GNF' && $payment->amount_gnf !== null) {
                    return (float) $payment->amount_gnf;
                }

                if ($paymentCurrency === $invoiceCurrency) {
                    return (float) $payment->amount;
                }

                return 0.0;
        });

        $this->paid_amount = $paid;

        if (!$syncStatus) {
            $this->save();
            return;
        }

        if ($paid <= 0) {
            $this->status = 'IMPAYE';
        } elseif ($paid >= $this->total_amount) {
            $this->status = 'PAYE';
        } else {
            $this->status = 'PARTIEL';
        }

        $this->save();
    }
}
