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

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function productCategory()
    {
        return $this->belongsTo(ProductCategory::class, 'product_category_id');
    }

    /**
     * Porte l'achat au debit du compte-devise du fournisseur.
     *
     * Appele a la creation ; en cas de modification ou de suppression, l'appelant
     * annule d'abord l'ancien montant pour ne pas compter deux fois.
     */
    public function postToAccount(): void
    {
        SupplierCurrencyAccount::getOrCreate(
            (int) $this->supplier_id,
            (int) $this->tenant_id,
            strtoupper($this->currency ?: 'GNF')
        )->applyDebit((float) $this->total_amount);
    }

    /** Retire l'achat du compte (modification ou suppression). */
    public function unpostFromAccount(): void
    {
        SupplierCurrencyAccount::getOrCreate(
            (int) $this->supplier_id,
            (int) $this->tenant_id,
            strtoupper($this->currency ?: 'GNF')
        )->applyDebit(-(float) $this->total_amount);
    }
}
