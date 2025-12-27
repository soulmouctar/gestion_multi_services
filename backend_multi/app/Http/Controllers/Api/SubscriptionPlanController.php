<?php

namespace App\Http\Controllers\Api;

use App\Models\SubscriptionPlan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SubscriptionPlanController extends BaseController
{
    public function index()
    {
        $plans = SubscriptionPlan::paginate(15);
        return $this->sendResponse($plans, 'Subscription plans retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'duration_months' => 'required|integer|min:1',
            'price' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $plan = SubscriptionPlan::create($request->all());

        return $this->sendResponse($plan, 'Subscription plan created successfully', 201);
    }

    public function show($id)
    {
        $plan = SubscriptionPlan::with('subscriptions')->find($id);

        if (!$plan) {
            return $this->sendError('Subscription plan not found');
        }

        return $this->sendResponse($plan, 'Subscription plan retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $plan = SubscriptionPlan::find($id);

        if (!$plan) {
            return $this->sendError('Subscription plan not found');
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:100',
            'duration_months' => 'sometimes|integer|min:1',
            'price' => 'sometimes|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $plan->update($request->all());

        return $this->sendResponse($plan, 'Subscription plan updated successfully');
    }

    public function destroy($id)
    {
        $plan = SubscriptionPlan::find($id);

        if (!$plan) {
            return $this->sendError('Subscription plan not found');
        }

        $plan->delete();

        return $this->sendResponse([], 'Subscription plan deleted successfully');
    }
}
