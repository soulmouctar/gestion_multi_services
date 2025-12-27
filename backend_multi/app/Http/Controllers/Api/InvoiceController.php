<?php

namespace App\Http\Controllers\Api;

use App\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class InvoiceController extends BaseController
{
    public function index(Request $request)
    {
        $query = Invoice::with('tenant', 'client');

        if ($request->has('tenant_id')) {
            $query->where('tenant_id', $request->tenant_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $invoices = $query->orderBy('created_at', 'desc')->paginate(15);
        return $this->sendResponse($invoices, 'Invoices retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tenant_id' => 'required|exists:tenants,id',
            'client_id' => 'nullable|exists:clients,id',
            'invoice_number' => 'required|string|max:100',
            'total_amount' => 'required|numeric|min:0',
            'status' => 'nullable|in:PAYE,PARTIEL,IMPAYE',
            'due_date' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $invoice = Invoice::create($request->all());

        return $this->sendResponse($invoice->load('client'), 'Invoice created successfully', 201);
    }

    public function show($id)
    {
        $invoice = Invoice::with('tenant', 'client')->find($id);

        if (!$invoice) {
            return $this->sendError('Invoice not found');
        }

        return $this->sendResponse($invoice, 'Invoice retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $invoice = Invoice::find($id);

        if (!$invoice) {
            return $this->sendError('Invoice not found');
        }

        $validator = Validator::make($request->all(), [
            'tenant_id' => 'sometimes|exists:tenants,id',
            'client_id' => 'nullable|exists:clients,id',
            'invoice_number' => 'sometimes|string|max:100',
            'total_amount' => 'sometimes|numeric|min:0',
            'status' => 'nullable|in:PAYE,PARTIEL,IMPAYE',
            'due_date' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $invoice->update($request->all());

        return $this->sendResponse($invoice->load('client'), 'Invoice updated successfully');
    }

    public function destroy($id)
    {
        $invoice = Invoice::find($id);

        if (!$invoice) {
            return $this->sendError('Invoice not found');
        }

        $invoice->delete();

        return $this->sendResponse([], 'Invoice deleted successfully');
    }
}
