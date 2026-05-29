<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\BaseController;
use App\Models\ContainerArrival;
use App\Models\ContainerSale;
use App\Models\ContainerSalePayment;
use App\Models\ClientAdvance;
use App\Models\Currency;
use App\Models\ExchangeRate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ContainerSalesController extends BaseController
{
    // ==================== ARRIVAGES ====================
    
    private function tenantId(Request $request): ?int
    {
        $user = auth()->user();
        return $user->hasRole('SUPER_ADMIN') ? $request->get('tenant_id') : $user->tenant_id;
    }

    public function getArrivals(Request $request)
    {
        try {
            $tenantId = $this->tenantId($request);

            $relations = ['container', 'supplier'];
            if ($this->hasArrivalCategoryColumn()) {
                $relations[] = 'productCategory';
            }
            if ($this->hasArrivalPhotoLinkColumn()) {
                $relations[] = 'photos';
            }

            $query = ContainerArrival::with($relations)->where('tenant_id', $tenantId);

            if ($this->hasArrivalPhotoLinkColumn()) {
                $query->withCount('photos');
            }

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
                'exchange_rate' => 'nullable|numeric|min:0.0001',
                'product_category_id' => 'nullable|exists:product_categories,id',
                'product_type' => 'nullable|in:HABITS,PNEUS,ELECTRONIQUE,DIVERS,MIXTE',
                'total_quantity' => 'required|integer|min:1',
                'bale_quantity' => 'nullable|integer|min:1',
                'description' => 'nullable|string|max:1000'
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            $data = $request->all();
            $tenantId = $this->tenantId($request);
            $currency = strtoupper((string) ($data['currency'] ?? 'GNF'));
            $exchangeRate = $this->resolveExchangeRateForCurrency($tenantId, $currency, $request->input('exchange_rate'));
            $purchasePriceGnf = $this->convertToGnf((float) $data['purchase_price'], $currency, $exchangeRate);

            $data['tenant_id'] = $tenantId;
            $data['currency'] = $currency;
            $data['exchange_rate'] = $exchangeRate;
            $data['purchase_price_gnf'] = $purchasePriceGnf;
            $data['remaining_quantity'] = $data['total_quantity'];
            $data['status'] = 'EN_COURS';
            $data['product_type'] = $data['product_type'] ?? 'DIVERS';
            if ($this->hasArrivalBaleColumn()) {
                $data['bale_quantity'] = (int) ($data['bale_quantity'] ?? $data['total_quantity']);
            } else {
                unset($data['bale_quantity']);
            }
            if (!$this->hasArrivalCategoryColumn()) {
                unset($data['product_category_id']);
            }

            $arrival = ContainerArrival::create($data);

            return $this->sendResponse($arrival->load($this->arrivalRelations()), 'Arrival created successfully', 201);
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
            'currency' => 'sometimes|string|max:10',
            'exchange_rate' => 'nullable|numeric|min:0.0001',
            'product_category_id' => 'nullable|exists:product_categories,id',
            'product_type' => 'nullable|in:HABITS,PNEUS,ELECTRONIQUE,DIVERS,MIXTE',
            'total_quantity' => 'sometimes|integer|min:1',
            'bale_quantity' => 'nullable|integer|min:1',
            'description' => 'nullable|string|max:1000',
            'status' => 'sometimes|in:EN_COURS,VENDU_PARTIEL,VENDU_TOTAL,CLOTURE'
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $data = $request->only(['supplier_id', 'arrival_date', 'purchase_price', 'currency', 'exchange_rate', 'product_category_id', 'product_type', 'total_quantity', 'bale_quantity', 'description', 'status']);
        if (array_key_exists('product_type', $data) && !$data['product_type']) {
            $data['product_type'] = 'DIVERS';
        }
        if (array_key_exists('purchase_price', $data) || array_key_exists('currency', $data) || array_key_exists('exchange_rate', $data)) {
            $currency = strtoupper((string) ($data['currency'] ?? $arrival->currency ?? 'GNF'));
            $exchangeRate = $this->resolveExchangeRateForCurrency($arrival->tenant_id, $currency, $data['exchange_rate'] ?? null);
            $data['currency'] = $currency;
            $data['exchange_rate'] = $exchangeRate;
            $data['purchase_price_gnf'] = $this->convertToGnf(
                (float) ($data['purchase_price'] ?? $arrival->purchase_price),
                $currency,
                $exchangeRate
            );
        }
        if (!$this->hasArrivalBaleColumn()) {
            unset($data['bale_quantity']);
        } elseif (!array_key_exists('bale_quantity', $data) && array_key_exists('total_quantity', $data)) {
            $data['bale_quantity'] = $data['total_quantity'];
        }
        if (!$this->hasArrivalCategoryColumn()) {
            unset($data['product_category_id']);
        }
        $arrival->update($data);
        return $this->sendResponse($arrival->load($this->arrivalRelations()), 'Arrival updated successfully');
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
            $tenantId = $this->tenantId($request);
            
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

    public function getAllocationSummary(Request $request)
    {
        try {
            $tenantId = $this->tenantId($request);

            $arrivals = ContainerArrival::with(['container:id,container_number', 'sales.client:id,name'])
                ->where('tenant_id', $tenantId)
                ->orderBy('arrival_date', 'desc')
                ->get();

            $summary = $arrivals->map(function (ContainerArrival $arrival) {
                $allocations = $arrival->sales
                    ->groupBy('client_id')
                    ->map(function ($clientSales) {
                        $first = $clientSales->first();
                        return [
                            'client_id'        => $first->client_id,
                            'client_name'      => $first->client?->name,
                            'allocated_quantity'=> (float) $clientSales->sum('quantity_sold'),
                            'total_sales'      => (float) $clientSales->sum('sale_price'),
                            'amount_paid'      => (float) $clientSales->sum('amount_paid'),
                            'remaining_amount' => (float) $clientSales->sum('remaining_amount'),
                            'sale_count'       => $clientSales->count(),
                        ];
                    })
                    ->values();

                return [
                    'arrival_id'          => $arrival->id,
                    'container_id'        => $arrival->container_id,
                    'container_number'    => $arrival->container?->container_number,
                    'arrival_date'        => $arrival->arrival_date,
                    'total_quantity'      => (float) $arrival->total_quantity,
                    'remaining_quantity'  => (float) $arrival->remaining_quantity,
                    'allocated_quantity'  => (float) ($arrival->total_quantity - $arrival->remaining_quantity),
                    'allocation_rate'     => $arrival->total_quantity > 0
                        ? round((($arrival->total_quantity - $arrival->remaining_quantity) / $arrival->total_quantity) * 100, 2)
                        : 0,
                    'allocations'         => $allocations,
                ];
            })->values();

            return $this->sendResponse($summary, 'Allocation summary retrieved successfully');
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
                'exchange_rate' => 'nullable|numeric|min:0.0001',
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
            $tenantId = $this->tenantId($request);
            $currency = strtoupper((string) ($data['currency'] ?? 'GNF'));
            $exchangeRate = $this->resolveExchangeRateForCurrency($tenantId, $currency, $request->input('exchange_rate'));
            $salePriceGnf = $this->convertToGnf((float) $data['sale_price'], $currency, $exchangeRate);

            $data['tenant_id'] = $tenantId;
            $data['currency'] = $currency;
            $data['amount_paid'] = 0;
            $data['remaining_amount'] = $data['sale_price'];
            $data['status'] = 'EN_COURS';
            if ($this->hasSaleConversionColumns()) {
                $data['exchange_rate'] = $exchangeRate;
                $data['sale_price_gnf'] = $salePriceGnf;
                $data['amount_paid_gnf'] = 0;
                $data['remaining_amount_gnf'] = $salePriceGnf;
            } else {
                unset($data['exchange_rate'], $data['sale_price_gnf'], $data['amount_paid_gnf'], $data['remaining_amount_gnf']);
            }

            $sale = ContainerSale::create($data);

            // Mettre à jour la quantité restante de l'arrivage
            $arrival->remaining_quantity -= $request->quantity_sold;
            if ($arrival->remaining_quantity <= 0) {
                $arrival->status = 'VENDU_TOTAL';
            } else {
                $arrival->status = 'VENDU_PARTIEL';
            }
            $arrival->save();

            $this->applyAvailableAdvancesToSale($sale, $tenantId, $request->sale_date);

            DB::commit();

            return $this->sendResponse($sale->fresh()->load(['containerArrival.container', 'client', 'payments']), 'Sale created successfully', 201);
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

        $sale->update($request->only(['sale_price', 'is_installment', 'installment_count', 'due_date', 'notes', 'status']));

        // Recalculer le reste à payer si le prix change
        if ($request->has('sale_price')) {
            $sale->remaining_amount = $sale->sale_price - $sale->amount_paid;
            if ($this->hasSaleConversionColumns()) {
                $exchangeRate = (float) ($sale->exchange_rate ?: 1);
                $sale->sale_price_gnf = $this->convertToGnf((float) $sale->sale_price, $sale->currency ?? 'GNF', $exchangeRate);
                $sale->remaining_amount_gnf = max(0, (float) $sale->sale_price_gnf - (float) ($sale->amount_paid_gnf ?? 0));
            }
            $sale->save();
        }

        return $this->sendResponse($sale->load(['containerArrival.container', 'client', 'payments']), 'Sale updated successfully');
    }

    // ==================== VERSEMENTS ====================

    public function getPayments(Request $request)
    {
        try {
            $tenantId = $this->tenantId($request);
            
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
                'amount'            => 'required|numeric|min:1',
                'currency'          => 'required|string|max:10',
                'exchange_rate'     => 'nullable|numeric|min:0.0001',
                'payment_method'    => 'required|string|max:50',
                'payment_date'      => 'required|date',
                'reference'         => 'nullable|string|max:100',
                'notes'             => 'nullable|string|max:500',
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            $sale = ContainerSale::findOrFail($request->container_sale_id);

            DB::beginTransaction();

            $data = $request->all();
            $currency = strtoupper((string) ($data['currency'] ?? 'GNF'));
            $exchangeRate = $this->resolveExchangeRateForCurrency($this->tenantId($request), $currency, $request->input('exchange_rate'));
            $amountGnf = $this->convertToGnf((float) $data['amount'], $currency, $exchangeRate);
            $data['tenant_id']    = $this->tenantId($request);
            $data['client_id']    = $sale->client_id;
            $data['payment_type'] = 'VERSEMENT';
            $data['currency'] = $currency;
            if ($this->hasPaymentConversionColumns()) {
                $data['exchange_rate'] = $exchangeRate;
                $data['amount_gnf'] = $amountGnf;
            } else {
                unset($data['exchange_rate'], $data['amount_gnf']);
            }

            $payment = ContainerSalePayment::create($data);

            // Recalculate sale totals from all payments (avoids float drift)
            $sale->updatePaymentStatus();

            DB::commit();

            return $this->sendResponse(
                $payment->load(['containerSale.containerArrival.container', 'client']),
                'Payment recorded successfully',
                201
            );
        } catch (\Exception $e) {
            DB::rollBack();
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

        DB::beginTransaction();

        $saleId = $payment->container_sale_id;
        $payment->delete();

        $sale = ContainerSale::find($saleId);
        if ($sale) {
            $sale->updatePaymentStatus();
        }

        DB::commit();

        return $this->sendResponse([], 'Payment deleted successfully');
    }

    // ==================== AVANCES CLIENTS ====================

    public function getAdvances(Request $request)
    {
        try {
            $tenantId = $this->tenantId($request);
            
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
            $data['tenant_id'] = $this->tenantId($request);
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
            $tenantId = $this->tenantId($request);
            $sales = ContainerSale::where('tenant_id', $tenantId)
                ->where('client_id', $clientId)
                ->with(['containerArrival.container', 'containerArrival.productCategory'])
                ->orderBy('sale_date')
                ->get();

            $payments = ContainerSalePayment::where('tenant_id', $tenantId)
                ->where('client_id', $clientId)
                ->orderBy('payment_date', 'desc')
                ->get();

            $advances = ClientAdvance::where('tenant_id', $tenantId)
                ->where('client_id', $clientId)
                ->where('status', '!=', 'UTILISE_TOTAL')
                ->orderBy('payment_date', 'desc')
                ->get();

            $totalSales = $sales->sum(fn (ContainerSale $sale) => $this->getSaleGrossAmountGnf($sale));
            $totalPaid = $payments->sum(fn (ContainerSalePayment $payment) => $this->getPaymentAmountGnf($payment));
            $totalDebt = $sales
                ->whereIn('status', ['EN_COURS', 'PAYE_PARTIEL'])
                ->sum(fn (ContainerSale $sale) => $this->getSaleRemainingAmountGnf($sale));
            $totalAdvances = $advances->sum(fn (ClientAdvance $advance) => $this->getAdvanceRemainingAmountGnf($tenantId, $advance));
            $pendingSalesCount = $sales->whereIn('status', ['EN_COURS', 'PAYE_PARTIEL'])->count();

            $salesBreakdown = $sales->map(function (ContainerSale $sale) {
                $arrival = $sale->containerArrival;

                return [
                    'sale_id' => $sale->id,
                    'sale_date' => $sale->sale_date?->format('Y-m-d'),
                    'container_number' => $arrival?->container?->container_number,
                    'product_label' => $arrival?->productCategory?->name ?: ($arrival?->product_type ?? 'Produit'),
                    'quantity_sold' => (float) $sale->quantity_sold,
                    'sale_price_gnf' => $this->getSaleGrossAmountGnf($sale),
                    'paid_amount_gnf' => $this->getSalePaidAmountGnf($sale),
                    'remaining_amount_gnf' => $this->getSaleRemainingAmountGnf($sale),
                    'status' => $sale->status,
                ];
            })->values();

            return $this->sendResponse([
                'total_sales' => round((float) $totalSales, 2),
                'total_paid' => round((float) $totalPaid, 2),
                'total_debt' => round((float) $totalDebt, 2),
                'total_advances' => round((float) $totalAdvances, 2),
                'pending_sales_count' => $pendingSalesCount,
                'balance' => round((float) ($totalAdvances - $totalDebt), 2),
                'currency' => 'GNF',
                'sales_breakdown' => $salesBreakdown,
            ], 'Client statistics retrieved successfully');
        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }

    public function getClientBalances(Request $request)
    {
        try {
            $tenantId = $this->tenantId($request);
            $clients = DB::table('clients')
                ->where('tenant_id', $tenantId)
                ->when($request->filled('search'), function ($query) use ($request) {
                    $search = $request->search;
                    $query->where(function ($nested) use ($search) {
                        $nested->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhere('phone1', 'like', "%{$search}%");
                    });
                })
                ->orderBy('name')
                ->get(['id', 'name', 'phone1', 'email', 'client_type', 'photo']);

            $rows = $clients->map(function ($client) use ($tenantId) {
                $sales = ContainerSale::where('tenant_id', $tenantId)->where('client_id', $client->id)->get();
                $payments = ContainerSalePayment::where('tenant_id', $tenantId)->where('client_id', $client->id)->get();
                $advances = ClientAdvance::where('tenant_id', $tenantId)->where('client_id', $client->id)->where('status', '!=', 'UTILISE_TOTAL')->get();

                $totalSales = $sales->sum(fn (ContainerSale $sale) => $this->getSaleGrossAmountGnf($sale));
                $totalPaid = $payments->sum(fn (ContainerSalePayment $payment) => $this->getPaymentAmountGnf($payment));
                $totalRemaining = $sales->sum(fn (ContainerSale $sale) => $this->getSaleRemainingAmountGnf($sale));
                $availableAdvance = $advances->sum(fn (ClientAdvance $advance) => $this->getAdvanceRemainingAmountGnf($tenantId, $advance));

                return [
                    'client_id' => (int) $client->id,
                    'name' => $client->name,
                    'phone1' => $client->phone1,
                    'email' => $client->email,
                    'client_type' => $client->client_type,
                    'photo_url' => $client->photo_url,
                    'sale_count' => $sales->count(),
                    'open_sales_count' => $sales->whereIn('status', ['EN_COURS', 'PAYE_PARTIEL'])->count(),
                    'total_sales_gnf' => round((float) $totalSales, 2),
                    'total_paid_gnf' => round((float) $totalPaid, 2),
                    'total_remaining_gnf' => round((float) $totalRemaining, 2),
                    'total_advances_gnf' => round((float) $availableAdvance, 2),
                    'net_balance_gnf' => round((float) ($availableAdvance - $totalRemaining), 2),
                    'status' => $totalRemaining > $availableAdvance ? 'DEBITEUR' : ($availableAdvance > $totalRemaining ? 'AVANCE' : 'SOLDE'),
                ];
            })->values();

            $summary = [
                'clients_count' => $rows->count(),
                'debtors_count' => $rows->where('status', 'DEBITEUR')->count(),
                'settled_count' => $rows->where('status', 'SOLDE')->count(),
                'credit_count' => $rows->where('status', 'AVANCE')->count(),
                'total_sales_gnf' => round((float) $rows->sum('total_sales_gnf'), 2),
                'total_paid_gnf' => round((float) $rows->sum('total_paid_gnf'), 2),
                'total_remaining_gnf' => round((float) $rows->sum('total_remaining_gnf'), 2),
                'total_advances_gnf' => round((float) $rows->sum('total_advances_gnf'), 2),
            ];

            return $this->sendResponse([
                'summary' => $summary,
                'clients' => $rows,
            ], 'Client balances retrieved successfully');
        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }

    public function storeGlobalClientPayment(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'client_id' => 'required|exists:clients,id',
                'amount' => 'required|numeric|min:1',
                'currency' => 'required|string|max:10',
                'exchange_rate' => 'nullable|numeric|min:0.0001',
                'payment_method' => 'required|string|max:50',
                'payment_date' => 'required|date',
                'reference' => 'nullable|string|max:100',
                'notes' => 'nullable|string|max:500',
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            $tenantId = $this->tenantId($request);
            $currency = strtoupper((string) $request->input('currency', 'GNF'));
            $exchangeRate = $this->resolveExchangeRateForCurrency($tenantId, $currency, $request->input('exchange_rate'));
            $remainingPaymentGnf = $this->convertToGnf((float) $request->amount, $currency, $exchangeRate);

            DB::beginTransaction();

            $openSales = ContainerSale::where('tenant_id', $tenantId)
                ->where('client_id', $request->client_id)
                ->whereIn('status', ['EN_COURS', 'PAYE_PARTIEL'])
                ->orderByRaw('CASE WHEN due_date IS NULL THEN 1 ELSE 0 END')
                ->orderBy('due_date')
                ->orderBy('sale_date')
                ->orderBy('id')
                ->get();

            $allocations = [];

            foreach ($openSales as $sale) {
                if ($remainingPaymentGnf <= 0) {
                    break;
                }

                $saleRemainingGnf = $this->getSaleRemainingAmountGnf($sale);
                if ($saleRemainingGnf <= 0) {
                    continue;
                }

                $allocatedGnf = min($saleRemainingGnf, $remainingPaymentGnf);
                $paymentAmount = $currency === 'GNF' ? $allocatedGnf : round($allocatedGnf / $exchangeRate, 2);
                $actualAllocatedGnf = $currency === 'GNF' ? $paymentAmount : $this->convertToGnf((float) $paymentAmount, $currency, $exchangeRate);

                $paymentData = [
                    'tenant_id' => $tenantId,
                    'container_sale_id' => $sale->id,
                    'client_id' => $request->client_id,
                    'amount' => $paymentAmount,
                    'currency' => $currency,
                    'payment_method' => $request->payment_method,
                    'payment_date' => $request->payment_date,
                    'reference' => $request->reference,
                    'notes' => trim(collect([
                        'Versement global client',
                        $request->notes,
                    ])->filter()->implode(' | ')),
                    'payment_type' => 'VERSEMENT',
                ];

                if ($this->hasPaymentConversionColumns()) {
                    $paymentData['exchange_rate'] = $exchangeRate;
                    $paymentData['amount_gnf'] = $actualAllocatedGnf;
                }

                $payment = ContainerSalePayment::create($paymentData);
                $sale->refresh();
                $sale->updatePaymentStatus();

                $allocations[] = [
                    'payment_id' => $payment->id,
                    'sale_id' => $sale->id,
                    'allocated_amount' => round((float) $paymentAmount, 2),
                    'allocated_amount_gnf' => round((float) $actualAllocatedGnf, 2),
                    'sale_remaining_after_gnf' => round((float) $this->getSaleRemainingAmountGnf($sale->fresh()), 2),
                ];

                $remainingPaymentGnf = max(0, $remainingPaymentGnf - $actualAllocatedGnf);
            }

            $advance = null;
            if ($remainingPaymentGnf > 0.009) {
                $advanceAmount = $currency === 'GNF' ? $remainingPaymentGnf : round($remainingPaymentGnf / $exchangeRate, 2);
                $advance = ClientAdvance::create([
                    'tenant_id' => $tenantId,
                    'client_id' => $request->client_id,
                    'amount' => $advanceAmount,
                    'currency' => $currency,
                    'payment_method' => $request->payment_method,
                    'payment_date' => $request->payment_date,
                    'reference' => $request->reference,
                    'description' => $request->notes ?: 'Solde créditeur après versement global',
                    'used_amount' => 0,
                    'remaining_amount' => $advanceAmount,
                    'status' => 'DISPONIBLE',
                ]);
            }

            DB::commit();

            return $this->sendResponse([
                'client_id' => (int) $request->client_id,
                'currency' => $currency,
                'exchange_rate' => $exchangeRate,
                'allocated_payments' => $allocations,
                'advance_created' => $advance,
                'unallocated_amount_gnf' => round((float) $remainingPaymentGnf, 2),
            ], 'Global client payment recorded successfully', 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->sendError('Error recording global payment', ['error' => $e->getMessage()], 500);
        }
    }

    // ==================== STATISTIQUES GLOBALES ====================

    public function getGlobalStats(Request $request)
    {
        try {
            $tenantId = $this->tenantId($request);

            // Arrivages
            $totalArrivals = ContainerArrival::where('tenant_id', $tenantId)->count();
            $totalPurchaseValue = ContainerArrival::where('tenant_id', $tenantId)->sum('purchase_price');
            $baleColumn = $this->hasArrivalBaleColumn() ? 'bale_quantity' : 'total_quantity';
            $totalBalesReceived = (float) ContainerArrival::where('tenant_id', $tenantId)->sum($baleColumn);
            $totalBalesRemaining = (float) ContainerArrival::where('tenant_id', $tenantId)->sum('remaining_quantity');
            $totalBalesSold = max(0, $totalBalesReceived - $totalBalesRemaining);
            $containersSoldThisMonth = ContainerSale::query()
                ->where('tenant_id', $tenantId)
                ->whereMonth('sale_date', now()->month)
                ->whereYear('sale_date', now()->year)
                ->distinct('container_arrival_id')
                ->count('container_arrival_id');

            // Ventes
            $salesAggregate = ContainerSale::query()
                ->join('container_arrivals', 'container_sales.container_arrival_id', '=', 'container_arrivals.id')
                ->where('container_sales.tenant_id', $tenantId)
                ->selectRaw('
                    COUNT(container_sales.id) as total_sales_count,
                    COALESCE(SUM(container_sales.quantity_sold), 0) as total_quantity_sold,
                    COALESCE(SUM(container_sales.sale_price), 0) as total_sales_value,
                    COALESCE(AVG(container_sales.sale_price), 0) as average_sale_value,
                    COALESCE(SUM(
                        CASE
                            WHEN container_arrivals.total_quantity > 0
                            THEN (container_sales.quantity_sold * container_arrivals.purchase_price) / container_arrivals.total_quantity
                            ELSE 0
                        END
                    ), 0) as cost_of_goods_sold,
                    COALESCE(SUM(
                        CASE
                            WHEN container_arrivals.total_quantity > 0 AND container_sales.sale_price > 0
                            THEN (container_sales.amount_paid / container_sales.sale_price) * ((container_sales.quantity_sold * container_arrivals.purchase_price) / container_arrivals.total_quantity)
                            ELSE 0
                        END
                    ), 0) as realized_cost_of_goods
                ')
                ->first();

            $totalSalesCount = (int) ($salesAggregate->total_sales_count ?? 0);
            $totalQuantitySold = (float) ($salesAggregate->total_quantity_sold ?? 0);
            $totalSalesValue = (float) ($salesAggregate->total_sales_value ?? 0);
            $averageSaleValue = (float) ($salesAggregate->average_sale_value ?? 0);
            $costOfGoodsSold = (float) ($salesAggregate->cost_of_goods_sold ?? 0);
            $realizedCostOfGoods = (float) ($salesAggregate->realized_cost_of_goods ?? 0);
            $totalCollected = ContainerSalePayment::where('tenant_id', $tenantId)->sum('amount');
            $totalPending = ContainerSale::where('tenant_id', $tenantId)
                ->whereIn('status', ['EN_COURS', 'PAYE_PARTIEL'])
                ->sum('remaining_amount');

            // Avances clients
            $totalAdvances = ClientAdvance::where('tenant_id', $tenantId)
                ->where('status', '!=', 'UTILISE_TOTAL')
                ->sum('remaining_amount');

            // Profit brut réel sur les quantités vendues
            $profit = $totalSalesValue - $costOfGoodsSold;
            $averageUnitSalePrice = $totalQuantitySold > 0 ? ($totalSalesValue / $totalQuantitySold) : 0;
            $realizedInterest = $totalCollected - $realizedCostOfGoods;
            $outstandingInterest = $profit - $realizedInterest;
            $profitMarginRate = $totalSalesValue > 0 ? round(($profit / $totalSalesValue) * 100, 2) : 0;
            $topProfitableArrivals = ContainerSale::query()
                ->join('container_arrivals', 'container_sales.container_arrival_id', '=', 'container_arrivals.id')
                ->join('containers', 'container_arrivals.container_id', '=', 'containers.id')
                ->leftJoin('suppliers', 'container_arrivals.supplier_id', '=', 'suppliers.id')
                ->where('container_sales.tenant_id', $tenantId)
                ->groupBy(
                    'container_sales.container_arrival_id',
                    'containers.container_number',
                    'container_arrivals.arrival_date',
                    'container_arrivals.total_quantity',
                    'suppliers.name'
                )
                ->selectRaw('
                    container_sales.container_arrival_id as arrival_id,
                    containers.container_number,
                    container_arrivals.arrival_date,
                    container_arrivals.total_quantity,
                    suppliers.name as supplier_name,
                    COALESCE(SUM(container_sales.quantity_sold), 0) as quantity_sold,
                    COALESCE(SUM(container_sales.sale_price), 0) as total_sales_value,
                    COALESCE(SUM(container_sales.amount_paid), 0) as total_collected,
                    COALESCE(SUM(
                        CASE
                            WHEN container_arrivals.total_quantity > 0
                            THEN (container_sales.quantity_sold * container_arrivals.purchase_price) / container_arrivals.total_quantity
                            ELSE 0
                        END
                    ), 0) as cost_of_goods_sold
                ')
                ->get()
                ->map(function ($item) {
                    $generatedInterest = (float) $item->total_sales_value - (float) $item->cost_of_goods_sold;

                    return [
                        'arrival_id' => (int) $item->arrival_id,
                        'container_number' => $item->container_number,
                        'arrival_date' => $item->arrival_date,
                        'supplier_name' => $item->supplier_name,
                        'total_quantity' => (float) $item->total_quantity,
                        'quantity_sold' => (float) $item->quantity_sold,
                        'total_sales_value' => (float) $item->total_sales_value,
                        'total_collected' => (float) $item->total_collected,
                        'cost_of_goods_sold' => (float) $item->cost_of_goods_sold,
                        'generated_interest' => $generatedInterest,
                        'margin_rate' => (float) ((float) $item->total_sales_value > 0 ? round(($generatedInterest / (float) $item->total_sales_value) * 100, 2) : 0),
                    ];
                })
                ->sortByDesc('generated_interest')
                ->take(10)
                ->values();

            $containersSoldMonthly = ContainerSale::query()
                ->where('tenant_id', $tenantId)
                ->selectRaw('DATE_FORMAT(sale_date, "%Y-%m") as month_key')
                ->selectRaw('COUNT(DISTINCT container_arrival_id) as containers_sold')
                ->selectRaw('COALESCE(SUM(quantity_sold), 0) as bales_sold')
                ->selectRaw('COALESCE(SUM(sale_price), 0) as sales_value')
                ->groupBy('month_key')
                ->orderBy('month_key')
                ->get()
                ->map(fn ($row) => [
                    'month' => $row->month_key,
                    'containers_sold' => (int) $row->containers_sold,
                    'bales_sold' => (float) $row->bales_sold,
                    'sales_value' => (float) $row->sales_value,
                ])
                ->values();

            return $this->sendResponse([
                'total_arrivals' => $totalArrivals,
                'total_purchase_value' => (float) $totalPurchaseValue,
                'total_bales_received' => $totalBalesReceived,
                'total_bales_sold' => $totalBalesSold,
                'total_bales_remaining' => $totalBalesRemaining,
                'containers_sold_this_month' => $containersSoldThisMonth,
                'total_sales_count' => $totalSalesCount,
                'total_quantity_sold' => $totalQuantitySold,
                'total_sales_value' => $totalSalesValue,
                'total_collected' => (float) $totalCollected,
                'total_pending' => (float) $totalPending,
                'total_client_advances' => (float) $totalAdvances,
                'cost_of_goods_sold' => $costOfGoodsSold,
                'realized_cost_of_goods' => $realizedCostOfGoods,
                'average_sale_value' => $averageSaleValue,
                'average_unit_sale_price' => (float) $averageUnitSalePrice,
                'estimated_profit' => (float) $profit,
                'generated_interest' => (float) $profit,
                'realized_interest' => (float) $realizedInterest,
                'outstanding_interest' => (float) $outstandingInterest,
                'profit_margin_rate' => (float) $profitMarginRate,
                'top_profitable_arrivals' => $topProfitableArrivals,
                'containers_sold_monthly' => $containersSoldMonthly,
            ], 'Global statistics retrieved successfully');
        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }

    private function hasArrivalCategoryColumn(): bool
    {
        return Schema::hasColumn('container_arrivals', 'product_category_id');
    }

    private function hasArrivalBaleColumn(): bool
    {
        return Schema::hasColumn('container_arrivals', 'bale_quantity');
    }

    private function hasArrivalPhotoLinkColumn(): bool
    {
        return Schema::hasColumn('container_photos', 'container_arrival_id');
    }

    private function hasSaleConversionColumns(): bool
    {
        return Schema::hasColumn('container_sales', 'exchange_rate')
            && Schema::hasColumn('container_sales', 'sale_price_gnf')
            && Schema::hasColumn('container_sales', 'amount_paid_gnf')
            && Schema::hasColumn('container_sales', 'remaining_amount_gnf');
    }

    private function hasPaymentConversionColumns(): bool
    {
        return Schema::hasColumn('container_sale_payments', 'exchange_rate')
            && Schema::hasColumn('container_sale_payments', 'amount_gnf');
    }

    private function resolveExchangeRateForCurrency(?int $tenantId, string $currency, $requestedRate = null): float
    {
        if ($currency === 'GNF') {
            return 1.0;
        }

        if ($requestedRate !== null && (float) $requestedRate > 0) {
            return (float) $requestedRate;
        }

        if ($tenantId && Schema::hasColumn('currencies', 'tenant_id') && Schema::hasColumn('currencies', 'exchange_rate')) {
            $currencyQuery = Currency::query()
                ->where('tenant_id', $tenantId)
                ->where('code', strtoupper($currency));

            if (Schema::hasColumn('currencies', 'is_active')) {
                $currencyQuery->where('is_active', true);
            }

            $currencyRow = $currencyQuery->first();

            if ($currencyRow && (float) $currencyRow->exchange_rate > 0) {
                return (float) $currencyRow->exchange_rate;
            }
        }

        $latestRate = ExchangeRate::query()
            ->whereHas('currency', function ($query) use ($currency) {
                $query->where('code', strtoupper($currency));
            })
            ->orderByDesc('rate_date')
            ->orderByDesc('id')
            ->first();

        if ($latestRate && (float) $latestRate->rate > 0) {
            return (float) $latestRate->rate;
        }

        throw new \RuntimeException("Aucun taux de change disponible pour la devise {$currency}.");
    }

    private function convertToGnf(float $amount, string $currency, float $exchangeRate): float
    {
        if ($currency === 'GNF') {
            return round($amount, 2);
        }

        return round($amount * $exchangeRate, 2);
    }

    private function getSaleGrossAmountGnf(ContainerSale $sale): float
    {
        if ($this->hasSaleConversionColumns() && $sale->sale_price_gnf !== null) {
            return (float) $sale->sale_price_gnf;
        }

        return $this->convertToGnf((float) $sale->sale_price, strtoupper((string) ($sale->currency ?? 'GNF')), (float) ($sale->exchange_rate ?: 1));
    }

    private function getSalePaidAmountGnf(ContainerSale $sale): float
    {
        if ($this->hasSaleConversionColumns() && $sale->amount_paid_gnf !== null) {
            return (float) $sale->amount_paid_gnf;
        }

        return $this->convertToGnf((float) $sale->amount_paid, strtoupper((string) ($sale->currency ?? 'GNF')), (float) ($sale->exchange_rate ?: 1));
    }

    private function getSaleRemainingAmountGnf(ContainerSale $sale): float
    {
        if ($this->hasSaleConversionColumns() && $sale->remaining_amount_gnf !== null) {
            return (float) $sale->remaining_amount_gnf;
        }

        return $this->convertToGnf((float) $sale->remaining_amount, strtoupper((string) ($sale->currency ?? 'GNF')), (float) ($sale->exchange_rate ?: 1));
    }

    private function getPaymentAmountGnf(ContainerSalePayment $payment): float
    {
        if ($this->hasPaymentConversionColumns() && $payment->amount_gnf !== null) {
            return (float) $payment->amount_gnf;
        }

        return $this->convertToGnf((float) $payment->amount, strtoupper((string) ($payment->currency ?? 'GNF')), (float) ($payment->exchange_rate ?: 1));
    }

    private function getAdvanceRemainingAmountGnf(?int $tenantId, ClientAdvance $advance): float
    {
        $currency = strtoupper((string) ($advance->currency ?? 'GNF'));
        $exchangeRate = 1.0;

        if ($currency !== 'GNF') {
            try {
                $exchangeRate = $this->resolveExchangeRateForCurrency($tenantId, $currency, null);
            } catch (\Throwable $exception) {
                $exchangeRate = 1.0;
            }
        }

        return $this->convertToGnf((float) $advance->remaining_amount, $currency, $exchangeRate);
    }

    private function applyAvailableAdvancesToSale(ContainerSale $sale, ?int $tenantId, ?string $paymentDate = null): void
    {
        $saleRemainingGnf = $this->getSaleRemainingAmountGnf($sale);
        if ($saleRemainingGnf <= 0) {
            return;
        }

        $advances = ClientAdvance::query()
            ->where('tenant_id', $tenantId)
            ->where('client_id', $sale->client_id)
            ->where('remaining_amount', '>', 0)
            ->whereIn('status', ['DISPONIBLE', 'UTILISE_PARTIEL'])
            ->orderBy('payment_date')
            ->orderBy('id')
            ->get();

        foreach ($advances as $advance) {
            if ($saleRemainingGnf <= 0) {
                break;
            }

            $advanceRemainingGnf = $this->getAdvanceRemainingAmountGnf($tenantId, $advance);
            if ($advanceRemainingGnf <= 0) {
                continue;
            }

            $advanceCurrency = strtoupper((string) ($advance->currency ?? 'GNF'));
            $advanceRate = $advanceCurrency === 'GNF'
                ? 1.0
                : $this->resolveExchangeRateForCurrency($tenantId, $advanceCurrency, null);

            $allocatedGnf = min($saleRemainingGnf, $advanceRemainingGnf);
            $allocatedAmount = $advanceCurrency === 'GNF'
                ? round($allocatedGnf, 2)
                : round($allocatedGnf / $advanceRate, 2);
            $actualAllocatedGnf = $advanceCurrency === 'GNF'
                ? $allocatedAmount
                : $this->convertToGnf((float) $allocatedAmount, $advanceCurrency, $advanceRate);

            $paymentData = [
                'tenant_id' => $tenantId,
                'container_sale_id' => $sale->id,
                'client_id' => $sale->client_id,
                'amount' => $allocatedAmount,
                'currency' => $advanceCurrency,
                'payment_method' => $advance->payment_method ?? 'ESPECES',
                'payment_date' => $paymentDate ?: now()->toDateString(),
                'reference' => $advance->reference,
                'notes' => trim("Imputation automatique d'avance #{$advance->id}"),
                'payment_type' => 'AVANCE',
            ];

            if ($this->hasPaymentConversionColumns()) {
                $paymentData['exchange_rate'] = $advanceRate;
                $paymentData['amount_gnf'] = round((float) $actualAllocatedGnf, 2);
            }

            ContainerSalePayment::create($paymentData);
            $advance->useAmount($allocatedAmount);
            $sale->refresh();
            $saleRemainingGnf = $this->getSaleRemainingAmountGnf($sale);
        }
    }

    private function arrivalRelations(): array
    {
        $relations = ['container', 'supplier'];
        if ($this->hasArrivalCategoryColumn()) {
            $relations[] = 'productCategory';
        }
        if ($this->hasArrivalPhotoLinkColumn()) {
            $relations[] = 'photos';
        }

        return $relations;
    }
}
