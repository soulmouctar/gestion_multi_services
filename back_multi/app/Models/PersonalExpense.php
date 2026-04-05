<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PersonalExpense extends Model
{
    protected $fillable = [
        'tenant_id', 'category_id', 'user_id', 'title', 'description',
        'amount', 'currency', 'expense_date', 'payment_method',
        'reference', 'status', 'is_recurring', 'recurrence_period',
    ];

    protected $casts = [
        'expense_date' => 'date',
        'amount'       => 'decimal:2',
        'is_recurring' => 'boolean',
    ];

    public function category()
    {
        return $this->belongsTo(PersonalExpenseCategory::class, 'category_id');
    }

    public function user()
    {
        return $this->belongsTo(\App\Models\User::class);
    }
}
