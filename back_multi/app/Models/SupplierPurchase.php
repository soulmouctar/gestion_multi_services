<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Achat direct aupres d'un fournisseur (hors arrivage de conteneur).
 *
 * Un achat est un debit : il augmente ce que nous devons au fournisseur, dans
 * la devise de la transaction.
 */
class SupplierPurchase extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'supplier_id',
        'purchase_number',
        'category',
        'product_category_id',
        'product_id',
        'tyre_container_id',
        'designation',
        'quantity',
        'unit_price',
        'total_amount',
        'currency',
        'exchange_rate',
        'total_amount_gnf',
        'purchase_date',
        'reference',
        'notes',
    ];

    protected $casts = [
        'quantity'         => 'decimal:2',
        'unit_price'       => 'decimal:2',
        'total_amount'     => 'decimal:2',
        'exchange_rate'    => 'decimal:4',
        'total_amount_gnf' => 'decimal:2',
        'purchase_date'    => 'date',
    ];

    public const CATEGORIES = ['TEXTILE', 'COSMETIQUES', 'PNEUS', 'MACHINE_A_COUDRE', 'AUTRE'];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Fait entrer (ou ressortir, si negatif) des unites dans le stock du produit achete.
     * Sans produit designe, l'achat ne touche pas au stock.
     */
    public function moveStock(float $units): void
    {
        if (!$this->product_id || !$units) {
            return;
        }
        $product = Product::where('tenant_id', $this->tenant_id)->lockForUpdate()->find($this->product_id);
        if ($product) {
            $product->stock_quantity = (int) $product->stock_quantity + (int) round($units);
            $product->save();
        }
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function productCategory()
    {
        return $this->belongsTo(ProductCategory::class, 'product_category_id');
    }

    /**
     * Realigne le compte-devise du fournisseur sur ses ecritures.
     *
     * Le compte n'est plus tenu par increments : il est recalcule depuis les
     * achats, arrivages et versements (AccountBalanceService), automatiquement
     * a chaque enregistrement ou suppression. Ces deux methodes restent pour
     * les appelants existants et font simplement ce recalcul.
     */
    public function postToAccount(): void
    {
        \App\Services\AccountBalanceService::syncSupplier((int) $this->supplier_id, (int) $this->tenant_id);
    }

    public function unpostFromAccount(): void
    {
        \App\Services\AccountBalanceService::syncSupplier((int) $this->supplier_id, (int) $this->tenant_id);
    }

}
