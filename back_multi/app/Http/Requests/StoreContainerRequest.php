<?php
namespace App\Http\Requests;
use Illuminate\Foundation\Http\FormRequest;

class StoreContainerRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'container_number' => 'required|string|max:50',
            'capacity_min'     => 'nullable|integer|min:0',
            'capacity_max'     => 'nullable|integer|min:0',
            'interest_rate'    => 'nullable|numeric|min:0|max:100',
        ];
    }
}
