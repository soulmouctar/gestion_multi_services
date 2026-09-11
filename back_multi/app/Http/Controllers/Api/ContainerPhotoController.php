<?php

namespace App\Http\Controllers\Api;

use App\Models\Container;
use App\Models\ContainerArrival;
use App\Models\ContainerPhoto;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Schema;

class ContainerPhotoController extends BaseController
{
    private function tenantId(Request $request): ?int
    {
        $user = Auth::user();
        return $user->hasRole('SUPER_ADMIN') ? $request->get('tenant_id') : $user->tenant_id;
    }

    private function photoQuery(Request $request)
    {
        $tenantId = $this->tenantId($request);
        $query = ContainerPhoto::with($this->photoRelations());

        if ($tenantId) {
            $query->whereHas('container', fn ($q) => $q->where('tenant_id', $tenantId));
        }

        return $query;
    }

    private function containerBelongsToTenant(int $containerId, ?int $tenantId): bool
    {
        $query = Container::whereKey($containerId);

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        return $query->exists();
    }

    private function productBelongsToTenant(?int $productId, ?int $tenantId): bool
    {
        if (!$productId) {
            return true;
        }

        $query = Product::whereKey($productId);

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        return $query->exists();
    }

    private function arrivalBelongsToContainerAndTenant(?int $arrivalId, int $containerId, ?int $tenantId): bool
    {
        if (!$arrivalId) {
            return true;
        }

        $query = ContainerArrival::whereKey($arrivalId)->where('container_id', $containerId);

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        return $query->exists();
    }

    public function index(Request $request)
    {
        $query = $this->photoQuery($request);

        if ($request->has('container_id')) {
            $query->where('container_id', $request->container_id);
        }

        if ($this->hasArrivalPhotoLinkColumn() && $request->has('arrival_id')) {
            $query->where('container_arrival_id', $request->arrival_id);
        }

        $photos = $query->orderBy('created_at', 'desc')->paginate(15);
        return $this->sendResponse($photos, 'Container photos retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'container_id' => 'required|exists:containers,id',
            'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:2048',
            'product_id' => 'nullable|exists:products,id',
            'description' => 'nullable|string|max:500',
        ]);

        if ($this->hasArrivalPhotoLinkColumn()) {
            $validator->addRules(['container_arrival_id' => 'nullable|exists:container_arrivals,id']);
        }

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $tenantId = $this->tenantId($request);
        if (!$this->containerBelongsToTenant((int) $request->container_id, $tenantId)) {
            return $this->sendError('Accès refusé : conteneur invalide', [], 403);
        }
        if (!$this->productBelongsToTenant($request->filled('product_id') ? (int) $request->product_id : null, $tenantId)) {
            return $this->sendError('Accès refusé : produit invalide', [], 403);
        }
        if (!$this->arrivalBelongsToContainerAndTenant($request->filled('container_arrival_id') ? (int) $request->container_arrival_id : null, (int) $request->container_id, $tenantId)) {
            return $this->sendError('Accès refusé : arrivage invalide', [], 403);
        }

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $this->uploadFile($request->file('image'), 'containers');
        }

        $payload = [
            'container_id' => $request->container_id,
            'image_path' => $imagePath,
            'product_id' => $request->product_id,
            'description' => $request->description,
        ];
        if ($this->hasArrivalPhotoLinkColumn()) {
            $payload['container_arrival_id'] = $request->container_arrival_id;
        }

        $photo = ContainerPhoto::create($payload);

        return $this->sendResponse($photo->load($this->photoRelations()), 'Container photo created successfully', 201);
    }

    public function show($id)
    {
        $photo = $this->photoQuery(request())->find($id);

        if (!$photo) {
            return $this->sendError('Container photo not found');
        }

        return $this->sendResponse($photo, 'Container photo retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $photo = $this->photoQuery($request)->find($id);

        if (!$photo) {
            return $this->sendError('Container photo not found');
        }

        $validator = Validator::make($request->all(), [
            'container_id' => 'sometimes|exists:containers,id',
            'image' => 'sometimes|image|mimes:jpeg,png,jpg,gif|max:2048',
            'product_id' => 'nullable|exists:products,id',
            'description' => 'nullable|string|max:500',
        ]);

        if ($this->hasArrivalPhotoLinkColumn()) {
            $validator->addRules(['container_arrival_id' => 'nullable|exists:container_arrivals,id']);
        }

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $tenantId = $this->tenantId($request);
        $containerId = (int) $request->get('container_id', $photo->container_id);

        if ($request->has('container_id')) {
            if (!$this->containerBelongsToTenant($containerId, $tenantId)) {
                return $this->sendError('Accès refusé : conteneur invalide', [], 403);
            }
        }
        if ($request->has('product_id') && !$this->productBelongsToTenant($request->filled('product_id') ? (int) $request->product_id : null, $tenantId)) {
            return $this->sendError('Accès refusé : produit invalide', [], 403);
        }
        if ($this->hasArrivalPhotoLinkColumn() && $request->has('container_arrival_id') && !$this->arrivalBelongsToContainerAndTenant($request->filled('container_arrival_id') ? (int) $request->container_arrival_id : null, $containerId, $tenantId)) {
            return $this->sendError('Accès refusé : arrivage invalide', [], 403);
        }

        if ($request->hasFile('image')) {
            $this->deleteFile($photo->image_path);
            $photo->image_path = $this->uploadFile($request->file('image'), 'containers');
        }

        if ($request->has('container_id')) {
            $photo->container_id = $request->container_id;
        }
        if ($request->has('product_id')) {
            $photo->product_id = $request->product_id;
        }
        if ($request->has('description')) {
            $photo->description = $request->description;
        }

        if ($this->hasArrivalPhotoLinkColumn() && $request->has('container_arrival_id')) {
            $photo->container_arrival_id = $request->container_arrival_id;
        }

        $photo->save();

        return $this->sendResponse($photo->load($this->photoRelations()), 'Container photo updated successfully');
    }

    public function destroy(Request $request, $id)
    {
        $photo = $this->photoQuery($request)->find($id);

        if (!$photo) {
            return $this->sendError('Container photo not found');
        }

        $this->deleteFile($photo->image_path);
        $photo->delete();

        return $this->sendResponse([], 'Container photo deleted successfully');
    }
    private function hasArrivalPhotoLinkColumn(): bool
    {
        return Schema::hasColumn('container_photos', 'container_arrival_id');
    }

    private function photoRelations(): array
    {
        $relations = ['container', 'product'];
        if ($this->hasArrivalPhotoLinkColumn()) {
            $relations[] = 'arrival';
        }

        return $relations;
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
            $normalized = ltrim($path, '/');
            if (str_starts_with($normalized, 'upload/')) {
                $normalized = 'uploads/' . substr($normalized, strlen('upload/'));
            }
            $full = public_path($normalized);
            if (file_exists($full)) {
                unlink($full);
            }
        }
    }
}
