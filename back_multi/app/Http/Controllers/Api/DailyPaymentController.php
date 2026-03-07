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
    public function index(Request $request)
    {
        $query = DailyPayment::with('tenant', 'driver', 'taxi', 'taxiAssignment');

        if ($request->has('tenant_id')) {
            $query->where('tenant_id', $request->tenant_id);
        }

        if ($request->has('driver_id')) {
            $query->where('driver_id', $request->driver_id);
        }

        if ($request->has('taxi_id')) {
            $query->where('taxi_id', $request->taxi_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('date_from')) {
            $query->where('payment_date', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->where('payment_date', '<=', $request->date_to);
        }

        $payments = $query->orderBy('payment_date', 'desc')->paginate(15);
        return $this->sendResponse($payments, 'Daily payments retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tenant_id' => 'required|exists:tenants,id',
            'taxi_assignment_id' => 'required|exists:taxi_assignments,id',
            'payment_date' => 'required|date',
            'expected_amount' => 'required|numeric|min:0',
            'paid_amount' => 'required|numeric|min:0',
            'status' => 'nullable|in:PAID,PARTIAL,UNPAID,EXCUSED',
            'notes' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        // Get assignment details
        $assignment = TaxiAssignment::with('driver', 'taxi')->find($request->taxi_assignment_id);
        if (!$assignment) {
            return $this->sendError('Assignment not found', [], 404);
        }

        // Check if payment already exists for this date and assignment
        $existing = DailyPayment::where('taxi_assignment_id', $request->taxi_assignment_id)
            ->where('payment_date', $request->payment_date)
            ->first();

        if ($existing) {
            return $this->sendError('Un versement existe déjà pour cette date et cette affectation', [], 422);
        }

        $payment = DailyPayment::create([
            'tenant_id' => $request->tenant_id,
            'taxi_assignment_id' => $request->taxi_assignment_id,
            'driver_id' => $assignment->driver_id,
            'taxi_id' => $assignment->taxi_id,
            'payment_date' => $request->payment_date,
            'expected_amount' => $request->expected_amount,
            'paid_amount' => $request->paid_amount,
            'notes' => $request->notes,
        ]);

        return $this->sendResponse(
            $payment->load('driver', 'taxi', 'taxiAssignment'),
            'Daily payment created successfully',
            201
        );
    }

    public function show($id)
    {
        $payment = DailyPayment::with('tenant', 'driver', 'taxi', 'taxiAssignment')->find($id);

        if (!$payment) {
            return $this->sendError('Daily payment not found');
        }

        return $this->sendResponse($payment, 'Daily payment retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $payment = DailyPayment::find($id);

        if (!$payment) {
            return $this->sendError('Daily payment not found');
        }

        $validator = Validator::make($request->all(), [
            'expected_amount' => 'sometimes|numeric|min:0',
            'paid_amount' => 'sometimes|numeric|min:0',
            'status' => 'nullable|in:PAID,PARTIAL,UNPAID,EXCUSED',
            'notes' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $payment->update($request->only(['expected_amount', 'paid_amount', 'status', 'notes']));

        return $this->sendResponse(
            $payment->load('driver', 'taxi', 'taxiAssignment'),
            'Daily payment updated successfully'
        );
    }

    public function destroy($id)
    {
        $payment = DailyPayment::find($id);

        if (!$payment) {
            return $this->sendError('Daily payment not found');
        }

        $payment->delete();

        return $this->sendResponse([], 'Daily payment deleted successfully');
    }

    public function statistics(Request $request)
    {
        $tenantId = $request->get('tenant_id', 1);
        $dateFrom = $request->get('date_from', now()->startOfMonth()->format('Y-m-d'));
        $dateTo = $request->get('date_to', now()->format('Y-m-d'));

        $stats = DB::table('daily_payments')
            ->where('tenant_id', $tenantId)
            ->whereBetween('payment_date', [$dateFrom, $dateTo])
            ->selectRaw('
                COUNT(*) as total_payments,
                SUM(expected_amount) as total_expected,
                SUM(paid_amount) as total_paid,
                SUM(balance) as total_balance,
                SUM(CASE WHEN status = "PAID" THEN 1 ELSE 0 END) as paid_count,
                SUM(CASE WHEN status = "PARTIAL" THEN 1 ELSE 0 END) as partial_count,
                SUM(CASE WHEN status = "UNPAID" THEN 1 ELSE 0 END) as unpaid_count,
                SUM(CASE WHEN status = "EXCUSED" THEN 1 ELSE 0 END) as excused_count
            ')
            ->first();

        // Top drivers by payments
        $topDrivers = DB::table('daily_payments')
            ->join('drivers', 'daily_payments.driver_id', '=', 'drivers.id')
            ->where('daily_payments.tenant_id', $tenantId)
            ->whereBetween('payment_date', [$dateFrom, $dateTo])
            ->groupBy('drivers.id', 'drivers.name')
            ->selectRaw('
                drivers.id,
                drivers.name,
                SUM(paid_amount) as total_paid,
                COUNT(*) as payment_count,
                AVG(paid_amount) as avg_payment
            ')
            ->orderByDesc('total_paid')
            ->limit(10)
            ->get();

        // Daily breakdown
        $dailyBreakdown = DB::table('daily_payments')
            ->where('tenant_id', $tenantId)
            ->whereBetween('payment_date', [$dateFrom, $dateTo])
            ->groupBy('payment_date')
            ->selectRaw('
                payment_date,
                SUM(expected_amount) as expected,
                SUM(paid_amount) as paid,
                COUNT(*) as count
            ')
            ->orderBy('payment_date', 'desc')
            ->limit(30)
            ->get();

        return $this->sendResponse([
            'summary' => $stats,
            'top_drivers' => $topDrivers,
            'daily_breakdown' => $dailyBreakdown,
            'period' => ['from' => $dateFrom, 'to' => $dateTo]
        ], 'Statistics retrieved successfully');
    }

    public function driverHistory(Request $request, $driverId)
    {
        $driver = Driver::find($driverId);
        if (!$driver) {
            return $this->sendError('Driver not found', [], 404);
        }

        $dateFrom = $request->get('date_from', now()->subMonths(3)->format('Y-m-d'));
        $dateTo = $request->get('date_to', now()->format('Y-m-d'));

        $payments = DailyPayment::with('taxi', 'taxiAssignment')
            ->where('driver_id', $driverId)
            ->whereBetween('payment_date', [$dateFrom, $dateTo])
            ->orderBy('payment_date', 'desc')
            ->get();

        $summary = [
            'total_expected' => $payments->sum('expected_amount'),
            'total_paid' => $payments->sum('paid_amount'),
            'total_balance' => $payments->sum('balance'),
            'payment_count' => $payments->count(),
            'paid_count' => $payments->where('status', 'PAID')->count(),
            'partial_count' => $payments->where('status', 'PARTIAL')->count(),
            'unpaid_count' => $payments->where('status', 'UNPAID')->count(),
        ];

        return $this->sendResponse([
            'driver' => $driver,
            'payments' => $payments,
            'summary' => $summary,
            'period' => ['from' => $dateFrom, 'to' => $dateTo]
        ], 'Driver payment history retrieved successfully');
    }

    public function bulkCreate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tenant_id' => 'required|exists:tenants,id',
            'payment_date' => 'required|date',
            'payments' => 'required|array|min:1',
            'payments.*.taxi_assignment_id' => 'required|exists:taxi_assignments,id',
            'payments.*.expected_amount' => 'required|numeric|min:0',
            'payments.*.paid_amount' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $created = [];
        $errors = [];

        DB::beginTransaction();
        try {
            foreach ($request->payments as $index => $paymentData) {
                $assignment = TaxiAssignment::find($paymentData['taxi_assignment_id']);
                if (!$assignment) {
                    $errors[] = "Affectation #{$index} non trouvée";
                    continue;
                }

                // Check if already exists
                $existing = DailyPayment::where('taxi_assignment_id', $paymentData['taxi_assignment_id'])
                    ->where('payment_date', $request->payment_date)
                    ->first();

                if ($existing) {
                    $errors[] = "Versement déjà existant pour l'affectation #{$index}";
                    continue;
                }

                $payment = DailyPayment::create([
                    'tenant_id' => $request->tenant_id,
                    'taxi_assignment_id' => $paymentData['taxi_assignment_id'],
                    'driver_id' => $assignment->driver_id,
                    'taxi_id' => $assignment->taxi_id,
                    'payment_date' => $request->payment_date,
                    'expected_amount' => $paymentData['expected_amount'],
                    'paid_amount' => $paymentData['paid_amount'],
                    'notes' => $paymentData['notes'] ?? null,
                ]);

                $created[] = $payment;
            }

            DB::commit();

            return $this->sendResponse([
                'created' => $created,
                'errors' => $errors,
                'created_count' => count($created),
                'error_count' => count($errors)
            ], 'Bulk creation completed', 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->sendError('Error during bulk creation', ['message' => $e->getMessage()], 500);
        }
    }
}
