<?php
namespace App\Http\Requests;
use Illuminate\Foundation\Http\FormRequest;

class UpdateSupplierRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'     => 'sometimes|string|max:150',
            'currency' => 'nullable|string|max:10',
        ];
    }
}
