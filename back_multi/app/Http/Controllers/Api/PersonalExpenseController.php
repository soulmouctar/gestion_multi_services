<?php

namespace App\Http\Controllers\Api;

use App\Models\PersonalExpense;
use App\Models\PersonalExpenseCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class PersonalExpenseController extends BaseController
{
    private function tenantId(Request $request): int
    {
        return auth()->user()?->tenant_id ?? (int) $request->get('tenant_id', 1);
    }

    // ==================== CATÉGORIES ====================

    public function indexCategories(Request $request)
    {
        $tenantId   = $this->tenantId($request);
        $categories = PersonalExpenseCategory::where('tenant_id', $tenantId)
            ->withCount('expenses')
            ->orderBy('name')
            ->get();

        return $this->sendResponse($categories, 'Categories retrieved');
    }

    public function storeCategory(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name'        => 'required|string|max:100',
            'color'       => 'nullable|string|max:20',
            'icon'        => 'nullable|string|max:50',
            'description' => 'nullable|string|max:500',
        ]);
        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $category = PersonalExpenseCategory::create([
            'tenant_id'   => $this->tenantId($request),
            'name'        => $request->name,
            'color'       => $request->color ?? '#6c757d',
            'icon'        => $request->icon,
            'description' => $request->description,
            'is_active'   => true,
        ]);

        return $this->sendResponse($category, 'Category created', 201);
    }

    public function updateCategory(Request $request, $id)
    {
        $tenantId = $this->tenantId($request);
        $category = PersonalExpenseCategory::where('tenant_id', $tenantId)->find($id);
        if (!$category) return $this->sendError('Category not found', [], 404);

        $validator = Validator::make($request->all(), [
            'name'        => 'sometimes|string|max:100',
            'color'       => 'nullable|string|max:20',
            'icon'        => 'nullable|string|max:50',
            'description' => 'nullable|string|max:500',
            'is_active'   => 'nullable|boolean',
        ]);
        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $category->update($request->only(['name', 'color', 'icon', 'description', 'is_active']));
        return $this->sendResponse($category, 'Category updated');
    }

    public function destroyCategory(Request $request, $id)
    {
        $tenantId = $this->tenantId($request);
        $category = PersonalExpenseCategory::where('tenant_id', $tenantId)->find($id);
        if (!$category) return $this->sendError('Category not found', [], 404);

        // Move expenses to uncategorized
        PersonalExpense::where('category_id', $id)->update(['category_id' => null]);
        $category->delete();

        return $this->sendResponse([], 'Category deleted');
    }

    // ==================== DÉPENSES ====================

    public function index(Request $request)
    {
        $tenantId = $this->tenantId($request);
        $query    = PersonalExpense::with('category')
            ->where('tenant_id', $tenantId);

        if ($request->filled('category_id')) $query->where('category_id', $request->category_id);
        if ($request->filled('status'))      $query->where('status', $request->status);
        if ($request->filled('currency'))    $query->where('currency', $request->currency);
        if ($request->filled('date_from'))   $query->where('expense_date', '>=', $request->date_from);
        if ($request->filled('date_to'))     $query->where('expense_date', '<=', $request->date_to);
        if ($request->filled('search')) {
            $q = $request->search;
            $query->where(fn($s) => $s->where('title', 'like', "%$q%")->orWhere('description', 'like', "%$q%"));
        }

        $expenses = $query->orderBy('expense_date', 'desc')->paginate($request->get('per_page', 20));
        return $this->sendResponse($expenses, 'Expenses retrieved');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title'             => 'required|string|max:200',
            'amount'            => 'required|numeric|min:0',
            'currency'          => 'required|string|max:10',
            'expense_date'      => 'required|date',
            'category_id'       => 'nullable|exists:personal_expense_categories,id',
            'description'       => 'nullable|string|max:1000',
            'payment_method'    => 'nullable|string|max:50',
            'reference'         => 'nullable|string|max:100',
            'status'            => 'nullable|in:PAID,PENDING,CANCELLED',
            'is_recurring'      => 'nullable|boolean',
            'recurrence_period' => 'nullable|string|in:DAILY,WEEKLY,MONTHLY,YEARLY',
        ]);
        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $data                 = $request->all();
        $data['tenant_id']    = $this->tenantId($request);
        $data['user_id']      = auth()->id();
        $data['status']       = $data['status'] ?? 'PAID';
        $data['payment_method'] = $data['payment_method'] ?? 'ESPECES';

        $expense = PersonalExpense::create($data);
        return $this->sendResponse($expense->load('category'), 'Expense created', 201);
    }

    public function update(Request $request, $id)
    {
        $tenantId = $this->tenantId($request);
        $expense  = PersonalExpense::where('tenant_id', $tenantId)->find($id);
        if (!$expense) return $this->sendError('Expense not found', [], 404);

        $validator = Validator::make($request->all(), [
            'title'             => 'sometimes|string|max:200',
            'amount'            => 'sometimes|numeric|min:0',
            'currency'          => 'sometimes|string|max:10',
            'expense_date'      => 'sometimes|date',
            'category_id'       => 'nullable|exists:personal_expense_categories,id',
            'description'       => 'nullable|string|max:1000',
            'payment_method'    => 'nullable|string|max:50',
            'reference'         => 'nullable|string|max:100',
            'status'            => 'nullable|in:PAID,PENDING,CANCELLED',
            'is_recurring'      => 'nullable|boolean',
            'recurrence_period' => 'nullable|string|in:DAILY,WEEKLY,MONTHLY,YEARLY',
        ]);
        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $expense->update($request->all());
        return $this->sendResponse($expense->load('category'), 'Expense updated');
    }

    public function destroy(Request $request, $id)
    {
        $tenantId = $this->tenantId($request);
        $expense  = PersonalExpense::where('tenant_id', $tenantId)->find($id);
        if (!$expense) return $this->sendError('Expense not found', [], 404);

        $expense->delete();
        return $this->sendResponse([], 'Expense deleted');
    }

    // ==================== STATISTIQUES ====================

    public function statistics(Request $request)
    {
        try {
            $tenantId   = $this->tenantId($request);
            $dateFrom   = $request->get('date_from', now()->startOfMonth()->format('Y-m-d'));
            $dateTo     = $request->get('date_to', now()->format('Y-m-d'));
            $categoryId = $request->get('category_id');

            // Helper to get a fresh base query (avoids clone/join ambiguity)
            $base = function () use ($tenantId, $dateFrom, $dateTo, $categoryId) {
                $q = DB::table('personal_expenses')
                    ->where('personal_expenses.tenant_id', $tenantId)
                    ->where('personal_expenses.status', '!=', 'CANCELLED')
                    ->whereBetween('personal_expenses.expense_date', [$dateFrom, $dateTo]);
                if ($categoryId) $q->where('personal_expenses.category_id', $categoryId);
                return $q;
            };

            // Summary
            $summary = $base()->selectRaw('
                COUNT(*) as total_count,
                COALESCE(SUM(amount), 0) as total_amount,
                COALESCE(AVG(amount), 0) as avg_amount,
                COALESCE(MAX(amount), 0) as max_amount,
                COALESCE(MIN(amount), 0) as min_amount,
                COALESCE(SUM(CASE WHEN status = "PAID" THEN amount ELSE 0 END), 0) as paid_amount,
                COALESCE(SUM(CASE WHEN status = "PENDING" THEN amount ELSE 0 END), 0) as pending_amount
            ')->first();

            // By category (separate query with explicit join)
            $byCategory = DB::table('personal_expenses')
                ->leftJoin('personal_expense_categories as pc', 'personal_expenses.category_id', '=', 'pc.id')
                ->where('personal_expenses.tenant_id', $tenantId)
                ->where('personal_expenses.status', '!=', 'CANCELLED')
                ->whereBetween('personal_expenses.expense_date', [$dateFrom, $dateTo])
                ->groupBy('pc.id', 'pc.name', 'pc.color')
                ->selectRaw('
                    COALESCE(pc.name, "Sans catégorie") as category_name,
                    COALESCE(pc.color, "#6c757d") as color,
                    COALESCE(SUM(personal_expenses.amount), 0) as total,
                    COUNT(*) as count
                ')
                ->orderByDesc('total')
                ->get();

            // By month (last 12 months)
            $byMonth = DB::table('personal_expenses')
                ->where('personal_expenses.tenant_id', $tenantId)
                ->where('personal_expenses.status', '!=', 'CANCELLED')
                ->where('personal_expenses.expense_date', '>=', now()->subMonths(11)->startOfMonth()->format('Y-m-d'))
                ->groupByRaw('DATE_FORMAT(personal_expenses.expense_date, "%Y-%m")')
                ->selectRaw('DATE_FORMAT(personal_expenses.expense_date, "%Y-%m") as month, COALESCE(SUM(personal_expenses.amount), 0) as total, COUNT(*) as count')
                ->orderBy('month')
                ->get();

            // By payment method
            $byMethod = $base()
                ->groupBy('personal_expenses.payment_method')
                ->selectRaw('personal_expenses.payment_method, COALESCE(SUM(personal_expenses.amount), 0) as total, COUNT(*) as count')
                ->orderByDesc('total')
                ->get();

            // Top 10 expenses with category info (fresh query with explicit join)
            $topExpenses = DB::table('personal_expenses')
                ->leftJoin('personal_expense_categories as c', 'personal_expenses.category_id', '=', 'c.id')
                ->where('personal_expenses.tenant_id', $tenantId)
                ->where('personal_expenses.status', '!=', 'CANCELLED')
                ->whereBetween('personal_expenses.expense_date', [$dateFrom, $dateTo])
                ->select(
                    'personal_expenses.id',
                    'personal_expenses.title',
                    'personal_expenses.amount',
                    'personal_expenses.currency',
                    'personal_expenses.expense_date',
                    'personal_expenses.payment_method',
                    'personal_expenses.status'
                )
                ->selectRaw('COALESCE(c.name, "Sans catégorie") as category_name, COALESCE(c.color, "#6c757d") as category_color')
                ->when($categoryId, fn($q) => $q->where('personal_expenses.category_id', $categoryId))
                ->orderByDesc('personal_expenses.amount')
                ->limit(10)
                ->get();

            // Current vs previous month evolution
            $currentMonth       = now()->format('Y-m');
            $previousMonth      = now()->subMonth()->format('Y-m');

            $currentMonthTotal  = DB::table('personal_expenses')
                ->where('tenant_id', $tenantId)
                ->where('status', '!=', 'CANCELLED')
                ->whereRaw('DATE_FORMAT(expense_date, "%Y-%m") = ?', [$currentMonth])
                ->sum('amount');

            $previousMonthTotal = DB::table('personal_expenses')
                ->where('tenant_id', $tenantId)
                ->where('status', '!=', 'CANCELLED')
                ->whereRaw('DATE_FORMAT(expense_date, "%Y-%m") = ?', [$previousMonth])
                ->sum('amount');

            $evolution = ($previousMonthTotal > 0)
                ? round((($currentMonthTotal - $previousMonthTotal) / $previousMonthTotal) * 100, 1)
                : 0;

            return $this->sendResponse([
                'summary'              => $summary,
                'by_category'          => $byCategory,
                'by_month'             => $byMonth,
                'by_payment_method'    => $byMethod,
                'top_expenses'         => $topExpenses,
                'current_month_total'  => (float) $currentMonthTotal,
                'previous_month_total' => (float) $previousMonthTotal,
                'evolution_percent'    => $evolution,
                'period'               => ['from' => $dateFrom, 'to' => $dateTo],
            ], 'Statistics retrieved');

        } catch (\Exception $e) {
            return $this->sendError('Server Error', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()], 500);
        }
    }
}
