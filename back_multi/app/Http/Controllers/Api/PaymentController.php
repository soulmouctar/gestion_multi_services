<?php

namespace App\Http\Controllers\Api;

use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class PaymentController extends BaseController
{
    public function index(Request $request)
    {
        try {
            $user = Auth::user();
            $tenantId = $user->tenant_id ?? $request->get('tenant_id');
            
            if (!$tenantId && !$user->hasRole('SUPER_ADMIN')) {
                return $this->sendError('Tenant ID required', [], 400);
            }

            $query = Payment::with('tenant');
            
            // Filter by tenant for non-super-admin users
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }

            // Search functionality
            if ($request->has('search')) {
                $search = $request->get('search');
                $query->where(function($q) use ($search) {
                    $q->where('proof', 'like', "%{$search}%")
                      ->orWhere('amount', 'like', "%{$search}%")
                      ->orWhere('currency', 'like', "%{$search}%");
                });
            }

            // Filter by type
            if ($request->has('type')) {
                $query->where('type', $request->get('type'));
            }

            // Filter by method
            if ($request->has('method')) {
                $query->where('method', $request->get('method'));
            }

            // Filter by currency
            if ($request->has('currency')) {
                $query->where('currency', $request->get('currency'));
            }

            // Filter by date range
            if ($request->has('date_from')) {
                $query->whereDate('payment_date', '>=', $request->get('date_from'));
            }
            if ($request->has('date_to')) {
                $query->whereDate('payment_date', '<=', $request->get('date_to'));
            }

            // Filter by amount range
            if ($request->has('amount_min')) {
                $query->where('amount', '>=', $request->get('amount_min'));
            }
            if ($request->has('amount_max')) {
                $query->where('amount', '<=', $request->get('amount_max'));
            }

            // Sort options
            $sortBy = $request->get('sort_by', 'payment_date');
            $sortOrder = $request->get('sort_order', 'desc');
            $query->orderBy($sortBy, $sortOrder);

            $perPage = $request->get('per_page', 15);
            $payments = $query->paginate($perPage);
            
            return $this->sendResponse($payments, 'Payments retrieved successfully');
            
        } catch (\Exception $e) {
            \Log::error('Error retrieving payments: ' . $e->getMessage());
            return $this->sendError('Error retrieving payments', [], 500);
        }
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tenant_id' => 'required|exists:tenants,id',
            'type' => 'required|in:CLIENT,SUPPLIER,DEPOT,RETRAIT',
            'method' => 'required|in:ORANGE_MONEY,VIREMENT,CHEQUE,ESPECES',
            'amount' => 'required|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'proof' => 'nullable|string|max:255',
            'payment_date' => 'required|date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $payment = Payment::create($request->all());

        return $this->sendResponse($payment, 'Payment created successfully', 201);
    }

    public function show($id)
    {
        $payment = Payment::with('tenant')->find($id);

        if (!$payment) {
            return $this->sendError('Payment not found');
        }

        return $this->sendResponse($payment, 'Payment retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $payment = Payment::find($id);

        if (!$payment) {
            return $this->sendError('Payment not found');
        }

        $validator = Validator::make($request->all(), [
            'tenant_id' => 'sometimes|exists:tenants,id',
            'type' => 'sometimes|in:CLIENT,SUPPLIER,DEPOT,RETRAIT',
            'method' => 'sometimes|in:ORANGE_MONEY,VIREMENT,CHEQUE,ESPECES',
            'amount' => 'sometimes|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'proof' => 'nullable|string|max:255',
            'payment_date' => 'sometimes|date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $payment->update($request->all());

        return $this->sendResponse($payment, 'Payment updated successfully');
    }

    public function destroy($id)
    {
        $payment = Payment::find($id);

        if (!$payment) {
            return $this->sendError('Payment not found');
        }

        $payment->delete();

        return $this->sendResponse([], 'Payment deleted successfully');
    }

    /**
     * Get payment statistics
     */
    public function getStatistics(Request $request)
    {
        try {
            $user = Auth::user();
            $tenantId = $user->tenant_id ?? $request->get('tenant_id');
            
            if (!$tenantId && !$user->hasRole('SUPER_ADMIN')) {
                return $this->sendError('Tenant ID required', [], 400);
            }

            $query = Payment::query();
            
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }

            // Apply date filter if provided
            if ($request->has('date_from')) {
                $query->whereDate('payment_date', '>=', $request->get('date_from'));
            }
            if ($request->has('date_to')) {
                $query->whereDate('payment_date', '<=', $request->get('date_to'));
            }

            $stats = [
                'total_payments' => $query->count(),
                'total_amount' => $query->sum('amount'),
                'by_type' => [
                    'CLIENT' => $query->where('type', 'CLIENT')->sum('amount'),
                    'SUPPLIER' => $query->where('type', 'SUPPLIER')->sum('amount'),
                    'DEPOT' => $query->where('type', 'DEPOT')->sum('amount'),
                    'RETRAIT' => $query->where('type', 'RETRAIT')->sum('amount')
                ],
                'by_method' => [
                    'ORANGE_MONEY' => $query->where('method', 'ORANGE_MONEY')->sum('amount'),
                    'VIREMENT' => $query->where('method', 'VIREMENT')->sum('amount'),
                    'CHEQUE' => $query->where('method', 'CHEQUE')->sum('amount'),
                    'ESPECES' => $query->where('method', 'ESPECES')->sum('amount')
                ],
                'monthly_trend' => $this->getMonthlyTrend($tenantId, $request),
                'average_payment' => $query->avg('amount') ?? 0
            ];

            return $this->sendResponse($stats, 'Payment statistics retrieved successfully');
            
        } catch (\Exception $e) {
            \Log::error('Error retrieving payment statistics: ' . $e->getMessage());
            return $this->sendError('Error retrieving statistics', [], 500);
        }
    }

    /**
     * Get payments by date range
     */
    public function getByDateRange(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'date_from' => 'required|date',
                'date_to' => 'required|date|after_or_equal:date_from'
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            $user = Auth::user();
            $tenantId = $user->tenant_id ?? $request->get('tenant_id');
            
            $query = Payment::with('tenant')
                ->whereBetween('payment_date', [$request->date_from, $request->date_to]);
            
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }

            $payments = $query->orderBy('payment_date', 'desc')->get();
            
            return $this->sendResponse($payments, 'Payments retrieved successfully');
            
        } catch (\Exception $e) {
            \Log::error('Error retrieving payments by date range: ' . $e->getMessage());
            return $this->sendError('Error retrieving payments', [], 500);
        }
    }

    /**
     * Bulk operations
     */
    public function bulkDelete(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'payment_ids' => 'required|array',
                'payment_ids.*' => 'exists:payments,id'
            ]);

            if ($validator->fails()) {
                return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
            }

            $user = Auth::user();
            $tenantId = $user->tenant_id;
            
            $query = Payment::whereIn('id', $request->payment_ids);
            
            // Ensure user can only delete their tenant's payments
            if ($tenantId && !$user->hasRole('SUPER_ADMIN')) {
                $query->where('tenant_id', $tenantId);
            }

            $deletedCount = $query->delete();
            
            return $this->sendResponse(['deleted_count' => $deletedCount], 'Payments deleted successfully');
            
        } catch (\Exception $e) {
            \Log::error('Error bulk deleting payments: ' . $e->getMessage());
            return $this->sendError('Error deleting payments', [], 500);
        }
    }

    /**
     * Export payments
     */
    public function export(Request $request)
    {
        try {
            $user = Auth::user();
            $tenantId = $user->tenant_id ?? $request->get('tenant_id');
            
            $query = Payment::with('tenant');
            
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }

            // Apply filters
            if ($request->has('type')) {
                $query->where('type', $request->get('type'));
            }
            if ($request->has('method')) {
                $query->where('method', $request->get('method'));
            }
            if ($request->has('date_from')) {
                $query->whereDate('payment_date', '>=', $request->get('date_from'));
            }
            if ($request->has('date_to')) {
                $query->whereDate('payment_date', '<=', $request->get('date_to'));
            }

            $payments = $query->orderBy('payment_date', 'desc')->get();
            
            // For now, return JSON data. In a real implementation, you'd generate CSV/Excel
            return $this->sendResponse($payments, 'Payments exported successfully');
            
        } catch (\Exception $e) {
            \Log::error('Error exporting payments: ' . $e->getMessage());
            return $this->sendError('Error exporting payments', [], 500);
        }
    }

    /**
     * Get monthly trend data
     */
    private function getMonthlyTrend($tenantId, $request)
    {
        $months = [];
        $startDate = $request->get('date_from', Carbon::now()->subMonths(11)->startOfMonth());
        $endDate = $request->get('date_to', Carbon::now()->endOfMonth());
        
        $query = Payment::selectRaw('
            YEAR(payment_date) as year,
            MONTH(payment_date) as month,
            SUM(amount) as total_amount,
            COUNT(*) as total_count
        ')
        ->whereBetween('payment_date', [$startDate, $endDate])
        ->groupBy('year', 'month')
        ->orderBy('year')
        ->orderBy('month');
        
        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }
        
        return $query->get()->map(function($item) {
            return [
                'period' => $item->year . '-' . str_pad($item->month, 2, '0', STR_PAD_LEFT),
                'amount' => $item->total_amount,
                'count' => $item->total_count
            ];
        });
    }

    // ==================== PUBLIC METHODS ====================

    public function publicIndex(Request $request)
    {
        try {
            $tenantId = $request->get('tenant_id', 1);
            
            $query = Payment::where('tenant_id', $tenantId);

            if ($request->has('type')) {
                $query->where('type', $request->get('type'));
            }
            if ($request->has('method')) {
                $query->where('method', $request->get('method'));
            }
            if ($request->has('date_from')) {
                $query->whereDate('payment_date', '>=', $request->get('date_from'));
            }
            if ($request->has('date_to')) {
                $query->whereDate('payment_date', '<=', $request->get('date_to'));
            }

            $query->orderBy('payment_date', 'desc');
            $perPage = $request->get('per_page', 15);
            $payments = $query->paginate($perPage);
            
            return $this->sendResponse($payments, 'Payments retrieved successfully');
        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }

    public function publicStore(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'type' => 'required|in:CLIENT,SUPPLIER,DEPOT,RETRAIT',
            'method' => 'required|in:ORANGE_MONEY,VIREMENT,CHEQUE,ESPECES',
            'amount' => 'required|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'proof' => 'nullable|string|max:255',
            'payment_date' => 'required|date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $data = $request->all();
        $data['tenant_id'] = $request->get('tenant_id', 1);

        $payment = Payment::create($data);

        return $this->sendResponse($payment, 'Payment created successfully', 201);
    }

    public function publicStatistics(Request $request)
    {
        try {
            $tenantId = $request->get('tenant_id', 1);

            $query = Payment::where('tenant_id', $tenantId);

            // Total by type
            $totalByType = Payment::where('tenant_id', $tenantId)
                ->selectRaw('type, SUM(amount) as total, COUNT(*) as count')
                ->groupBy('type')
                ->get()
                ->keyBy('type');

            // Total by method
            $totalByMethod = Payment::where('tenant_id', $tenantId)
                ->selectRaw('method, SUM(amount) as total, COUNT(*) as count')
                ->groupBy('method')
                ->get()
                ->keyBy('method');

            // Monthly trend (last 6 months)
            $monthlyTrend = Payment::where('tenant_id', $tenantId)
                ->selectRaw('YEAR(payment_date) as year, MONTH(payment_date) as month, SUM(amount) as total, COUNT(*) as count')
                ->where('payment_date', '>=', Carbon::now()->subMonths(6)->startOfMonth())
                ->groupBy('year', 'month')
                ->orderBy('year')
                ->orderBy('month')
                ->get()
                ->map(function($item) {
                    return [
                        'period' => $item->year . '-' . str_pad($item->month, 2, '0', STR_PAD_LEFT),
                        'amount' => $item->total,
                        'count' => $item->count
                    ];
                });

            $stats = [
                'total_payments' => $query->count(),
                'total_amount' => $query->sum('amount'),
                'by_type' => $totalByType,
                'by_method' => $totalByMethod,
                'monthly_trend' => $monthlyTrend,
                'average_payment' => $query->avg('amount') ?? 0
            ];

            return $this->sendResponse($stats, 'Payment statistics retrieved successfully');
        } catch (\Exception $e) {
            \Log::error('Error retrieving payment statistics: ' . $e->getMessage());
            return $this->sendError('Error retrieving statistics', [], 500);
        }
    }

    public function publicUpdate(Request $request, $id)
    {
        $tenantId = $request->get('tenant_id', 1);
        $payment = Payment::where('tenant_id', $tenantId)->find($id);

        if (!$payment) {
            return $this->sendError('Payment not found', [], 404);
        }

        $validator = Validator::make($request->all(), [
            'type' => 'sometimes|in:CLIENT,SUPPLIER,DEPOT,RETRAIT',
            'method' => 'sometimes|in:ORANGE_MONEY,VIREMENT,CHEQUE,ESPECES',
            'amount' => 'sometimes|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'proof' => 'nullable|string|max:255',
            'payment_date' => 'sometimes|date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $payment->update($request->all());

        return $this->sendResponse($payment, 'Payment updated successfully');
    }

    public function publicDestroy($id)
    {
        $tenantId = 1;
        $payment = Payment::where('tenant_id', $tenantId)->find($id);

        if (!$payment) {
            return $this->sendError('Payment not found', [], 404);
        }

        $payment->delete();

        return $this->sendResponse([], 'Payment deleted successfully');
    }
}
