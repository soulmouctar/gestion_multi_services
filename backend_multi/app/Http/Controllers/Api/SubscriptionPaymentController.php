<?php

namespace App\Http\Controllers\Api;

use App\Models\SubscriptionPayment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SubscriptionPaymentController extends BaseController
{
    public function index(Request $request)
    {
        $query = SubscriptionPayment::with('subscription.tenant', 'subscription.plan');

        if ($request->has('subscription_id')) {
            $query->where('subscription_id', $request->subscription_id);
        }

        $payments = $query->paginate(15);
        return $this->sendResponse($payments, 'Subscription payments retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'subscription_id' => 'required|exists:subscriptions,id',
            'amount' => 'required|numeric|min:0',
            'payment_method' => 'required|in:ORANGE_MONEY,VIREMENT,CHEQUE',
            'reference' => 'nullable|string|max:150',
            'payment_date' => 'required|date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $payment = SubscriptionPayment::create($request->all());

        return $this->sendResponse($payment->load('subscription'), 'Subscription payment created successfully', 201);
    }

    public function show($id)
    {
        $payment = SubscriptionPayment::with('subscription.tenant', 'subscription.plan')->find($id);

        if (!$payment) {
            return $this->sendError('Subscription payment not found');
        }

        return $this->sendResponse($payment, 'Subscription payment retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $payment = SubscriptionPayment::find($id);

        if (!$payment) {
            return $this->sendError('Subscription payment not found');
        }

        $validator = Validator::make($request->all(), [
            'subscription_id' => 'sometimes|exists:subscriptions,id',
            'amount' => 'sometimes|numeric|min:0',
            'payment_method' => 'sometimes|in:ORANGE_MONEY,VIREMENT,CHEQUE',
            'reference' => 'nullable|string|max:150',
            'payment_date' => 'sometimes|date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $payment->update($request->all());

        return $this->sendResponse($payment->load('subscription'), 'Subscription payment updated successfully');
    }

    public function destroy($id)
    {
        $payment = SubscriptionPayment::find($id);

        if (!$payment) {
            return $this->sendError('Subscription payment not found');
        }

        $payment->delete();

        return $this->sendResponse([], 'Subscription payment deleted successfully');
    }
}
