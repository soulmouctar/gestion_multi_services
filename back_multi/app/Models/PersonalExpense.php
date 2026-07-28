<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PersonalExpense extends Model
{
    protected $fillable = [
        'tenant_id', 'category_id', 'user_id', 'title', 'description',
        'amount', 'currency', 'exchange_rate', 'amount_gnf', 'expense_date', 'payment_method',
        'reference', 'status', 'is_recurring', 'recurrence_period',
    ];

    protected $casts = [
        'expense_date' => 'date',
        'amount'       => 'decimal:2',
        'exchange_rate'=> 'decimal:4',
        'amount_gnf'   => 'decimal:2',
        'is_recurring' => 'boolean',
    ];


    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function category()
    {
        return $this->belongsTo(PersonalExpenseCategory::class, 'category_id');
    }

    public function user()
    {
        return $this->belongsTo(\App\Models\User::class);
    }
}
