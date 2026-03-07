<?php

namespace App\Http\Controllers\Api;

use App\Models\ContainerPhoto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;

class ContainerPhotoController extends BaseController
{
    public function index(Request $request)
    {
        $query = ContainerPhoto::with('container');

        if ($request->has('container_id')) {
            $query->where('container_id', $request->container_id);
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

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        // Upload image
        $imagePath = null;
        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $imagePath = $image->store('uploads/container/products', 'public');
        }

        $photo = ContainerPhoto::create([
            'container_id' => $request->container_id,
            'image_path' => $imagePath,
        ]);

        return $this->sendResponse($photo->load('container'), 'Container photo created successfully', 201);
    }

    public function show($id)
    {
        $photo = ContainerPhoto::with('container')->find($id);

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

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        // Update image if provided
        if ($request->hasFile('image')) {
            // Delete old image
            if ($photo->image_path && Storage::disk('public')->exists($photo->image_path)) {
                Storage::disk('public')->delete($photo->image_path);
            }
            
            $image = $request->file('image');
            $imagePath = $image->store('uploads/container/products', 'public');
            $photo->image_path = $imagePath;
        }

        if ($request->has('container_id')) {
            $photo->container_id = $request->container_id;
        }

        $photo->save();

        return $this->sendResponse($photo->load('container'), 'Container photo updated successfully');
    }

    public function destroy($id)
    {
        $photo = ContainerPhoto::find($id);

        if (!$photo) {
            return $this->sendError('Container photo not found');
        }

        // Delete image file
        if ($photo->image_path && Storage::disk('public')->exists($photo->image_path)) {
            Storage::disk('public')->delete($photo->image_path);
        }

        $photo->delete();

        return $this->sendResponse([], 'Container photo deleted successfully');
    }

    public function publicIndex(Request $request)
    {
        $query = ContainerPhoto::with('container');

        if ($request->has('container_id')) {
            $query->where('container_id', $request->container_id);
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

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        // Upload image
        $imagePath = null;
        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $imagePath = $image->store('uploads/container/products', 'public');
        }

        $photo = ContainerPhoto::create([
            'container_id' => $request->container_id,
            'image_path' => $imagePath,
            'product_id' => $request->product_id,
            'description' => $request->description,
        ]);

        return $this->sendResponse($photo->load('container', 'product'), 'Container photo created successfully', 201);
    }
}
