<?php
namespace App\Http\Requests;
use Illuminate\Foundation\Http\FormRequest;

class StoreProductRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'                => 'required|string|max:150',
            'description'         => 'nullable|string',
            'sku'                 => 'nullable|string|max:100',
            'product_category_id' => 'nullable|exists:product_categories,id',
            'unit_id'             => 'nullable|exists:units,id',
            'purchase_price'      => 'nullable|numeric|min:0',
            'selling_price'       => 'nullable|numeric|min:0',
            'stock_quantity'      => 'nullable|integer|min:0',
            'low_stock_threshold' => 'nullable|integer|min:0',
            'status'              => 'nullable|in:ACTIVE,INACTIVE',
        ];
    }
}
