<?php
namespace App\Http\Requests;
use Illuminate\Foundation\Http\FormRequest;

class StoreDriverRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'         => 'required|string|max:150',
            'phone'        => 'nullable|string|max:50',
            'contract_end' => 'nullable|date',
        ];
    }
}
