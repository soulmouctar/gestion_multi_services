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
            'tenant_id' => 'required|exists:tenants,id',
            'container_number' => 'required|string|max:50',
            'capacity_min' => 'nullable|integer|min:0',
            'capacity_max' => 'nullable|integer|min:0',
            'interest_rate' => 'nullable|numeric|min:0|max:100',
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
            'tenant_id' => 'sometimes|exists:tenants,id',
            'container_number' => 'sometimes|string|max:50',
            'capacity_min' => 'nullable|integer|min:0',
            'capacity_max' => 'nullable|integer|min:0',
            'interest_rate' => 'nullable|numeric|min:0|max:100',
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

    public function statisticsMonthly(Request $request)
    {
        $tenantId = $request->get('tenant_id', 1);
        $period = $request->get('period', '30days');
        
        // Calculate date range based on period
        $days = 30;
        if ($period === '7days') $days = 7;
        elseif ($period === '90days') $days = 90;
        elseif ($period === '365days') $days = 365;
        
        $startDate = now()->subDays($days);
        
        // Get containers created in the period
        $containersCreated = Container::where('tenant_id', $tenantId)
            ->where('created_at', '>=', $startDate)
            ->count();
        
        // Get total containers
        $totalContainers = Container::where('tenant_id', $tenantId)->count();
        
        // Get containers with photos
        $containersWithPhotos = Container::where('tenant_id', $tenantId)
            ->whereHas('photos')
            ->count();
        
        // Monthly breakdown (last 6 months)
        $monthlyData = [];
        for ($i = 5; $i >= 0; $i--) {
            $monthStart = now()->subMonths($i)->startOfMonth();
            $monthEnd = now()->subMonths($i)->endOfMonth();
            $monthName = $monthStart->format('M Y');
            
            $count = Container::where('tenant_id', $tenantId)
                ->whereBetween('created_at', [$monthStart, $monthEnd])
                ->count();
            
            $monthlyData[] = [
                'month' => $monthName,
                'count' => $count
            ];
        }
        
        $statistics = [
            'period' => $period,
            'containers_created' => $containersCreated,
            'total_containers' => $totalContainers,
            'containers_with_photos' => $containersWithPhotos,
            'monthly_breakdown' => $monthlyData
        ];
        
        return $this->sendResponse($statistics, 'Monthly statistics retrieved successfully');
    }

    public function statisticsTopPerformers(Request $request)
    {
        $tenantId = $request->get('tenant_id', 1);
        $period = $request->get('period', '30days');
        $limit = $request->get('limit', 10);
        
        // Get containers with most photos
        $topByPhotos = Container::where('tenant_id', $tenantId)
            ->withCount('photos')
            ->orderBy('photos_count', 'desc')
            ->limit($limit)
            ->get()
            ->map(function ($container) {
                return [
                    'id' => $container->id,
                    'container_number' => $container->container_number,
                    'photos_count' => $container->photos_count,
                    'capacity_min' => $container->capacity_min,
                    'capacity_max' => $container->capacity_max,
                    'interest_rate' => $container->interest_rate
                ];
            });
        
        // Get recently active containers
        $recentlyActive = Container::where('tenant_id', $tenantId)
            ->orderBy('updated_at', 'desc')
            ->limit($limit)
            ->get()
            ->map(function ($container) {
                return [
                    'id' => $container->id,
                    'container_number' => $container->container_number,
                    'updated_at' => $container->updated_at->format('Y-m-d H:i:s')
                ];
            });
        
        $statistics = [
            'period' => $period,
            'top_by_photos' => $topByPhotos,
            'recently_active' => $recentlyActive
        ];
        
        return $this->sendResponse($statistics, 'Top performers retrieved successfully');
    }
}
