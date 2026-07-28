<?php

namespace App\Http\Controllers\Api;

use App\Models\ExchangeRate;
use App\Models\Currency;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class ExchangeRateController extends BaseController
{
    private function tenantId(Request $request): ?int
    {
        $user = Auth::user();

        if (!$user) {
            return null;
        }

        if ($user->hasRole('SUPER_ADMIN')) {
            return $request->input('tenant_id') ?? $request->query('tenant_id') ?? $user->tenant_id;
        }

        return $user->tenant_id;
    }

    private function scopedRateQuery(Request $request)
    {
        $tenantId = $this->tenantId($request);

        return ExchangeRate::with('currency')
            ->whereHas('currency', function ($query) use ($tenantId) {
                if ($tenantId) {
                    $query->where('tenant_id', $tenantId);
                }
            });
    }

    private function validateCurrencyTenant(int $currencyId, ?int $tenantId): bool
    {
        return Currency::query()
            ->when($tenantId, fn ($query) => $query->where('tenant_id', $tenantId))
            ->whereKey($currencyId)
            ->exists();
    }

    public function index(Request $request)
    {
        $query = $this->scopedRateQuery($request);

        if ($request->has('currency_id')) {
            $query->where('currency_id', $request->currency_id);
        }

        $rates = $query->orderBy('rate_date', 'desc')->paginate(15);
        return $this->sendResponse($rates, 'Exchange rates retrieved successfully');
    }

    public function store(Request $request)
    {
        $tenantId = $this->tenantId($request);

        $validator = Validator::make($request->all(), [
            'currency_id' => 'required|exists:currencies,id',
            'rate' => 'required|numeric|min:0',
            'rate_date' => 'required|date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        if (!$this->validateCurrencyTenant((int) $request->currency_id, $tenantId)) {
            return $this->sendError('Currency not found for this tenant', [
                'currency_id' => ['La devise sélectionnée n’appartient pas au tenant courant.'],
            ], 422);
        }

        $rate = ExchangeRate::create($request->only(['currency_id', 'rate', 'rate_date']));

        return $this->sendResponse($rate->load('currency'), 'Exchange rate created successfully', 201);
    }

    public function show(Request $request, $id)
    {
        $rate = $this->scopedRateQuery($request)->find($id);

        if (!$rate) {
            return $this->sendError('Exchange rate not found', [], 404);
        }

        return $this->sendResponse($rate, 'Exchange rate retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $tenantId = $this->tenantId($request);
        $rate = $this->scopedRateQuery($request)->find($id);

        if (!$rate) {
            return $this->sendError('Exchange rate not found', [], 404);
        }

        $validator = Validator::make($request->all(), [
            'currency_id' => 'sometimes|exists:currencies,id',
            'rate' => 'sometimes|numeric|min:0',
            'rate_date' => 'sometimes|date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        if ($request->filled('currency_id') && !$this->validateCurrencyTenant((int) $request->currency_id, $tenantId)) {
            return $this->sendError('Currency not found for this tenant', [
                'currency_id' => ['La devise sélectionnée n’appartient pas au tenant courant.'],
            ], 422);
        }

        $rate->update($request->only(['currency_id', 'rate', 'rate_date']));

        return $this->sendResponse($rate->load('currency'), 'Exchange rate updated successfully');
    }

    public function destroy(Request $request, $id)
    {
        $rate = $this->scopedRateQuery($request)->find($id);

        if (!$rate) {
            return $this->sendError('Exchange rate not found', [], 404);
        }

        $rate->delete();

        return $this->sendResponse($rate, 'Exchange rate deleted successfully');
    }

    public function publicIndex(Request $request)
    {
        $query = ExchangeRate::with('currency');

        if ($request->has('currency_id')) {
            $query->where('currency_id', $request->currency_id);
        }

        $rates = $query->orderBy('rate_date', 'desc')->paginate(15);
        return $this->sendResponse($rates, 'Exchange rates retrieved successfully');
    }

    public function publicStore(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'currency_id' => 'required|exists:currencies,id',
            'rate' => 'required|numeric|min:0',
            'rate_date' => 'required|date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $rate = ExchangeRate::create($request->all());

        return $this->sendResponse($rate->load('currency'), 'Exchange rate created successfully', 201);
    }
}
