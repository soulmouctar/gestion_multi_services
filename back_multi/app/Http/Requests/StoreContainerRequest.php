<?php
namespace App\Http\Requests;
use Illuminate\Foundation\Http\FormRequest;

class StoreContainerRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'shipping_number' => 'required|string|max:100',
            'bl_number' => 'nullable|string|max:100',
            'capacity' => 'nullable|integer|min:0',
            'delivery_status' => 'nullable|in:LIVRE,NON_LIVRE',
            'entry_port' => 'nullable|string|max:100',
            'entry_date' => 'nullable|date',
            'expected_delivery_date' => 'nullable|date',
        ];
    }
}
