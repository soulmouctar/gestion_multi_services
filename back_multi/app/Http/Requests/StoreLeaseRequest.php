<?php
namespace App\Http\Requests;
use Illuminate\Foundation\Http\FormRequest;

class StoreLeaseRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'housing_unit_id' => 'required|exists:housing_units,id',
            'renter_name'     => 'required|string|max:150',
            'renter_phone'    => 'nullable|string|max:50',
            'renter_email'    => 'nullable|email|max:150',
            'start_date'      => 'required|date',
            'end_date'        => 'nullable|date|after:start_date',
            'monthly_rent'    => 'required|numeric|min:0',
            'deposit_amount'  => 'nullable|numeric|min:0',
            'currency'        => 'nullable|string|max:10',
            'payment_day'     => 'nullable|integer|min:1|max:31',
            'status'          => 'nullable|in:ACTIVE,ENDED,CANCELLED',
            'notes'           => 'nullable|string',
        ];
    }
}
