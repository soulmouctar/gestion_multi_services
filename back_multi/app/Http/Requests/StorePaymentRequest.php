<?php
namespace App\Http\Requests;
use Illuminate\Foundation\Http\FormRequest;

class StorePaymentRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'type'         => 'required|in:CLIENT,SUPPLIER,DEPOT,RETRAIT',
            'method'       => 'required|in:ORANGE_MONEY,VIREMENT,CHEQUE,ESPECES',
            'amount'       => 'required|numeric|min:0',
            'currency'     => 'nullable|string|max:10',
            'proof'        => 'nullable|string|max:255',
            'payment_date' => 'required|date',
        ];
    }
}
