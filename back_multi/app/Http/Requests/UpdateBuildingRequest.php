<?php
namespace App\Http\Requests;
use Illuminate\Foundation\Http\FormRequest;

class UpdateBuildingRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'location_id'  => 'sometimes|exists:locations,id',
            'name'         => 'sometimes|string|max:150',
            'type'         => 'nullable|string|max:50',
            'total_floors' => 'nullable|integer|min:1',
        ];
    }
}
