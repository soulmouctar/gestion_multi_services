<?php

namespace App\Http\Controllers\Api;

use App\Models\Supplier;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class SupplierController extends BaseController
{
    public function index(Request $request)
    {
        $user     = Auth::user();
        $tenantId = $user->hasRole('SUPER_ADMIN') ? $request->get('tenant_id') : $user->tenant_id;

        $query = Supplier::query();

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('email', 'like', "%{$s}%")
                  ->orWhere('phone1', 'like', "%{$s}%");
            });
        }

        $suppliers = $query->orderBy('name')->paginate($request->get('per_page', 15));
        return $this->sendResponse($suppliers, 'Suppliers retrieved successfully');
    }

    public function store(Request $request)
    {
        $user     = Auth::user();
        $tenantId = $user->hasRole('SUPER_ADMIN')
            ? ($request->get('tenant_id') ?? $user->tenant_id)
            : $user->tenant_id;

        if (!$tenantId) {
            return $this->sendError('Tenant ID requis pour créer un fournisseur.', [], 422);
        }

        $validator = Validator::make($request->all(), [
            'name'     => 'required|string|max:150',
            'email'    => 'nullable|email|max:150',
            'phone1'   => 'nullable|string|max:50',
            'phone2'   => 'nullable|string|max:50',
            'address'  => 'nullable|string|max:255',
            'notes'    => 'nullable|string|max:1000',
            'currency' => 'nullable|string|max:10',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $supplier = Supplier::create([
            'tenant_id' => $tenantId,
            'name'      => $request->name,
            'email'     => $request->email,
            'phone1'    => $request->phone1,
            'phone2'    => $request->phone2,
            'address'   => $request->address,
            'notes'     => $request->notes,
            'currency'  => $request->currency ?? 'GNF',
        ]);

        return $this->sendResponse($supplier, 'Supplier created successfully', 201);
    }

    public function show($id)
    {
        $user     = Auth::user();
        $supplier = Supplier::find($id);

        if (!$supplier) {
            return $this->sendError('Supplier not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $supplier->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        return $this->sendResponse($supplier, 'Supplier retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $user     = Auth::user();
        $supplier = Supplier::find($id);

        if (!$supplier) {
            return $this->sendError('Supplier not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $supplier->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $validator = Validator::make($request->all(), [
            'name'     => 'sometimes|string|max:150',
            'email'    => 'nullable|email|max:150',
            'phone1'   => 'nullable|string|max:50',
            'phone2'   => 'nullable|string|max:50',
            'address'  => 'nullable|string|max:255',
            'notes'    => 'nullable|string|max:1000',
            'currency' => 'nullable|string|max:10',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $supplier->update($request->only(['name', 'email', 'phone1', 'phone2', 'address', 'notes', 'currency']));

        return $this->sendResponse($supplier, 'Supplier updated successfully');
    }

    public function destroy($id)
    {
        $user     = Auth::user();
        $supplier = Supplier::find($id);

        if (!$supplier) {
            return $this->sendError('Supplier not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $supplier->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        if ($supplier->photo) {
            Storage::disk('public')->delete($supplier->photo);
        }

        $supplier->delete();
        return $this->sendResponse([], 'Supplier deleted successfully');
    }

    public function uploadPhoto(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'photo' => 'required|image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $user     = Auth::user();
        $supplier = Supplier::find($id);

        if (!$supplier || (!$user->hasRole('SUPER_ADMIN') && $supplier->tenant_id !== $user->tenant_id)) {
            return $this->sendError('Supplier not found', [], 404);
        }

        if ($supplier->photo) {
            Storage::disk('public')->delete($supplier->photo);
        }

        $path = $request->file('photo')->store('suppliers', 'public');
        $supplier->update(['photo' => $path]);

        return $this->sendResponse($supplier, 'Photo uploaded successfully');
    }

    public function deletePhoto($id)
    {
        $user     = Auth::user();
        $supplier = Supplier::find($id);

        if (!$supplier || (!$user->hasRole('SUPER_ADMIN') && $supplier->tenant_id !== $user->tenant_id)) {
            return $this->sendError('Supplier not found', [], 404);
        }

        if ($supplier->photo) {
            Storage::disk('public')->delete($supplier->photo);
            $supplier->update(['photo' => null]);
        }

        return $this->sendResponse($supplier, 'Photo deleted successfully');
    }

    /**
     * Relations financières : entrées (paiements reçus du fournisseur) et
     * sorties (paiements effectués vers le fournisseur) en ordre chronologique.
     */
    public function getFinancialRelations(Request $request, $id)
    {
        $user     = Auth::user();
        $supplier = Supplier::find($id);

        if (!$supplier) {
            return $this->sendError('Supplier not found', [], 404);
        }

        if (!$user->hasRole('SUPER_ADMIN') && $supplier->tenant_id !== $user->tenant_id) {
            return $this->sendError('Accès refusé', [], 403);
        }

        $payments = Payment::where('supplier_id', $id)
            ->where('tenant_id', $supplier->tenant_id)
            ->where('status', 'COMPLETED')
            ->orderBy('payment_date', 'desc')
            ->get();

        $totalOut = $payments->where('type', 'SUPPLIER')->sum('amount');
        $totalIn  = $payments->whereIn('type', ['DEPOT', 'RETRAIT'])->sum('amount');

        $history = $payments->map(fn ($p) => [
            'id'             => $p->id,
            'date'           => $p->payment_date->format('Y-m-d'),
            'type'           => $p->type,
            'direction'      => in_array($p->type, ['DEPOT']) ? 'credit' : 'debit',
            'label'          => "Paiement #{$p->receipt_number}",
            'amount'         => $p->amount,
            'currency'       => $p->currency,
            'method'         => $p->method,
            'reference'      => $p->reference,
            'description'    => $p->description,
            'receipt_number' => $p->receipt_number,
        ]);

        return $this->sendResponse([
            'supplier' => [
                'id'        => $supplier->id,
                'name'      => $supplier->name,
                'email'     => $supplier->email,
                'phone1'    => $supplier->phone1,
                'photo_url' => $supplier->photo_url,
                'currency'  => $supplier->currency,
            ],
            'summary' => [
                'total_paid_to_supplier' => $totalOut,
                'total_transactions'     => $payments->count(),
                'currency'               => $supplier->currency ?? 'GNF',
            ],
            'history' => $history,
        ], 'Financial relations retrieved successfully');
    }
}
