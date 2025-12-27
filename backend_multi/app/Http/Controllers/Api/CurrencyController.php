<?php

namespace App\Http\Controllers\Api;

use App\Models\Currency;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CurrencyController extends BaseController
{
    public function index()
    {
        $currencies = Currency::with('exchangeRates')->paginate(15);
        return $this->sendResponse($currencies, 'Currencies retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string|max:10',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $currency = Currency::create($request->all());

        return $this->sendResponse($currency, 'Currency created successfully', 201);
    }

    public function show($id)
    {
        $currency = Currency::with('exchangeRates')->find($id);

        if (!$currency) {
            return $this->sendError('Currency not found');
        }

        return $this->sendResponse($currency, 'Currency retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $currency = Currency::find($id);

        if (!$currency) {
            return $this->sendError('Currency not found');
        }

        $validator = Validator::make($request->all(), [
            'code' => 'sometimes|string|max:10',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $currency->update($request->all());

        return $this->sendResponse($currency, 'Currency updated successfully');
    }

    public function destroy($id)
    {
        $currency = Currency::find($id);

        if (!$currency) {
            return $this->sendError('Currency not found');
        }

        $currency->delete();

        return $this->sendResponse([], 'Currency deleted successfully');
    }
}
