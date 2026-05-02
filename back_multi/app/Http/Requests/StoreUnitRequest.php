<?php
namespace App\Http\Requests;
use Illuminate\Foundation\Http\FormRequest;

class StoreUnitRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'             => 'required|string|max:50',
            'conversion_value' => 'nullable|numeric|min:0',
        ];
    }
}
