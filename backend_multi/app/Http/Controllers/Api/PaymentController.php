<?php

namespace App\Http\Controllers\Api;

use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PaymentController extends BaseController
{
    public function index(Request $request)
    {
        $query = Payment::with('tenant');

        if ($request->has('tenant_id')) {
            $query->where('tenant_id', $request->tenant_id);
        }

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        $payments = $query->orderBy('payment_date', 'desc')->paginate(15);
        return $this->sendResponse($payments, 'Payments retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tenant_id' => 'required|exists:tenants,id',
            'type' => 'required|in:CLIENT,SUPPLIER,DEPOT,RETRAIT',
            'method' => 'required|in:ORANGE_MONEY,VIREMENT,CHEQUE,ESPECES',
            'amount' => 'required|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'proof' => 'nullable|string|max:255',
            'payment_date' => 'required|date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $payment = Payment::create($request->all());

        return $this->sendResponse($payment, 'Payment created successfully', 201);
    }

    public function show($id)
    {
        $payment = Payment::with('tenant')->find($id);

        if (!$payment) {
            return $this->sendError('Payment not found');
        }

        return $this->sendResponse($payment, 'Payment retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $payment = Payment::find($id);

        if (!$payment) {
            return $this->sendError('Payment not found');
        }

        $validator = Validator::make($request->all(), [
            'tenant_id' => 'sometimes|exists:tenants,id',
            'type' => 'sometimes|in:CLIENT,SUPPLIER,DEPOT,RETRAIT',
            'method' => 'sometimes|in:ORANGE_MONEY,VIREMENT,CHEQUE,ESPECES',
            'amount' => 'sometimes|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'proof' => 'nullable|string|max:255',
            'payment_date' => 'sometimes|date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $payment->update($request->all());

        return $this->sendResponse($payment, 'Payment updated successfully');
    }

    public function destroy($id)
    {
        $payment = Payment::find($id);

        if (!$payment) {
            return $this->sendError('Payment not found');
        }

        $payment->delete();

        return $this->sendResponse([], 'Payment deleted successfully');
    }
}
