<?php

namespace App\Http\Controllers\Api;

use App\Models\DailyPayment;
use App\Models\TaxiAssignment;
use App\Models\Driver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class DailyPaymentController extends BaseController
{
    private function tenantId(Request $request): int
    {
        return auth()->user()?->tenant_id ?? (int) $request->get('tenant_id', 1);
    }

    public function index(Request $request)
    {
        $tenantId = $this->tenantId($request);
        $query = DailyPayment::with('driver', 'taxi', 'taxiAssignment')
            ->where('tenant_id', $tenantId);

        if ($request->filled('driver_id')) {
            $query->where('driver_id', $request->driver_id);
        }
        if ($request->filled('taxi_id')) {
            $query->where('taxi_id', $request->taxi_id);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('date_from')) {
            $query->where('payment_date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->where('payment_date', '<=', $request->date_to);
        }

        $payments = $query->orderBy('payment_date', 'desc')->paginate(15);
        return $this->sendResponse($payments, 'Daily payments retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'taxi_assignment_id' => 'required|exists:taxi_assignments,id',
            'payment_date'       => 'required|date',
            'expected_amount'    => 'required|numeric|min:0',
            'paid_amount'        => 'required|numeric|min:0',
            'status'             => 'nullable|in:PAID,PARTIAL,UNPAID,EXCUSED',
            'notes'              => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $tenantId  = $this->tenantId($request);
        $assignment = TaxiAssignment::with('driver', 'taxi')->find($request->taxi_assignment_id);
        if (!$assignment) {
            return $this->sendError('Assignment not found', [], 404);
        }

        $existing = DailyPayment::where('taxi_assignment_id', $request->taxi_assignment_id)
            ->where('payment_date', $request->payment_date)
            ->first();

        if ($existing) {
            return $this->sendError('Un versement existe déjà pour cette date et cette affectation', [], 422);
        }

        $paid     = (float) $request->paid_amount;
        $expected = (float) $request->expected_amount;
        $balance  = max(0, $expected - $paid);

        // Auto-detect status if not provided
        $status = $request->status;
        if (!$status) {
            if ($paid >= $expected)       $status = 'PAID';
            elseif ($paid > 0)            $status = 'PARTIAL';
            else                          $status = 'UNPAID';
        }

        $payment = DailyPayment::create([
            'tenant_id'          => $tenantId,
            'taxi_assignment_id' => $request->taxi_assignment_id,
            'driver_id'          => $assignment->driver_id,
            'taxi_id'            => $assignment->taxi_id,
            'payment_date'       => $request->payment_date,
            'expected_amount'    => $expected,
            'paid_amount'        => $paid,
            'balance'            => $balance,
            'status'             => $status,
            'notes'              => $request->notes,
        ]);

        return $this->sendResponse(
            $payment->load('driver', 'taxi', 'taxiAssignment'),
            'Daily payment created successfully',
            201
        );
    }

    public function show(Request $request, $id)
    {
        $tenantId = $this->tenantId($request);
        $payment  = DailyPayment::with('driver', 'taxi', 'taxiAssignment')
            ->where('tenant_id', $tenantId)->find($id);

        if (!$payment) {
            return $this->sendError('Daily payment not found', [], 404);
        }

        return $this->sendResponse($payment, 'Daily payment retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $tenantId = $this->tenantId($request);
        $payment  = DailyPayment::where('tenant_id', $tenantId)->find($id);

        if (!$payment) {
            return $this->sendError('Daily payment not found', [], 404);
        }

        $validator = Validator::make($request->all(), [
            'expected_amount' => 'sometimes|numeric|min:0',
            'paid_amount'     => 'sometimes|numeric|min:0',
            'status'          => 'nullable|in:PAID,PARTIAL,UNPAID,EXCUSED',
            'notes'           => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $data = $request->only(['expected_amount', 'paid_amount', 'status', 'notes', 'payment_date']);

        // Recalculate balance and auto-status
        $paid     = isset($data['paid_amount'])     ? (float)$data['paid_amount']     : $payment->paid_amount;
        $expected = isset($data['expected_amount']) ? (float)$data['expected_amount'] : $payment->expected_amount;
        $data['balance'] = max(0, $expected - $paid);

        if (empty($data['status'])) {
            if ($paid >= $expected)  $data['status'] = 'PAID';
            elseif ($paid > 0)       $data['status'] = 'PARTIAL';
            else                     $data['status'] = 'UNPAID';
        }

        $payment->update($data);

        return $this->sendResponse(
            $payment->load('driver', 'taxi', 'taxiAssignment'),
            'Daily payment updated successfully'
        );
    }

    public function destroy(Request $request, $id)
    {
        $tenantId = $this->tenantId($request);
        $payment  = DailyPayment::where('tenant_id', $tenantId)->find($id);

        if (!$payment) {
            return $this->sendError('Daily payment not found', [], 404);
        }

        $payment->delete();
        return $this->sendResponse([], 'Daily payment deleted successfully');
    }

    public function statistics(Request $request)
    {
        $tenantId = $this->tenantId($request);
        $dateFrom = $request->get('date_from', now()->startOfMonth()->format('Y-m-d'));
        $dateTo   = $request->get('date_to',   now()->format('Y-m-d'));

        $baseQuery = DB::table('daily_payments')
            ->where('tenant_id', $tenantId)
            ->whereBetween('payment_date', [$dateFrom, $dateTo]);

        // Optional driver/taxi filter for stats too
        if ($request->filled('driver_id')) {
            $baseQuery->where('driver_id', $request->driver_id);
        }
        if ($request->filled('taxi_id')) {
            $baseQuery->where('taxi_id', $request->taxi_id);
        }

        $stats = (clone $baseQuery)->selectRaw('
            COUNT(*) as total_payments,
            SUM(expected_amount) as total_expected,
            SUM(paid_amount) as total_paid,
            SUM(balance) as total_balance,
            SUM(CASE WHEN status = "PAID" THEN 1 ELSE 0 END) as paid_count,
            SUM(CASE WHEN status = "PARTIAL" THEN 1 ELSE 0 END) as partial_count,
            SUM(CASE WHEN status = "UNPAID" THEN 1 ELSE 0 END) as unpaid_count,
            SUM(CASE WHEN status = "EXCUSED" THEN 1 ELSE 0 END) as excused_count
        ')->first();

        // Collection rate
        $collectionRate = ($stats->total_expected > 0)
            ? round(($stats->total_paid / $stats->total_expected) * 100, 1)
            : 0;

        // Top drivers
        $topDrivers = DB::table('daily_payments')
            ->join('drivers', 'daily_payments.driver_id', '=', 'drivers.id')
            ->where('daily_payments.tenant_id', $tenantId)
            ->whereBetween('payment_date', [$dateFrom, $dateTo])
            ->when($request->filled('taxi_id'), fn($q) => $q->where('daily_payments.taxi_id', $request->taxi_id))
            ->groupBy('drivers.id', 'drivers.name')
            ->selectRaw('drivers.id, drivers.name, SUM(paid_amount) as total_paid, SUM(expected_amount) as total_expected, COUNT(*) as payment_count')
            ->orderByDesc('total_paid')
            ->limit(10)
            ->get();

        // Daily breakdown (last 30 days in range)
        $dailyBreakdown = DB::table('daily_payments')
            ->where('tenant_id', $tenantId)
            ->whereBetween('payment_date', [$dateFrom, $dateTo])
            ->when($request->filled('driver_id'), fn($q) => $q->where('driver_id', $request->driver_id))
            ->when($request->filled('taxi_id'),   fn($q) => $q->where('taxi_id',   $request->taxi_id))
            ->groupBy('payment_date')
            ->selectRaw('payment_date, SUM(expected_amount) as expected, SUM(paid_amount) as paid, COUNT(*) as count')
            ->orderBy('payment_date', 'desc')
            ->limit(30)
            ->get();

        return $this->sendResponse([
            'summary'         => array_merge((array) $stats, ['collection_rate' => $collectionRate]),
            'top_drivers'     => $topDrivers,
            'daily_breakdown' => $dailyBreakdown,
            'period'          => ['from' => $dateFrom, 'to' => $dateTo]
        ], 'Statistics retrieved successfully');
    }

    public function driverHistory(Request $request, $driverId)
    {
        $driver = Driver::find($driverId);
        if (!$driver) {
            return $this->sendError('Driver not found', [], 404);
        }

        $tenantId = $this->tenantId($request);
        $dateFrom = $request->get('date_from', now()->subMonths(3)->format('Y-m-d'));
        $dateTo   = $request->get('date_to', now()->format('Y-m-d'));

        $payments = DailyPayment::with('taxi', 'taxiAssignment')
            ->where('tenant_id', $tenantId)
            ->where('driver_id', $driverId)
            ->whereBetween('payment_date', [$dateFrom, $dateTo])
            ->orderBy('payment_date', 'desc')
            ->get();

        $summary = [
            'total_expected' => $payments->sum('expected_amount'),
            'total_paid'     => $payments->sum('paid_amount'),
            'total_balance'  => $payments->sum('balance'),
            'payment_count'  => $payments->count(),
            'paid_count'     => $payments->where('status', 'PAID')->count(),
            'partial_count'  => $payments->where('status', 'PARTIAL')->count(),
            'unpaid_count'   => $payments->where('status', 'UNPAID')->count(),
            'collection_rate'=> $payments->sum('expected_amount') > 0
                ? round(($payments->sum('paid_amount') / $payments->sum('expected_amount')) * 100, 1)
                : 0,
        ];

        return $this->sendResponse([
            'driver'   => $driver,
            'payments' => $payments,
            'summary'  => $summary,
            'period'   => ['from' => $dateFrom, 'to' => $dateTo]
        ], 'Driver payment history retrieved successfully');
    }

    public function bulkCreate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'payment_date'                          => 'required|date',
            'payments'                              => 'required|array|min:1',
            'payments.*.taxi_assignment_id'         => 'required|exists:taxi_assignments,id',
            'payments.*.expected_amount'            => 'required|numeric|min:0',
            'payments.*.paid_amount'                => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $tenantId = $this->tenantId($request);
        $created  = [];
        $errors   = [];

        DB::beginTransaction();
        try {
            foreach ($request->payments as $index => $paymentData) {
                $assignment = TaxiAssignment::find($paymentData['taxi_assignment_id']);
                if (!$assignment) {
                    $errors[] = "Affectation #{$index} non trouvée";
                    continue;
                }

                $existing = DailyPayment::where('taxi_assignment_id', $paymentData['taxi_assignment_id'])
                    ->where('payment_date', $request->payment_date)
                    ->first();

                if ($existing) {
                    $errors[] = "Versement déjà existant pour l'affectation #{$index}";
                    continue;
                }

                $paid     = (float) $paymentData['paid_amount'];
                $expected = (float) $paymentData['expected_amount'];

                $created[] = DailyPayment::create([
                    'tenant_id'          => $tenantId,
                    'taxi_assignment_id' => $paymentData['taxi_assignment_id'],
                    'driver_id'          => $assignment->driver_id,
                    'taxi_id'            => $assignment->taxi_id,
                    'payment_date'       => $request->payment_date,
                    'expected_amount'    => $expected,
                    'paid_amount'        => $paid,
                    'balance'            => max(0, $expected - $paid),
                    'status'             => $paymentData['status'] ?? ($paid >= $expected ? 'PAID' : ($paid > 0 ? 'PARTIAL' : 'UNPAID')),
                    'notes'              => $paymentData['notes'] ?? null,
                ]);
            }

            DB::commit();
            return $this->sendResponse([
                'created' => $created, 'errors' => $errors,
                'created_count' => count($created), 'error_count' => count($errors)
            ], 'Bulk creation completed', 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->sendError('Error during bulk creation', ['message' => $e->getMessage()], 500);
        }
    }
}
