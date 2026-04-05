<?php

namespace App\Http\Controllers\Api;

use App\Models\VehicleExpense;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class VehicleExpenseController extends BaseController
{
    public function index(Request $request)
    {
        $user     = auth()->user();
        $tenantId = $user->hasRole('SUPER_ADMIN') ? $request->get('tenant_id') : $user->tenant_id;

        $query = VehicleExpense::with('taxi', 'driver');

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        if ($request->has('taxi_id')) {
            $query->where('taxi_id', $request->taxi_id);
        }

        if ($request->has('driver_id')) {
            $query->where('driver_id', $request->driver_id);
        }

        if ($request->has('expense_type')) {
            $query->where('expense_type', $request->expense_type);
        }

        if ($request->has('date_from')) {
            $query->where('expense_date', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->where('expense_date', '<=', $request->date_to);
        }

        $expenses = $query->orderBy('expense_date', 'desc')->paginate(15);
        return $this->sendResponse($expenses, 'Vehicle expenses retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'taxi_id'        => 'required|exists:taxis,id',
            'driver_id'      => 'nullable|exists:drivers,id',
            'expense_date'   => 'required|date',
            'expense_type'   => 'required|in:CARBURANT,ENTRETIEN,REPARATION,ASSURANCE,VISITE_TECHNIQUE,AMENDE,LAVAGE,AUTRE',
            'amount'         => 'required|numeric|min:0',
            'description'    => 'nullable|string|max:255',
            'receipt_number' => 'nullable|string|max:50',
            'notes'          => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $expense = VehicleExpense::create([
            ...$request->only(['taxi_id', 'driver_id', 'expense_date', 'expense_type', 'amount', 'description', 'receipt_number', 'notes']),
            'tenant_id' => auth()->user()->tenant_id,
        ]);

        return $this->sendResponse(
            $expense->load('taxi', 'driver'),
            'Vehicle expense created successfully',
            201
        );
    }

    public function show($id)
    {
        $expense = VehicleExpense::with('tenant', 'taxi', 'driver')->find($id);

        if (!$expense) {
            return $this->sendError('Vehicle expense not found');
        }

        return $this->sendResponse($expense, 'Vehicle expense retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $expense = VehicleExpense::find($id);

        if (!$expense) {
            return $this->sendError('Vehicle expense not found');
        }

        $validator = Validator::make($request->all(), [
            'taxi_id' => 'sometimes|exists:taxis,id',
            'driver_id' => 'nullable|exists:drivers,id',
            'expense_date' => 'sometimes|date',
            'expense_type' => 'sometimes|in:CARBURANT,ENTRETIEN,REPARATION,ASSURANCE,VISITE_TECHNIQUE,AMENDE,LAVAGE,AUTRE',
            'amount' => 'sometimes|numeric|min:0',
            'description' => 'nullable|string|max:255',
            'receipt_number' => 'nullable|string|max:50',
            'notes' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $expense->update($request->all());

        return $this->sendResponse(
            $expense->load('taxi', 'driver'),
            'Vehicle expense updated successfully'
        );
    }

    public function destroy($id)
    {
        $expense = VehicleExpense::find($id);

        if (!$expense) {
            return $this->sendError('Vehicle expense not found');
        }

        $expense->delete();

        return $this->sendResponse([], 'Vehicle expense deleted successfully');
    }

    public function statistics(Request $request)
    {
        $user     = auth()->user();
        $tenantId = $user->hasRole('SUPER_ADMIN')
            ? $request->get('tenant_id', $user->tenant_id)
            : $user->tenant_id;

        $dateFrom = $request->get('date_from');
        $dateTo   = $request->get('date_to');

        // Applique les filtres optionnels
        $applyDates = function ($q) use ($dateFrom, $dateTo) {
            if ($dateFrom) $q->where('expense_date', '>=', $dateFrom);
            if ($dateTo)   $q->where('expense_date', '<=', $dateTo);
            return $q;
        };

        // Summary global
        $summaryRaw = $applyDates(
            DB::table('vehicle_expenses')->where('tenant_id', $tenantId)
        )->selectRaw('COALESCE(SUM(amount),0) as total_expenses, COUNT(*) as expense_count, COALESCE(AVG(amount),0) as avg_expense')
         ->first();

        $summary = [
            'total_expenses' => (float) ($summaryRaw->total_expenses ?? 0),
            'expense_count'  => (int)   ($summaryRaw->expense_count  ?? 0),
            'avg_expense'    => (float) ($summaryRaw->avg_expense    ?? 0),
        ];

        // Par type de dépense
        $byType = $applyDates(
            DB::table('vehicle_expenses')->where('tenant_id', $tenantId)
        )->groupBy('expense_type')
         ->selectRaw('expense_type, COALESCE(SUM(amount),0) as total, COUNT(*) as count')
         ->get();

        // Par taxi
        $byTaxi = $applyDates(
            DB::table('vehicle_expenses')
                ->join('taxis', 'vehicle_expenses.taxi_id', '=', 'taxis.id')
                ->where('vehicle_expenses.tenant_id', $tenantId)
        )->groupBy('taxis.id', 'taxis.plate_number')
         ->selectRaw('taxis.id, taxis.plate_number, COALESCE(SUM(vehicle_expenses.amount),0) as total, COUNT(*) as count')
         ->orderByDesc('total')
         ->limit(10)
         ->get();

        return $this->sendResponse([
            'summary' => $summary,
            'by_type' => $byType,
            'by_taxi' => $byTaxi,
            'period'  => ['from' => $dateFrom, 'to' => $dateTo],
        ], 'Statistics retrieved successfully');
    }

    public function expenseTypes()
    {
        return $this->sendResponse(VehicleExpense::EXPENSE_TYPES, 'Expense types retrieved successfully');
    }
}
