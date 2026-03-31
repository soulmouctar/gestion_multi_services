<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\BaseController;
use App\Models\ContainerPayment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ContainerPaymentController extends BaseController
{
    public function index(Request $request)
    {
        try {
            $tenantId = $request->get('tenant_id', 1);
            
            $query = ContainerPayment::with(['container', 'supplier', 'client'])
                ->where('tenant_id', $tenantId);

            if ($request->has('type')) {
                $query->where('type', $request->get('type'));
            }

            if ($request->has('container_id')) {
                $query->where('container_id', $request->get('container_id'));
            }

            if ($request->has('status')) {
                $query->where('status', $request->get('status'));
            }

            $query->orderBy('payment_date', 'desc');

            $perPage = $request->get('per_page', 15);
            $payments = $query->paginate($perPage);

            // Add supplier/client names to the response
            $payments->getCollection()->transform(function ($payment) {
                $payment->supplier_name = $payment->supplier ? $payment->supplier->name : null;
                $payment->client_name = $payment->client ? $payment->client->name : null;
                return $payment;
            });

            return $this->sendResponse($payments, 'Container payments retrieved successfully');
        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'container_id' => 'required|exists:containers,id',
                'type' => 'required|in:SUPPLIER,CLIENT',
                'amount' => 'required|numeric|min:0',
                'currency' => 'required|string|max:10',
                'payment_method' => 'required|string|max:50',
                'payment_date' => 'required|date',
                'reference' => 'nullable|string|max:100',
                'description' => 'nullable|string|max:500',
                'status' => 'required|in:PENDING,PAID,PARTIAL,CANCELLED',
                'supplier_id' => 'nullable|exists:suppliers,id',
                'client_id' => 'nullable|exists:clients,id'
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            $data = $request->all();
            $data['tenant_id'] = $request->get('tenant_id', 1);

            $payment = ContainerPayment::create($data);

            return $this->sendResponse($payment->load(['container', 'supplier', 'client']), 'Container payment created successfully', 201);
        } catch (\Exception $e) {
            \Log::error('Error creating container payment: ' . $e->getMessage());
            return $this->sendError('Error creating payment', ['error' => $e->getMessage()], 500);
        }
    }

    public function show($id)
    {
        $payment = ContainerPayment::with(['container', 'supplier', 'client'])->find($id);

        if (!$payment) {
            return $this->sendError('Payment not found', [], 404);
        }

        return $this->sendResponse($payment, 'Container payment retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $payment = ContainerPayment::find($id);

        if (!$payment) {
            return $this->sendError('Payment not found', [], 404);
        }

        $validator = Validator::make($request->all(), [
            'container_id' => 'sometimes|exists:containers,id',
            'type' => 'sometimes|in:SUPPLIER,CLIENT',
            'amount' => 'sometimes|numeric|min:0',
            'currency' => 'sometimes|string|max:10',
            'payment_method' => 'sometimes|string|max:50',
            'payment_date' => 'sometimes|date',
            'reference' => 'nullable|string|max:100',
            'description' => 'nullable|string|max:500',
            'status' => 'sometimes|in:PENDING,PAID,PARTIAL,CANCELLED',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'client_id' => 'nullable|exists:clients,id'
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $payment->update($request->all());

        return $this->sendResponse($payment->load(['container', 'supplier', 'client']), 'Container payment updated successfully');
    }

    public function destroy($id)
    {
        $payment = ContainerPayment::find($id);

        if (!$payment) {
            return $this->sendError('Payment not found', [], 404);
        }

        $payment->delete();

        return $this->sendResponse([], 'Container payment deleted successfully');
    }

    public function statistics(Request $request)
    {
        try {
            $tenantId = $request->get('tenant_id', 1);

            $supplierPaid = ContainerPayment::where('tenant_id', $tenantId)
                ->where('type', 'SUPPLIER')
                ->where('status', 'PAID')
                ->sum('amount');

            $supplierPending = ContainerPayment::where('tenant_id', $tenantId)
                ->where('type', 'SUPPLIER')
                ->whereIn('status', ['PENDING', 'PARTIAL'])
                ->sum('amount');

            $clientPaid = ContainerPayment::where('tenant_id', $tenantId)
                ->where('type', 'CLIENT')
                ->where('status', 'PAID')
                ->sum('amount');

            $clientPending = ContainerPayment::where('tenant_id', $tenantId)
                ->where('type', 'CLIENT')
                ->whereIn('status', ['PENDING', 'PARTIAL'])
                ->sum('amount');

            return $this->sendResponse([
                'totalSupplierPaid' => (float) $supplierPaid,
                'totalSupplierPending' => (float) $supplierPending,
                'totalClientPaid' => (float) $clientPaid,
                'totalClientPending' => (float) $clientPending
            ], 'Statistics retrieved successfully');
        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }
}
