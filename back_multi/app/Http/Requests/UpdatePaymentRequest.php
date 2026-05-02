<?php
namespace App\Http\Requests;
use Illuminate\Foundation\Http\FormRequest;

class UpdatePaymentRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'type'         => 'sometimes|in:CLIENT,SUPPLIER,DEPOT,RETRAIT',
            'method'       => 'sometimes|in:ORANGE_MONEY,VIREMENT,CHEQUE,ESPECES',
            'amount'       => 'sometimes|numeric|min:0',
            'currency'     => 'nullable|string|max:10',
            'proof'        => 'nullable|string|max:255',
            'payment_date' => 'sometimes|date',
        ];
    }
}
