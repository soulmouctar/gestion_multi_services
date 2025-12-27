<?php

namespace App\Http\Controllers\Api;

use App\Models\ExchangeRate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ExchangeRateController extends BaseController
{
    public function index(Request $request)
    {
        $query = ExchangeRate::with('currency');

        if ($request->has('currency_id')) {
            $query->where('currency_id', $request->currency_id);
        }

        $rates = $query->orderBy('rate_date', 'desc')->paginate(15);
        return $this->sendResponse($rates, 'Exchange rates retrieved successfully');
    }

    public function store(Request $request)
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

    public function show($id)
    {
        $rate = ExchangeRate::with('currency')->find($id);

        if (!$rate) {
            return $this->sendError('Exchange rate not found');
        }

        return $this->sendResponse($rate, 'Exchange rate retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $rate = ExchangeRate::find($id);

        if (!$rate) {
            return $this->sendError('Exchange rate not found');
        }

        $validator = Validator::make($request->all(), [
            'currency_id' => 'sometimes|exists:currencies,id',
            'rate' => 'sometimes|numeric|min:0',
            'rate_date' => 'sometimes|date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $rate->update($request->all());

        return $this->sendResponse($rate->load('currency'), 'Exchange rate updated successfully');
    }

    public function destroy($id)
    {
        $rate = ExchangeRate::find($id);

        if (!$rate) {
            return $this->sendError('Exchange rate not found');
        }

        $rate->delete();

        return $this->sendResponse([], 'Exchange rate deleted successfully');
    }
}
