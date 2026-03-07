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
        $query = VehicleExpense::with('tenant', 'taxi', 'driver');

        if ($request->has('tenant_id')) {
            $query->where('tenant_id', $request->tenant_id);
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
            'tenant_id' => 'required|exists:tenants,id',
            'taxi_id' => 'required|exists:taxis,id',
            'driver_id' => 'nullable|exists:drivers,id',
            'expense_date' => 'required|date',
            'expense_type' => 'required|in:CARBURANT,ENTRETIEN,REPARATION,ASSURANCE,VISITE_TECHNIQUE,AMENDE,LAVAGE,AUTRE',
            'amount' => 'required|numeric|min:0',
            'description' => 'nullable|string|max:255',
            'receipt_number' => 'nullable|string|max:50',
            'notes' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $expense = VehicleExpense::create($request->all());

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
        $tenantId = $request->get('tenant_id', 1);
        $dateFrom = $request->get('date_from', now()->startOfMonth()->format('Y-m-d'));
        $dateTo = $request->get('date_to', now()->format('Y-m-d'));

        // Total by expense type
        $byType = DB::table('vehicle_expenses')
            ->where('tenant_id', $tenantId)
            ->whereBetween('expense_date', [$dateFrom, $dateTo])
            ->groupBy('expense_type')
            ->selectRaw('expense_type, SUM(amount) as total, COUNT(*) as count')
            ->get();

        // Total by taxi
        $byTaxi = DB::table('vehicle_expenses')
            ->join('taxis', 'vehicle_expenses.taxi_id', '=', 'taxis.id')
            ->where('vehicle_expenses.tenant_id', $tenantId)
            ->whereBetween('expense_date', [$dateFrom, $dateTo])
            ->groupBy('taxis.id', 'taxis.plate_number')
            ->selectRaw('taxis.id, taxis.plate_number, SUM(amount) as total, COUNT(*) as count')
            ->orderByDesc('total')
            ->limit(10)
            ->get();

        // Monthly breakdown
        $monthlyBreakdown = DB::table('vehicle_expenses')
            ->where('tenant_id', $tenantId)
            ->whereBetween('expense_date', [$dateFrom, $dateTo])
            ->selectRaw('DATE_FORMAT(expense_date, "%Y-%m") as month, SUM(amount) as total, COUNT(*) as count')
            ->groupBy('month')
            ->orderBy('month', 'desc')
            ->get();

        // Summary
        $summary = DB::table('vehicle_expenses')
            ->where('tenant_id', $tenantId)
            ->whereBetween('expense_date', [$dateFrom, $dateTo])
            ->selectRaw('SUM(amount) as total_expenses, COUNT(*) as expense_count, AVG(amount) as avg_expense')
            ->first();

        return $this->sendResponse([
            'summary' => $summary,
            'by_type' => $byType,
            'by_taxi' => $byTaxi,
            'monthly_breakdown' => $monthlyBreakdown,
            'period' => ['from' => $dateFrom, 'to' => $dateTo]
        ], 'Statistics retrieved successfully');
    }

    public function expenseTypes()
    {
        return $this->sendResponse(VehicleExpense::EXPENSE_TYPES, 'Expense types retrieved successfully');
    }
}
