<?php

namespace App\Http\Controllers\Api;

use App\Models\Container;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ContainerController extends BaseController
{
    public function index(Request $request)
    {
        $query = Container::with('tenant', 'photos');

        if ($request->has('tenant_id')) {
            $query->where('tenant_id', $request->tenant_id);
        }

        $containers = $query->paginate(15);
        return $this->sendResponse($containers, 'Containers retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tenant_id'        => 'required|exists:tenants,id',
            'container_number' => 'required|string|max:50',
            'capacity_min'     => 'nullable|integer|min:0',
            'capacity_max'     => 'nullable|integer|min:0',
            'interest_rate'    => 'nullable|numeric|min:0|max:100',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $container = Container::create($request->all());

        return $this->sendResponse($container, 'Container created successfully', 201);
    }

    public function show($id)
    {
        $container = Container::with('tenant', 'photos')->find($id);

        if (!$container) {
            return $this->sendError('Container not found');
        }

        return $this->sendResponse($container, 'Container retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $container = Container::find($id);

        if (!$container) {
            return $this->sendError('Container not found');
        }

        $validator = Validator::make($request->all(), [
            'tenant_id'        => 'sometimes|exists:tenants,id',
            'container_number' => 'sometimes|string|max:50',
            'capacity_min'     => 'nullable|integer|min:0',
            'capacity_max'     => 'nullable|integer|min:0',
            'interest_rate'    => 'nullable|numeric|min:0|max:100',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $container->update($request->all());

        return $this->sendResponse($container, 'Container updated successfully');
    }

    public function destroy($id)
    {
        $container = Container::find($id);

        if (!$container) {
            return $this->sendError('Container not found');
        }

        $container->delete();

        return $this->sendResponse([], 'Container deleted successfully');
    }

    public function statisticsGeneral(Request $request)
    {
        $tenantId = auth()->user()->tenant_id;
        $period   = $request->get('period', '30days');

        $days = $this->periodToDays($period);
        $startDate = now()->subDays($days);

        $baseQuery = Container::where('tenant_id', $tenantId);

        $statistics = [
            'period'               => $period,
            'total_containers'     => (clone $baseQuery)->count(),
            'containers_created'   => (clone $baseQuery)->where('created_at', '>=', $startDate)->count(),
            'containers_with_photos' => (clone $baseQuery)->whereHas('photos')->count(),
            'avg_capacity_min'     => round((clone $baseQuery)->whereNotNull('capacity_min')->avg('capacity_min') ?? 0, 2),
            'avg_capacity_max'     => round((clone $baseQuery)->whereNotNull('capacity_max')->avg('capacity_max') ?? 0, 2),
            'avg_interest_rate'    => round((clone $baseQuery)->whereNotNull('interest_rate')->avg('interest_rate') ?? 0, 2),
        ];

        return $this->sendResponse($statistics, 'General statistics retrieved successfully');
    }

    public function statisticsCapacity(Request $request)
    {
        $tenantId = auth()->user()->tenant_id;

        $containers = Container::where('tenant_id', $tenantId)
            ->whereNotNull('capacity_min')
            ->whereNotNull('capacity_max')
            ->get();

        $ranges = [
            ['label' => '0-1000',       'min' => 0,     'max' => 1000,        'count' => 0],
            ['label' => '1001-5000',    'min' => 1001,  'max' => 5000,        'count' => 0],
            ['label' => '5001-10000',   'min' => 5001,  'max' => 10000,       'count' => 0],
            ['label' => '10001-20000',  'min' => 10001, 'max' => 20000,       'count' => 0],
            ['label' => '20000+',       'min' => 20001, 'max' => PHP_INT_MAX, 'count' => 0],
        ];

        foreach ($containers as $container) {
            $avgCapacity = ($container->capacity_min + $container->capacity_max) / 2;

            foreach ($ranges as &$range) {
                if ($avgCapacity >= $range['min'] && $avgCapacity <= $range['max']) {
                    $range['count']++;
                    break;
                }
            }
        }

        return $this->sendResponse($ranges, 'Capacity statistics retrieved successfully');
    }

    public function statisticsStatus(Request $request)
    {
        $tenantId  = auth()->user()->tenant_id;
        $baseQuery = Container::where('tenant_id', $tenantId);

        $withPhotos    = (clone $baseQuery)->whereHas('photos')->count();
        $withoutPhotos = (clone $baseQuery)->whereDoesntHave('photos')->count();
        $total         = $withPhotos + $withoutPhotos;

        $statistics = [
            [
                'label'      => 'Avec photos',
                'count'      => $withPhotos,
                'percentage' => $total > 0 ? round(($withPhotos / $total) * 100, 2) : 0,
            ],
            [
                'label'      => 'Sans photos',
                'count'      => $withoutPhotos,
                'percentage' => $total > 0 ? round(($withoutPhotos / $total) * 100, 2) : 0,
            ],
            [
                'label'      => 'Taux faible (<5%)',
                'count'      => (clone $baseQuery)->where('interest_rate', '<', 5)->count(),
                'percentage' => 0,
            ],
            [
                'label'      => 'Taux moyen (5-10%)',
                'count'      => (clone $baseQuery)->whereBetween('interest_rate', [5, 10])->count(),
                'percentage' => 0,
            ],
            [
                'label'      => 'Taux élevé (>10%)',
                'count'      => (clone $baseQuery)->where('interest_rate', '>', 10)->count(),
                'percentage' => 0,
            ],
        ];

        return $this->sendResponse($statistics, 'Status statistics retrieved successfully');
    }

    public function statisticsMonthly(Request $request)
    {
        $tenantId  = auth()->user()->tenant_id;
        $period    = $request->get('period', '30days');
        $days      = $this->periodToDays($period);
        $startDate = now()->subDays($days);

        $baseQuery = Container::where('tenant_id', $tenantId);

        $monthlyData = [];
        for ($i = 5; $i >= 0; $i--) {
            $monthStart = now()->subMonths($i)->startOfMonth();
            $monthEnd   = now()->subMonths($i)->endOfMonth();

            $monthlyData[] = [
                'month' => $monthStart->format('M Y'),
                'count' => (clone $baseQuery)->whereBetween('created_at', [$monthStart, $monthEnd])->count(),
            ];
        }

        $statistics = [
            'period'                 => $period,
            'containers_created'     => (clone $baseQuery)->where('created_at', '>=', $startDate)->count(),
            'total_containers'       => (clone $baseQuery)->count(),
            'containers_with_photos' => (clone $baseQuery)->whereHas('photos')->count(),
            'monthly_breakdown'      => $monthlyData,
        ];

        return $this->sendResponse($statistics, 'Monthly statistics retrieved successfully');
    }

    public function statisticsTopPerformers(Request $request)
    {
        $tenantId = auth()->user()->tenant_id;
        $limit    = (int) $request->get('limit', 10);

        $topByPhotos = Container::where('tenant_id', $tenantId)
            ->withCount('photos')
            ->orderBy('photos_count', 'desc')
            ->limit($limit)
            ->get(['id', 'container_number', 'capacity_min', 'capacity_max', 'interest_rate']);

        $recentlyActive = Container::where('tenant_id', $tenantId)
            ->orderBy('updated_at', 'desc')
            ->limit($limit)
            ->get(['id', 'container_number', 'updated_at']);

        $statistics = [
            'top_by_photos'   => $topByPhotos,
            'recently_active' => $recentlyActive,
        ];

        return $this->sendResponse($statistics, 'Top performers retrieved successfully');
    }

    private function periodToDays(string $period): int
    {
        return match ($period) {
            '7days'   => 7,
            '3months' => 90,
            '6months' => 180,
            'year'    => 365,
            default   => 30,
        };
    }
}