<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TyreContainerExpense extends Model
{
    protected $fillable = ['tyre_container_id', 'label', 'amount', 'expense_date'];

    protected $casts = [
        'amount' => 'float',
        'expense_date' => 'date',
    ];

    public function container()
    {
        return $this->belongsTo(TyreContainer::class, 'tyre_container_id');
    }
}
