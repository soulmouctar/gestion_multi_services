<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\BaseController;
use App\Models\ContainerArrival;
use App\Models\ContainerSale;
use App\Models\ContainerSalePayment;
use App\Models\ClientAdvance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class ContainerSalesController extends BaseController
{
    // ==================== ARRIVAGES ====================
    
    public function getArrivals(Request $request)
    {
        try {
            $tenantId = $request->get('tenant_id', 1);
            
            $query = ContainerArrival::with(['container', 'supplier'])
                ->where('tenant_id', $tenantId);

            if ($request->has('status')) {
                $query->where('status', $request->get('status'));
            }

            if ($request->has('container_id')) {
                $query->where('container_id', $request->get('container_id'));
            }

            $query->orderBy('arrival_date', 'desc');
            $perPage = $request->get('per_page', 15);
            $arrivals = $query->paginate($perPage);

            return $this->sendResponse($arrivals, 'Arrivals retrieved successfully');
        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }

    public function storeArrival(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'container_id' => 'required|exists:containers,id',
                'supplier_id' => 'nullable|exists:suppliers,id',
                'arrival_date' => 'required|date',
                'purchase_price' => 'required|numeric|min:0',
                'currency' => 'required|string|max:10',
                'product_type' => 'required|in:HABITS,PNEUS,ELECTRONIQUE,DIVERS,MIXTE',
                'total_quantity' => 'required|integer|min:1',
                'description' => 'nullable|string|max:1000'
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            $data = $request->all();
            $data['tenant_id'] = $request->get('tenant_id', 1);
            $data['remaining_quantity'] = $data['total_quantity'];
            $data['status'] = 'EN_COURS';

            $arrival = ContainerArrival::create($data);

            return $this->sendResponse($arrival->load(['container', 'supplier']), 'Arrival created successfully', 201);
        } catch (\Exception $e) {
            \Log::error('Error creating arrival: ' . $e->getMessage());
            return $this->sendError('Error creating arrival', ['error' => $e->getMessage()], 500);
        }
    }

    public function updateArrival(Request $request, $id)
    {
        $arrival = ContainerArrival::find($id);
        if (!$arrival) {
            return $this->sendError('Arrival not found', [], 404);
        }

        $validator = Validator::make($request->all(), [
            'supplier_id' => 'nullable|exists:suppliers,id',
            'arrival_date' => 'sometimes|date',
            'purchase_price' => 'sometimes|numeric|min:0',
            'product_type' => 'sometimes|in:HABITS,PNEUS,ELECTRONIQUE,DIVERS,MIXTE',
            'total_quantity' => 'sometimes|integer|min:1',
            'description' => 'nullable|string|max:1000',
            'status' => 'sometimes|in:EN_COURS,VENDU_PARTIEL,VENDU_TOTAL,CLOTURE'
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $arrival->update($request->all());
        return $this->sendResponse($arrival->load(['container', 'supplier']), 'Arrival updated successfully');
    }

    public function deleteArrival($id)
    {
        $arrival = ContainerArrival::find($id);
        if (!$arrival) {
            return $this->sendError('Arrival not found', [], 404);
        }

        $arrival->delete();
        return $this->sendResponse([], 'Arrival deleted successfully');
    }

    // ==================== VENTES ====================

    public function getSales(Request $request)
    {
        try {
            $tenantId = $request->get('tenant_id', 1);
            
            $query = ContainerSale::with(['containerArrival.container', 'client', 'payments'])
                ->where('tenant_id', $tenantId);

            if ($request->has('client_id')) {
                $query->where('client_id', $request->get('client_id'));
            }

            if ($request->has('status')) {
                $query->where('status', $request->get('status'));
            }

            if ($request->has('container_arrival_id')) {
                $query->where('container_arrival_id', $request->get('container_arrival_id'));
            }

            $query->orderBy('sale_date', 'desc');
            $perPage = $request->get('per_page', 15);
            $sales = $query->paginate($perPage);

            return $this->sendResponse($sales, 'Sales retrieved successfully');
        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }

    public function storeSale(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'container_arrival_id' => 'required|exists:container_arrivals,id',
                'client_id' => 'required|exists:clients,id',
                'sale_type' => 'required|in:TOTAL,PARTIEL,DETAIL',
                'quantity_sold' => 'required|integer|min:1',
                'sale_price' => 'required|numeric|min:0',
                'currency' => 'required|string|max:10',
                'is_installment' => 'boolean',
                'installment_count' => 'nullable|integer|min:1',
                'sale_date' => 'required|date',
                'due_date' => 'nullable|date',
                'notes' => 'nullable|string|max:1000'
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            // Vérifier la quantité disponible
            $arrival = ContainerArrival::find($request->container_arrival_id);
            if ($request->quantity_sold > $arrival->remaining_quantity) {
                return $this->sendError('Quantité insuffisante', ['error' => 'La quantité demandée dépasse le stock disponible'], 422);
            }

            DB::beginTransaction();

            $data = $request->all();
            $data['tenant_id'] = $request->get('tenant_id', 1);
            $data['amount_paid'] = 0;
            $data['remaining_amount'] = $data['sale_price'];
            $data['status'] = 'EN_COURS';

            $sale = ContainerSale::create($data);

            // Mettre à jour la quantité restante de l'arrivage
            $arrival->remaining_quantity -= $request->quantity_sold;
            if ($arrival->remaining_quantity <= 0) {
                $arrival->status = 'VENDU_TOTAL';
            } else {
                $arrival->status = 'VENDU_PARTIEL';
            }
            $arrival->save();

            DB::commit();

            return $this->sendResponse($sale->load(['containerArrival.container', 'client']), 'Sale created successfully', 201);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error creating sale: ' . $e->getMessage());
            return $this->sendError('Error creating sale', ['error' => $e->getMessage()], 500);
        }
    }

    public function updateSale(Request $request, $id)
    {
        $sale = ContainerSale::find($id);
        if (!$sale) {
            return $this->sendError('Sale not found', [], 404);
        }

        $validator = Validator::make($request->all(), [
            'sale_price' => 'sometimes|numeric|min:0',
            'is_installment' => 'boolean',
            'installment_count' => 'nullable|integer|min:1',
            'due_date' => 'nullable|date',
            'notes' => 'nullable|string|max:1000',
            'status' => 'sometimes|in:EN_COURS,PAYE_PARTIEL,PAYE_TOTAL,ANNULE'
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $sale->update($request->all());
        
        // Recalculer le reste à payer si le prix change
        if ($request->has('sale_price')) {
            $sale->remaining_amount = $sale->sale_price - $sale->amount_paid;
            $sale->save();
        }

        return $this->sendResponse($sale->load(['containerArrival.container', 'client', 'payments']), 'Sale updated successfully');
    }

    // ==================== VERSEMENTS ====================

    public function getPayments(Request $request)
    {
        try {
            $tenantId = $request->get('tenant_id', 1);
            
            $query = ContainerSalePayment::with(['containerSale.containerArrival.container', 'client'])
                ->where('tenant_id', $tenantId);

            if ($request->has('client_id')) {
                $query->where('client_id', $request->get('client_id'));
            }

            if ($request->has('container_sale_id')) {
                $query->where('container_sale_id', $request->get('container_sale_id'));
            }

            $query->orderBy('payment_date', 'desc');
            $perPage = $request->get('per_page', 15);
            $payments = $query->paginate($perPage);

            return $this->sendResponse($payments, 'Payments retrieved successfully');
        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }

    public function storePayment(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'container_sale_id' => 'required|exists:container_sales,id',
                'amount' => 'required|numeric|min:0',
                'currency' => 'required|string|max:10',
                'payment_method' => 'required|string|max:50',
                'payment_date' => 'required|date',
                'reference' => 'nullable|string|max:100',
                'notes' => 'nullable|string|max:500'
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            $sale = ContainerSale::find($request->container_sale_id);
            
            $data = $request->all();
            $data['tenant_id'] = $request->get('tenant_id', 1);
            $data['client_id'] = $sale->client_id;
            $data['payment_type'] = 'VERSEMENT';

            $payment = ContainerSalePayment::create($data);

            return $this->sendResponse($payment->load(['containerSale', 'client']), 'Payment recorded successfully', 201);
        } catch (\Exception $e) {
            \Log::error('Error recording payment: ' . $e->getMessage());
            return $this->sendError('Error recording payment', ['error' => $e->getMessage()], 500);
        }
    }

    public function deletePayment($id)
    {
        $payment = ContainerSalePayment::find($id);
        if (!$payment) {
            return $this->sendError('Payment not found', [], 404);
        }

        $payment->delete();
        return $this->sendResponse([], 'Payment deleted successfully');
    }

    // ==================== AVANCES CLIENTS ====================

    public function getAdvances(Request $request)
    {
        try {
            $tenantId = $request->get('tenant_id', 1);
            
            $query = ClientAdvance::with(['client'])
                ->where('tenant_id', $tenantId);

            if ($request->has('client_id')) {
                $query->where('client_id', $request->get('client_id'));
            }

            if ($request->has('status')) {
                $query->where('status', $request->get('status'));
            }

            $query->orderBy('payment_date', 'desc');
            $perPage = $request->get('per_page', 15);
            $advances = $query->paginate($perPage);

            return $this->sendResponse($advances, 'Advances retrieved successfully');
        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }

    public function storeAdvance(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'client_id' => 'required|exists:clients,id',
                'amount' => 'required|numeric|min:0',
                'currency' => 'required|string|max:10',
                'payment_method' => 'required|string|max:50',
                'payment_date' => 'required|date',
                'reference' => 'nullable|string|max:100',
                'description' => 'nullable|string|max:500'
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            $data = $request->all();
            $data['tenant_id'] = $request->get('tenant_id', 1);
            $data['used_amount'] = 0;
            $data['remaining_amount'] = $data['amount'];
            $data['status'] = 'DISPONIBLE';

            $advance = ClientAdvance::create($data);

            return $this->sendResponse($advance->load(['client']), 'Advance recorded successfully', 201);
        } catch (\Exception $e) {
            \Log::error('Error recording advance: ' . $e->getMessage());
            return $this->sendError('Error recording advance', ['error' => $e->getMessage()], 500);
        }
    }

    // ==================== STATISTIQUES CLIENT ====================

    public function getClientStats(Request $request, $clientId)
    {
        try {
            $tenantId = $request->get('tenant_id', 1);

            // Taux de change (à stocker en base de données idéalement)
            $exchangeRates = [
                'GNF' => 1,
                'USD' => 8600,
                'EUR' => 9300
            ];

            // Helper function to convert to GNF
            $convertToGNF = function($amount, $currency) use ($exchangeRates) {
                if ($currency === 'GNF' || !isset($exchangeRates[$currency])) {
                    return $amount;
                }
                return $amount * $exchangeRates[$currency];
            };

            // Total des ventes au client (converti en GNF)
            $sales = ContainerSale::where('tenant_id', $tenantId)
                ->where('client_id', $clientId)
                ->get();
            
            $totalSales = 0;
            foreach ($sales as $sale) {
                $totalSales += $convertToGNF($sale->sale_price, $sale->currency ?? 'GNF');
            }

            // Total payé par le client (converti en GNF)
            $payments = ContainerSalePayment::where('tenant_id', $tenantId)
                ->where('client_id', $clientId)
                ->get();
            
            $totalPaid = 0;
            foreach ($payments as $payment) {
                $totalPaid += $convertToGNF($payment->amount, $payment->currency ?? 'GNF');
            }

            // Total restant à payer (dette) - converti en GNF
            $pendingSales = ContainerSale::where('tenant_id', $tenantId)
                ->where('client_id', $clientId)
                ->whereIn('status', ['EN_COURS', 'PAYE_PARTIEL'])
                ->get();
            
            $totalDebt = 0;
            foreach ($pendingSales as $sale) {
                $totalDebt += $convertToGNF($sale->remaining_amount, $sale->currency ?? 'GNF');
            }

            // Avances disponibles (converti en GNF)
            $advances = ClientAdvance::where('tenant_id', $tenantId)
                ->where('client_id', $clientId)
                ->where('status', '!=', 'UTILISE_TOTAL')
                ->get();
            
            $totalAdvances = 0;
            foreach ($advances as $advance) {
                $totalAdvances += $convertToGNF($advance->remaining_amount, $advance->currency ?? 'GNF');
            }

            // Nombre de ventes en cours
            $pendingSalesCount = $pendingSales->count();

            return $this->sendResponse([
                'total_sales' => (float) $totalSales,
                'total_paid' => (float) $totalPaid,
                'total_debt' => (float) $totalDebt,
                'total_advances' => (float) $totalAdvances,
                'pending_sales_count' => $pendingSalesCount,
                'balance' => (float) ($totalAdvances - $totalDebt),
                'currency' => 'GNF' // Tout est converti en GNF
            ], 'Client statistics retrieved successfully');
        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }

    // ==================== STATISTIQUES GLOBALES ====================

    public function getGlobalStats(Request $request)
    {
        try {
            $tenantId = $request->get('tenant_id', 1);

            // Arrivages
            $totalArrivals = ContainerArrival::where('tenant_id', $tenantId)->count();
            $totalPurchaseValue = ContainerArrival::where('tenant_id', $tenantId)->sum('purchase_price');

            // Ventes
            $totalSalesValue = ContainerSale::where('tenant_id', $tenantId)->sum('sale_price');
            $totalCollected = ContainerSalePayment::where('tenant_id', $tenantId)->sum('amount');
            $totalPending = ContainerSale::where('tenant_id', $tenantId)
                ->whereIn('status', ['EN_COURS', 'PAYE_PARTIEL'])
                ->sum('remaining_amount');

            // Avances clients
            $totalAdvances = ClientAdvance::where('tenant_id', $tenantId)
                ->where('status', '!=', 'UTILISE_TOTAL')
                ->sum('remaining_amount');

            // Profit estimé
            $profit = $totalSalesValue - $totalPurchaseValue;

            return $this->sendResponse([
                'total_arrivals' => $totalArrivals,
                'total_purchase_value' => (float) $totalPurchaseValue,
                'total_sales_value' => (float) $totalSalesValue,
                'total_collected' => (float) $totalCollected,
                'total_pending' => (float) $totalPending,
                'total_client_advances' => (float) $totalAdvances,
                'estimated_profit' => (float) $profit
            ], 'Global statistics retrieved successfully');
        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }
}
