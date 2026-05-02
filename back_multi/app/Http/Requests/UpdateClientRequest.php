<?php
namespace App\Http\Requests;
use Illuminate\Foundation\Http\FormRequest;

class UpdateClientRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'   => 'sometimes|string|max:150',
            'phone1' => 'sometimes|nullable|string|max:50',
            'phone2' => 'sometimes|nullable|string|max:50',
        ];
    }
}
