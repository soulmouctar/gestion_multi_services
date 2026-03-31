<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClientAdvance extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'client_id',
        'amount',
        'currency',
        'payment_method',
        'payment_date',
        'reference',
        'description',
        'used_amount',
        'remaining_amount',
        'status'
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'used_amount' => 'decimal:2',
        'remaining_amount' => 'decimal:2',
        'payment_date' => 'date'
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function useAmount($amountToUse)
    {
        $this->used_amount += $amountToUse;
        $this->remaining_amount = $this->amount - $this->used_amount;
        
        if ($this->remaining_amount <= 0) {
            $this->status = 'UTILISE_TOTAL';
            $this->remaining_amount = 0;
        } else {
            $this->status = 'UTILISE_PARTIEL';
        }
        
        $this->save();
    }
}
