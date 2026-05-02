<?php
namespace App\Http\Requests;
use Illuminate\Foundation\Http\FormRequest;

class StoreInvoiceRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'client_id'      => 'nullable|exists:clients,id',
            'invoice_number' => 'required|string|max:100',
            'total_amount'   => 'required|numeric|min:0',
            'status'         => 'nullable|in:PAYE,PARTIEL,IMPAYE',
            'due_date'       => 'nullable|date',
        ];
    }
}
