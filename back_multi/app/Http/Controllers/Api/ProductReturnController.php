<?php

namespace App\Http\Controllers\Api;

use App\Models\Invoice;
use App\Models\ClientAdvance;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductReturn;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ProductReturnController extends BaseController
{
    private function tenantId(Request $request): ?int
    {
        $user = Auth::user();
        return $user->hasRole('SUPER_ADMIN') ? ($request->get('tenant_id') ?? $user->tenant_id) : $user->tenant_id;
    }

    public function index(Request $request)
    {
        $tenantId = $this->tenantId($request);

        $query = ProductReturn::with(['product:id,name,sku', 'client:id,name', 'invoice:id,invoice_number', 'clientAdvance:id,amount,remaining_amount,status', 'refundPayment:id,reference,amount,amount_gnf,status'])
            ->when($tenantId, fn ($query) => $query->where('tenant_id', $tenantId))
            ->orderBy('return_date', 'desc')
            ->orderBy('id', 'desc');

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->product_id);
        }

        if ($request->filled('client_id')) {
            $query->where('client_id', $request->client_id);
        }

        if ($request->filled('invoice_id')) {
            $query->where('invoice_id', $request->invoice_id);
        }

        return $this->sendResponse(
            $query->paginate($request->get('per_page', 15)),
            'Product returns retrieved successfully'
        );
    }

    public function store(Request $request)
    {
        $tenantId = $this->tenantId($request);

        $validator = Validator::make($request->all(), [
            'product_id'            => 'required|exists:products,id',
            'client_id'             => 'nullable|exists:clients,id',
            'invoice_id'            => 'nullable|exists:invoices,id',
            'quantity'              => 'required|numeric|min:0.01',
            'unit_price'            => 'nullable|numeric|min:0',
            'currency'              => 'nullable|string|max:10',
            'exchange_rate'         => 'nullable|numeric|min:0.0001',
            'return_date'           => 'required|date',
            'product_received'      => 'boolean',
            'reintegrate_to_stock'  => 'boolean',
            'account_impact'        => 'nullable|in:CREDIT_NOTE,REFUND,NONE',
            'notes'                 => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $productQuery = Product::query();
        if ($tenantId) {
            $productQuery->where('tenant_id', $tenantId);
        }
        $product = $productQuery->find($request->product_id);
        if (!$product) {
            return $this->sendError('Produit introuvable pour cette organisation.', [], 404);
        }
        $tenantId = $tenantId ?: (int) $product->tenant_id;

        $invoice = $request->invoice_id
            ? Invoice::where('tenant_id', $tenantId)->find($request->invoice_id)
            : null;
        if ($request->invoice_id && !$invoice) {
            return $this->sendError('Facture introuvable pour cette organisation.', [], 404);
        }

        DB::beginTransaction();

        try {
            $quantity = (float) $request->quantity;
            $unitPrice = (float) ($request->unit_price ?? ($product->selling_price ?? 0));
            $totalAmount = round($quantity * $unitPrice, 2);
            $currency = strtoupper((string) ($request->get('currency') ?: 'GNF'));
            $exchangeRate = $currency === 'GNF' ? 1.0 : (float) ($request->get('exchange_rate') ?: 1);
            $totalAmountGnf = $currency === 'GNF' ? $totalAmount : round($totalAmount * $exchangeRate, 2);
            $productReceived = $request->boolean('product_received', true);
            $reintegrate = $productReceived && $request->boolean('reintegrate_to_stock', true);
            $impact = $request->get('account_impact', 'CREDIT_NOTE');
            $appliedToInvoice = 0;
            $clientCredit = 0;
            $refundAmount = 0;
            $clientAdvance = null;
            $refundPayment = null;

            if ($reintegrate) {
                $product->stock_quantity = (float) ($product->stock_quantity ?? 0) + $quantity;
                $product->save();
            }

            if ($invoice) {
                $appliedToInvoice = min($totalAmount, (float) $invoice->total_amount);
                $invoice->total_amount = max(0, (float) $invoice->total_amount - $appliedToInvoice);
                $invoice->total_amount_gnf = max(0, (float) ($invoice->total_amount_gnf ?? $invoice->total_amount) - $appliedToInvoice);
                $invoice->items_subtotal_amount = max(0, (float) ($invoice->items_subtotal_amount ?? $invoice->total_amount) - $appliedToInvoice);

                if ((float) $invoice->paid_amount <= 0) {
                    $invoice->status = 'IMPAYE';
                } elseif ((float) $invoice->paid_amount >= (float) $invoice->total_amount) {
                    $invoice->status = 'PAYE';
                } else {
                    $invoice->status = 'PARTIEL';
                }

                $invoice->save();
            } elseif ($impact === 'CREDIT_NOTE' && $request->client_id) {
                $clientCredit = $totalAmount;
                $clientAdvance = ClientAdvance::create([
                    'tenant_id' => $tenantId,
                    'client_id' => $request->client_id,
                    'amount' => $totalAmount,
                    'currency' => $currency,
                    'payment_method' => 'AVOIR_RETOUR',
                    'payment_date' => $request->return_date,
                    'reference' => null,
                    'description' => trim('Avoir retour produit gardé pour prochaine commande' . ($product->name ? ' - ' . $product->name : '')),
                    'used_amount' => 0,
                    'remaining_amount' => $totalAmount,
                    'status' => 'DISPONIBLE',
                ]);
            } elseif ($impact === 'REFUND' && $request->client_id) {
                $refundAmount = $totalAmount;
                $refundPayment = Payment::create([
                    'tenant_id' => $tenantId,
                    'client_id' => $request->client_id,
                    'invoice_id' => null,
                    'receipt_number' => null,
                    'type' => 'RETRAIT',
                    'method' => 'ESPECES',
                    'amount' => $totalAmount,
                    'currency' => $currency,
                    'exchange_rate' => $exchangeRate,
                    'amount_gnf' => $totalAmountGnf,
                    'proof' => null,
                    'reference' => null,
                    'description' => trim('Restitution client suite retour produit' . ($product->name ? ' - ' . $product->name : '')),
                    'status' => 'COMPLETED',
                    'payment_date' => $request->return_date,
                ]);
            }

            $return = ProductReturn::create([
                'tenant_id'                  => $tenantId,
                'product_id'                 => $product->id,
                'client_id'                  => $request->client_id,
                'invoice_id'                 => $request->invoice_id,
                'quantity'                   => $quantity,
                'unit_price'                 => $unitPrice,
                'total_amount'               => $totalAmount,
                'currency'                   => $currency,
                'exchange_rate'              => $exchangeRate,
                'total_amount_gnf'           => $totalAmountGnf,
                'applied_to_invoice_amount'  => $appliedToInvoice,
                'client_credit_amount'       => $clientCredit,
                'refund_amount'              => $refundAmount,
                'client_advance_id'          => $clientAdvance?->id,
                'refund_payment_id'          => $refundPayment?->id,
                'return_date'                => $request->return_date,
                'product_received'           => $productReceived,
                'reintegrate_to_stock'       => $reintegrate,
                'account_impact'             => $impact,
                'status'                     => 'APPROVED',
                'notes'                      => $request->notes,
            ]);

            if ($refundPayment) {
                $refundPayment->reference = 'RET-PROD-' . $return->id;
                $refundPayment->save();
            }

            DB::commit();

            return $this->sendResponse(
                $return->load(['product:id,name,sku', 'client:id,name', 'invoice:id,invoice_number']),
                'Product return recorded successfully',
                201
            );
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('ProductReturnController@store: ' . $e->getMessage());
            return $this->sendError('Error recording return', ['error' => $e->getMessage()], 500);
        }
    }
}
