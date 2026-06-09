<?php

namespace App\Http\Controllers\Api;

use App\Models\Lease;
use App\Models\LeasePayment;
use App\Models\HousingUnit;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class LeaseController extends BaseController
{
    private function tenantId(Request $request): ?int
    {
        $user = auth()->user();
        return $user->hasRole('SUPER_ADMIN') ? $request->get('tenant_id') : $user->tenant_id;
    }

    // ==================== CONTRATS ====================

    public function index(Request $request)
    {
        try {
            $tenantId = $this->tenantId($request);
            $query = Lease::with(['housingUnit.floor.building.location'])
                ->where('tenant_id', $tenantId);

            if ($request->has('status')) {
                $query->where('status', $request->get('status'));
            }
            if ($request->has('housing_unit_id')) {
                $query->where('housing_unit_id', $request->get('housing_unit_id'));
            }
            if ($request->has('search')) {
                $q = $request->get('search');
                $query->where(function ($sub) use ($q) {
                    $sub->where('renter_name', 'like', "%{$q}%")
                        ->orWhere('renter_phone', 'like', "%{$q}%")
                        ->orWhere('renter_email', 'like', "%{$q}%");
                });
            }

            $query->orderBy('created_at', 'desc');
            $leases = $query->paginate($request->get('per_page', 15));

            return $this->sendResponse($leases, 'Leases retrieved successfully');
        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'housing_unit_id' => 'required|exists:housing_units,id',
            'renter_name'     => 'required|string|max:150',
            'renter_phone'    => 'nullable|string|max:50',
            'renter_email'    => 'nullable|email|max:150',
            'renter_photo'    => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
            'start_date'      => 'required|date',
            'end_date'        => 'nullable|date|after:start_date',
            'monthly_rent'    => 'required|numeric|min:0',
            'deposit_amount'  => 'nullable|numeric|min:0',
            'currency'        => 'required|string|max:10',
            'payment_day'     => 'nullable|integer|min:1|max:28',
            'status'          => 'nullable|in:PENDING,ACTIVE,EXPIRED,TERMINATED',
            'notes'           => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        DB::beginTransaction();
        try {
            $data = $request->all();
            $data['tenant_id']      = $this->tenantId($request);
            $data['deposit_amount'] = $data['deposit_amount'] ?? 0;
            $data['payment_day']    = $data['payment_day'] ?? 1;
            $data['status']         = $data['status'] ?? 'ACTIVE';

            if ($request->hasFile('renter_photo')) {
                $data['renter_photo'] = $this->uploadFile($request->file('renter_photo'), 'leases');
            }

            $lease = Lease::create($data);

            // Mark the housing unit as occupied
            HousingUnit::where('id', $data['housing_unit_id'])
                ->update(['status' => 'OCCUPE']);

            DB::commit();

            return $this->sendResponse(
                $lease->load(['housingUnit.floor.building.location']),
                'Lease created successfully',
                201
            );
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->sendError('Error creating lease', ['error' => $e->getMessage()], 500);
        }
    }

    public function show(Request $request, $id)
    {
        $tenantId = $this->tenantId($request);
        $lease = Lease::with(['housingUnit.floor.building.location', 'payments'])
            ->where('tenant_id', $tenantId)
            ->find($id);

        if (!$lease) {
            return $this->sendError('Lease not found', [], 404);
        }

        return $this->sendResponse($lease, 'Lease retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $tenantId = $this->tenantId($request);
        $lease = Lease::where('tenant_id', $tenantId)->find($id);

        if (!$lease) {
            return $this->sendError('Lease not found', [], 404);
        }

        $validator = Validator::make($request->all(), [
            'renter_name'   => 'sometimes|string|max:150',
            'renter_phone'  => 'nullable|string|max:50',
            'renter_email'  => 'nullable|email|max:150',
            'renter_photo'  => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
            'start_date'    => 'sometimes|date',
            'end_date'      => 'nullable|date',
            'monthly_rent'  => 'sometimes|numeric|min:0',
            'deposit_amount'=> 'nullable|numeric|min:0',
            'currency'      => 'sometimes|string|max:10',
            'payment_day'   => 'nullable|integer|min:1|max:28',
            'status'        => 'sometimes|in:PENDING,ACTIVE,EXPIRED,TERMINATED',
            'notes'         => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        DB::beginTransaction();
        try {
            $data = $request->only([
                'renter_name', 'renter_phone', 'renter_email',
                'start_date', 'end_date', 'monthly_rent',
                'deposit_amount', 'currency', 'payment_day', 'status', 'notes',
            ]);

            if ($request->hasFile('renter_photo')) {
                $this->deleteFile($lease->renter_photo);
                $data['renter_photo'] = $this->uploadFile($request->file('renter_photo'), 'leases');
            }

            $lease->update($data);

            // If terminated/expired, free the housing unit
            if (in_array($lease->status, ['TERMINATED', 'EXPIRED'])) {
                $activeLeases = Lease::where('housing_unit_id', $lease->housing_unit_id)
                    ->where('id', '!=', $lease->id)
                    ->whereIn('status', ['ACTIVE', 'PENDING'])
                    ->count();

                if ($activeLeases === 0) {
                    HousingUnit::where('id', $lease->housing_unit_id)
                        ->update(['status' => 'LIBRE']);
                }
            }

            DB::commit();

            return $this->sendResponse(
                $lease->load(['housingUnit.floor.building.location']),
                'Lease updated successfully'
            );
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->sendError('Error updating lease', ['error' => $e->getMessage()], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $tenantId = $this->tenantId($request);
        $lease = Lease::where('tenant_id', $tenantId)->find($id);

        if (!$lease) {
            return $this->sendError('Lease not found', [], 404);
        }

        DB::beginTransaction();
        try {
            $unitId = $lease->housing_unit_id;
            $this->deleteFile($lease->renter_photo);
            $lease->delete();

            // Free the housing unit if no other active lease
            $activeLeases = Lease::where('housing_unit_id', $unitId)
                ->whereIn('status', ['ACTIVE', 'PENDING'])
                ->count();

            if ($activeLeases === 0) {
                HousingUnit::where('id', $unitId)->update(['status' => 'LIBRE']);
            }

            DB::commit();
            return $this->sendResponse([], 'Lease deleted successfully');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->sendError('Error deleting lease', ['error' => $e->getMessage()], 500);
        }
    }

    // ==================== PAIEMENTS LOYER ====================

    public function getPayments(Request $request, $leaseId)
    {
        $tenantId = $this->tenantId($request);
        $lease = Lease::where('tenant_id', $tenantId)->find($leaseId);

        if (!$lease) {
            return $this->sendError('Lease not found', [], 404);
        }

        $payments = LeasePayment::where('lease_id', $leaseId)
            ->where('tenant_id', $tenantId)
            ->orderBy('period_month', 'desc')
            ->paginate($request->get('per_page', 24));

        return $this->sendResponse($payments, 'Payments retrieved successfully');
    }

    public function addPayment(Request $request, $leaseId)
    {
        $tenantId = $this->tenantId($request);
        $lease = Lease::where('tenant_id', $tenantId)->find($leaseId);

        if (!$lease) {
            return $this->sendError('Lease not found', [], 404);
        }

        $validator = Validator::make($request->all(), [
            'period_month'   => 'required|string|size:7', // YYYY-MM
            'amount'         => 'required|numeric|min:0',
            'currency'       => 'required|string|max:10',
            'payment_date'   => 'required|date',
            'payment_method' => 'required|string|max:50',
            'reference'      => 'nullable|string|max:100',
            'status'         => 'nullable|in:PAID,LATE,PENDING',
            'notes'          => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $data = $request->all();
        $data['tenant_id'] = $tenantId;
        $data['lease_id']  = $leaseId;
        $data['status']    = $data['status'] ?? 'PAID';
        $data['receipt_number'] = $this->generateReceiptNumber($tenantId);

        $payment = LeasePayment::create($data);

        return $this->sendResponse(
            $payment->load('lease'),
            'Payment recorded successfully',
            201
        );
    }

    public function deletePayment(Request $request, $paymentId)
    {
        $tenantId = $this->tenantId($request);
        $payment = LeasePayment::where('tenant_id', $tenantId)->find($paymentId);

        if (!$payment) {
            return $this->sendError('Payment not found', [], 404);
        }

        $payment->delete();
        return $this->sendResponse([], 'Payment deleted successfully');
    }

    public function getPaymentReceipt(Request $request, $paymentId)
    {
        $tenantId = $this->tenantId($request);
        $payment = LeasePayment::with(['lease.housingUnit.floor.building.location'])
            ->where('tenant_id', $tenantId)
            ->find($paymentId);

        if (!$payment) {
            return $this->sendError('Payment not found', [], 404);
        }

        $lease = $payment->lease;
        $receipt = [
            'id' => $payment->id,
            'receipt_number' => $payment->receipt_number ?: $this->generateReceiptNumber($tenantId),
            'generated_at' => now()->toDateTimeString(),
            'payment_date' => optional($payment->payment_date)->format('Y-m-d'),
            'period_month' => $payment->period_month,
            'amount' => (float) $payment->amount,
            'currency' => $payment->currency,
            'payment_method' => $payment->payment_method,
            'reference' => $payment->reference,
            'status' => $payment->status,
            'notes' => $payment->notes,
            'tenant' => [
                'name' => optional(auth()->user()->tenant)->name,
            ],
            'lease' => [
                'id' => $lease?->id,
                'renter_name' => $lease?->renter_name,
                'renter_phone' => $lease?->renter_phone,
                'renter_email' => $lease?->renter_email,
                'renter_photo_url' => $lease?->renter_photo_url,
                'monthly_rent' => (float) ($lease?->monthly_rent ?? 0),
                'currency' => $lease?->currency,
                'housing_unit_label' => $this->buildLeaseUnitLabel($lease),
                'location_name' => $lease?->housingUnit?->floor?->building?->location?->name,
                'building_name' => $lease?->housingUnit?->floor?->building?->name,
            ],
        ];

        return $this->sendResponse($receipt, 'Lease payment receipt generated successfully');
    }

    public function getFinancialSituation(Request $request, $leaseId)
    {
        $tenantId = $this->tenantId($request);
        $lease = Lease::with(['housingUnit.floor.building.location'])
            ->where('tenant_id', $tenantId)
            ->find($leaseId);

        if (!$lease) {
            return $this->sendError('Lease not found', [], 404);
        }

        $payments = LeasePayment::where('tenant_id', $tenantId)
            ->where('lease_id', $leaseId)
            ->orderByDesc('payment_date')
            ->orderByDesc('id')
            ->get();

        $paidStatuses = ['PAID', 'LATE'];
        $paidTotal = (float) $payments->whereIn('status', $paidStatuses)->sum('amount');
        $dueMonths = $this->buildDueMonths($lease);
        $expectedTotal = count($dueMonths) * (float) $lease->monthly_rent;
        $remainingTotal = max(0, $expectedTotal - $paidTotal);
        $advanceTotal = max(0, $paidTotal - $expectedTotal);
        $paidPeriods = $payments->whereIn('status', $paidStatuses)->pluck('period_month')->filter()->unique()->values();
        $unpaidPeriods = collect($dueMonths)->reject(fn($month) => $paidPeriods->contains($month))->values();

        return $this->sendResponse([
            'lease' => [
                'id' => $lease->id,
                'renter_name' => $lease->renter_name,
                'renter_phone' => $lease->renter_phone,
                'renter_email' => $lease->renter_email,
                'renter_photo_url' => $lease->renter_photo_url,
                'monthly_rent' => (float) $lease->monthly_rent,
                'deposit_amount' => (float) $lease->deposit_amount,
                'currency' => $lease->currency,
                'status' => $lease->status,
                'start_date' => optional($lease->start_date)->format('Y-m-d'),
                'end_date' => optional($lease->end_date)->format('Y-m-d'),
                'housing_unit_label' => $this->buildLeaseUnitLabel($lease),
            ],
            'summary' => [
                'due_months_count' => count($dueMonths),
                'paid_months_count' => $paidPeriods->count(),
                'payment_count' => $payments->count(),
                'expected_total' => (float) $expectedTotal,
                'paid_total' => (float) $paidTotal,
                'advance_total' => (float) $advanceTotal,
                'remaining_total' => (float) $remainingTotal,
                'deposit_amount' => (float) $lease->deposit_amount,
            ],
            'paid_periods' => $paidPeriods,
            'unpaid_periods' => $unpaidPeriods,
            'payments' => $payments,
        ], 'Lease financial situation retrieved successfully');
    }

    // ==================== STATISTIQUES ====================

    public function statistics(Request $request)
    {
        try {
            $tenantId = $this->tenantId($request);

            $totalLeases  = Lease::where('tenant_id', $tenantId)->count();
            $activeLeases = Lease::where('tenant_id', $tenantId)->where('status', 'ACTIVE')->count();
            $totalMonthlyRent = Lease::where('tenant_id', $tenantId)
                ->where('status', 'ACTIVE')
                ->sum('monthly_rent');

            // Payments this month
            $currentMonth = now()->format('Y-m');
            $collectedThisMonth = LeasePayment::where('tenant_id', $tenantId)
                ->where('period_month', $currentMonth)
                ->where('status', 'PAID')
                ->sum('amount');

            // Expected this month (active leases)
            $expectedThisMonth = $totalMonthlyRent;

            // Pending (active leases that don't have a payment for current month)
            $paidLeaseIds = LeasePayment::where('tenant_id', $tenantId)
                ->where('period_month', $currentMonth)
                ->where('status', 'PAID')
                ->pluck('lease_id');

            $pendingLeases = Lease::where('tenant_id', $tenantId)
                ->where('status', 'ACTIVE')
                ->whereNotIn('id', $paidLeaseIds)
                ->count();

            $totalDeposits = Lease::where('tenant_id', $tenantId)
                ->where('status', 'ACTIVE')
                ->sum('deposit_amount');

            return $this->sendResponse([
                'total_leases'        => $totalLeases,
                'active_leases'       => $activeLeases,
                'monthly_rent_total'  => (float) $totalMonthlyRent,
                'collected_this_month'=> (float) $collectedThisMonth,
                'expected_this_month' => (float) $expectedThisMonth,
                'pending_leases'      => $pendingLeases,
                'total_deposits'      => (float) $totalDeposits,
            ], 'Statistics retrieved successfully');
        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }

    // ==================== ALL PAYMENTS (for overview) ====================

    public function allPayments(Request $request)
    {
        try {
            $tenantId = $this->tenantId($request);
            $query = LeasePayment::with(['lease'])
                ->where('tenant_id', $tenantId);

            if ($request->has('period_month')) {
                $query->where('period_month', $request->get('period_month'));
            }
            if ($request->has('lease_id')) {
                $query->where('lease_id', $request->get('lease_id'));
            }
            if ($request->has('status')) {
                $query->where('status', $request->get('status'));
            }

            $payments = $query->orderBy('payment_date', 'desc')
                ->paginate($request->get('per_page', 15));

            return $this->sendResponse($payments, 'Payments retrieved successfully');
        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage()], 500);
        }
    }

    private function uploadFile($file, string $subfolder): string
    {
        $dir = public_path('uploads/' . $subfolder);
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $filename = uniqid() . '.' . $file->getClientOriginalExtension();
        $file->move($dir, $filename);
        return 'uploads/' . $subfolder . '/' . $filename;
    }

    private function deleteFile(?string $path): void
    {
        if ($path) {
            $full = public_path($path);
            if (file_exists($full)) {
                unlink($full);
            }
        }
    }

    private function generateReceiptNumber(?int $tenantId): string
    {
        $prefix = 'LOY';
        $datePart = now()->format('ymd');
        $lastId = LeasePayment::where('tenant_id', $tenantId)->max('id') ?? 0;

        return sprintf('%s-%s-%04d', $prefix, $datePart, $lastId + 1);
    }

    private function buildDueMonths(Lease $lease): array
    {
        $start = Carbon::parse($lease->start_date)->startOfMonth();
        $endReference = $lease->end_date
            ? Carbon::parse($lease->end_date)->startOfMonth()
            : now()->startOfMonth();
        $end = $endReference->lessThan(now()->startOfMonth()) ? $endReference : now()->startOfMonth();

        $months = [];
        $cursor = $start->copy();
        while ($cursor->lessThanOrEqualTo($end) && count($months) < 240) {
            $months[] = $cursor->format('Y-m');
            $cursor->addMonth();
        }

        return $months;
    }

    private function buildLeaseUnitLabel(?Lease $lease): ?string
    {
        if (!$lease?->housingUnit) {
            return null;
        }

        $unit = $lease->housingUnit;
        $floor = $unit->floor;
        $building = $floor?->building;

        return trim(sprintf(
            '%s - Étage %s - Unité #%s',
            $building?->name ?? 'Bâtiment',
            $floor?->floor_number ?? '—',
            $unit->id
        ));
    }
}
