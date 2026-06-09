<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'name',
        'description',
        'sku',
        'product_category_id',
        'unit_id',
        'purchase_price',
        'carton_purchase_price',
        'selling_price',
        'carton_selling_price',
        'units_per_carton',
        'stock_quantity',
        'low_stock_threshold',
        'status',
        'barcode',
        'weight',
        'dimensions',
        'supplier_info',
        'notes',
        'image',
    ];

    protected $appends = ['image_url', 'unit_selling_price', 'half_carton_price', 'dozen_price'];

    public function getImageUrlAttribute(): ?string
    {
        if (!$this->image) return null;
        if (str_starts_with($this->image, 'http')) return $this->image;
        $path = ltrim($this->image, '/');
        if (!str_starts_with($path, 'uploads/')) {
            $path = 'uploads/' . $path;
        }
        return rtrim(request()->getSchemeAndHttpHost(), '/') . '/' . $path;
    }

    /** Prix de vente à l'unité : priorité au selling_price manuel, sinon carton / nb unités */
    public function getUnitSellingPriceAttribute(): ?float
    {
        if ($this->selling_price) return (float) $this->selling_price;
        if ($this->carton_selling_price && $this->units_per_carton > 0) {
            return round($this->carton_selling_price / $this->units_per_carton, 2);
        }
        return null;
    }

    /** Prix demi-carton = carton / 2 */
    public function getHalfCartonPriceAttribute(): ?float
    {
        if (!$this->carton_selling_price) return null;
        return round($this->carton_selling_price / 2, 2);
    }

    /** Prix à la douzaine = 12 × prix unitaire */
    public function getDozenPriceAttribute(): ?float
    {
        $unit = $this->unit_selling_price;
        return $unit ? round($unit * 12, 2) : null;
    }

    protected $casts = [
        'purchase_price'        => 'decimal:2',
        'carton_purchase_price' => 'decimal:2',
        'selling_price'         => 'decimal:2',
        'carton_selling_price'  => 'decimal:2',
        'units_per_carton'      => 'integer',
        'stock_quantity'        => 'integer',
        'low_stock_threshold'   => 'integer',
        'weight'                => 'decimal:2',
        'created_at'            => 'datetime',
        'updated_at'            => 'datetime',
    ];


    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function category()
    {
        return $this->belongsTo(ProductCategory::class, 'product_category_id');
    }

    public function unit()
    {
        return $this->belongsTo(Unit::class);
    }

    public function invoiceItems()
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function returns()
    {
        return $this->hasMany(ProductReturn::class);
    }
}
