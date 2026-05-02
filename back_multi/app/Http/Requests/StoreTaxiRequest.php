<?php
namespace App\Http\Requests;
use Illuminate\Foundation\Http\FormRequest;

class StoreTaxiRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'plate_number'                => 'required|string|max:50',
            'brand'                       => 'nullable|string|max:50',
            'vehicle_model'               => 'nullable|string|max:50',
            'year'                        => 'nullable|integer|min:1990|max:2100',
            'color'                       => 'nullable|string|max:30',
            'mileage'                     => 'nullable|integer|min:0',
            'status'                      => 'nullable|in:ACTIVE,MAINTENANCE,INACTIVE',
            'insurance_expiry'            => 'nullable|date',
            'technical_inspection_expiry' => 'nullable|date',
            'circulation_permit_expiry'   => 'nullable|date',
            'notes'                       => 'nullable|string',
        ];
    }
}
