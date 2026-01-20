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
            'duration_months' => 'required|integer|min:1|max:60',
            'price' => 'required|numeric|min:0',
            'description' => 'nullable|string|max:255',
            'features' => 'required|array',
            'is_active' => 'boolean',
            'max_users' => 'nullable|integer|min:1',
            'max_modules' => 'nullable|integer|min:1'
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $data = $request->all();
        
        // Calculate monthly price
        if (isset($data['price']) && isset($data['duration_months']) && $data['duration_months'] > 0) {
            $data['monthly_price'] = $data['price'] / $data['duration_months'];
        }
        
        // Encode features as JSON
        if (isset($data['features'])) {
            $data['features'] = json_encode($data['features']);
        }
        
        $plan = SubscriptionPlan::create($data);

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
            'duration_months' => 'sometimes|integer|min:1|max:60',
            'price' => 'sometimes|numeric|min:0',
            'description' => 'nullable|string|max:255',
            'features' => 'sometimes|array',
            'is_active' => 'sometimes|boolean',
            'max_users' => 'nullable|integer|min:1',
            'max_modules' => 'nullable|integer|min:1'
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $data = $request->all();
        
        // Calculate monthly price if price or duration changed
        if ((isset($data['price']) || isset($data['duration_months'])) && 
            ($data['duration_months'] ?? $plan->duration_months) > 0) {
            $price = $data['price'] ?? $plan->price;
            $duration = $data['duration_months'] ?? $plan->duration_months;
            $data['monthly_price'] = $price / $duration;
        }
        
        // Encode features as JSON if provided
        if (isset($data['features'])) {
            $data['features'] = json_encode($data['features']);
        }
        
        $plan->update($data);

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
