<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Mouvement de stock hors achat et vente : avarie, perte, remise en etat, inventaire. */
class StockAdjustment extends Model
{
    public const TYPES = ['AVARIE', 'PERTE', 'REMISE', 'INVENTAIRE'];

    protected $fillable = [
        'tenant_id', 'product_id', 'user_id', 'type',
        'stock_delta', 'damaged_delta', 'reason', 'adjustment_date',
    ];

    protected $casts = [
        'stock_delta' => 'integer',
        'damaged_delta' => 'integer',
        'adjustment_date' => 'date',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
