<?php

namespace App\Http\Controllers\Api;

use App\Models\ContainerPhoto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Schema;

class ContainerPhotoController extends BaseController
{
    public function index(Request $request)
    {
        $query = ContainerPhoto::with($this->photoRelations());

        if ($request->has('container_id')) {
            $query->where('container_id', $request->container_id);
        }

        if ($this->hasArrivalPhotoLinkColumn() && $request->has('arrival_id')) {
            $query->where('container_arrival_id', $request->arrival_id);
        }

        if ($request->has('tenant_id')) {
            $query->whereHas('container', function($q) use ($request) {
                $q->where('tenant_id', $request->tenant_id);
            });
        }

        $photos = $query->orderBy('created_at', 'desc')->paginate(15);
        return $this->sendResponse($photos, 'Container photos retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'container_id' => 'required|exists:containers,id',
            'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        if ($this->hasArrivalPhotoLinkColumn()) {
            $validator->addRules(['container_arrival_id' => 'nullable|exists:container_arrivals,id']);
        }

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $this->uploadFile($request->file('image'), 'containers');
        }

        $payload = [
            'container_id' => $request->container_id,
            'image_path' => $imagePath,
        ];
        if ($this->hasArrivalPhotoLinkColumn()) {
            $payload['container_arrival_id'] = $request->container_arrival_id;
        }

        $photo = ContainerPhoto::create($payload);

        return $this->sendResponse($photo->load($this->photoRelations()), 'Container photo created successfully', 201);
    }

    public function show($id)
    {
        $photo = ContainerPhoto::with($this->photoRelations())->find($id);

        if (!$photo) {
            return $this->sendError('Container photo not found');
        }

        return $this->sendResponse($photo, 'Container photo retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $photo = ContainerPhoto::find($id);

        if (!$photo) {
            return $this->sendError('Container photo not found');
        }

        $validator = Validator::make($request->all(), [
            'container_id' => 'sometimes|exists:containers,id',
            'image' => 'sometimes|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        if ($this->hasArrivalPhotoLinkColumn()) {
            $validator->addRules(['container_arrival_id' => 'nullable|exists:container_arrivals,id']);
        }

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        if ($request->hasFile('image')) {
            $this->deleteFile($photo->image_path);
            $photo->image_path = $this->uploadFile($request->file('image'), 'containers');
        }

        if ($request->has('container_id')) {
            $photo->container_id = $request->container_id;
        }

        if ($this->hasArrivalPhotoLinkColumn() && $request->has('container_arrival_id')) {
            $photo->container_arrival_id = $request->container_arrival_id;
        }

        $photo->save();

        return $this->sendResponse($photo->load($this->photoRelations()), 'Container photo updated successfully');
    }

    public function destroy($id)
    {
        $photo = ContainerPhoto::find($id);

        if (!$photo) {
            return $this->sendError('Container photo not found');
        }

        $this->deleteFile($photo->image_path);
        $photo->delete();

        return $this->sendResponse([], 'Container photo deleted successfully');
    }

    public function publicIndex(Request $request)
    {
        $query = ContainerPhoto::with($this->photoRelations());

        if ($request->has('container_id')) {
            $query->where('container_id', $request->container_id);
        }

        if ($this->hasArrivalPhotoLinkColumn() && $request->has('arrival_id')) {
            $query->where('container_arrival_id', $request->arrival_id);
        }

        // Use fixed tenant_id for testing
        $tenantId = $request->get('tenant_id', 1);
        if ($tenantId) {
            $query->whereHas('container', function($q) use ($tenantId) {
                $q->where('tenant_id', $tenantId);
            });
        }

        $photos = $query->orderBy('created_at', 'desc')->paginate(15);
        return $this->sendResponse($photos, 'Container photos retrieved successfully');
    }

    public function publicStore(Request $request)
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
            $full = public_path($path);
            if (file_exists($full)) {
                unlink($full);
            }
        }
    }
}
