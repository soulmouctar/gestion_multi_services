<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TyreContainer extends Model
{
    protected $fillable = [
        'tenant_id', 'family', 'supplier_id', 'reference', 'arrival_date',
        'purchase_price', 'currency', 'exchange_rate', 'notes',
    ];

    protected $casts = [
        'arrival_date' => 'date',
        'purchase_price' => 'float',
        'exchange_rate' => 'float',
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function expenses()
    {
        return $this->hasMany(TyreContainerExpense::class)->orderBy('expense_date')->orderBy('id');
    }

    /** Achats fournisseurs nes de ce conteneur : sa dette et ses entrees en stock. */
    public function purchases()
    {
        return $this->hasMany(SupplierPurchase::class);
    }
}
