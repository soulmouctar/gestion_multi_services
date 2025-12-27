<?php

namespace App\Http\Controllers\Api;

use App\Models\Subscription;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SubscriptionController extends BaseController
{
    public function index(Request $request)
    {
        $query = Subscription::with('tenant', 'plan', 'payments');

        if ($request->has('tenant_id')) {
            $query->where('tenant_id', $request->tenant_id);
        }

        $subscriptions = $query->paginate(15);
        return $this->sendResponse($subscriptions, 'Subscriptions retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tenant_id' => 'required|exists:tenants,id',
            'plan_id' => 'required|exists:subscription_plans,id',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
            'status' => 'nullable|in:ACTIVE,EXPIRED,ILLIMITY',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $subscription = Subscription::create($request->all());

        return $this->sendResponse($subscription->load('tenant', 'plan'), 'Subscription created successfully', 201);
    }

    public function show($id)
    {
        $subscription = Subscription::with('tenant', 'plan', 'payments')->find($id);

        if (!$subscription) {
            return $this->sendError('Subscription not found');
        }

        return $this->sendResponse($subscription, 'Subscription retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $subscription = Subscription::find($id);

        if (!$subscription) {
            return $this->sendError('Subscription not found');
        }

        $validator = Validator::make($request->all(), [
            'tenant_id' => 'sometimes|exists:tenants,id',
            'plan_id' => 'sometimes|exists:subscription_plans,id',
            'start_date' => 'sometimes|date',
            'end_date' => 'sometimes|date',
            'status' => 'nullable|in:ACTIVE,EXPIRED,ILLIMITY',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $subscription->update($request->all());

        return $this->sendResponse($subscription->load('tenant', 'plan'), 'Subscription updated successfully');
    }

    public function destroy($id)
    {
        $subscription = Subscription::find($id);

        if (!$subscription) {
            return $this->sendError('Subscription not found');
        }

        $subscription->delete();

        return $this->sendResponse([], 'Subscription deleted successfully');
    }
}
