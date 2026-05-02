<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PersonalExpenseCategory extends Model
{
    protected $fillable = [
        'tenant_id', 'name', 'color', 'icon', 'description', 'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];


    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function expenses()
    {
        return $this->hasMany(PersonalExpense::class, 'category_id');
    }
}
