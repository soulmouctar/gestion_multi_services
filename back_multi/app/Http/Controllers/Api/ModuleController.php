<?php

namespace App\Http\Controllers\Api;

use App\Models\Module;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ModuleController extends BaseController
{
    public function index()
    {
        $modules = Module::paginate(15);
        return $this->sendResponse($modules, 'Modules retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string|max:50|unique:modules,code',
            'name' => 'required|string|max:150',
            'description' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $module = Module::create($request->all());

        return $this->sendResponse($module, 'Module created successfully', 201);
    }

    public function show($id)
    {
        $module = Module::with('tenants')->find($id);

        if (!$module) {
            return $this->sendError('Module not found');
        }

        return $this->sendResponse($module, 'Module retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $module = Module::find($id);

        if (!$module) {
            return $this->sendError('Module not found');
        }

        $validator = Validator::make($request->all(), [
            'code' => 'sometimes|string|max:50|unique:modules,code,' . $id,
            'name' => 'sometimes|string|max:150',
            'description' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $module->update($request->all());

        return $this->sendResponse($module, 'Module updated successfully');
    }

    public function destroy($id)
    {
        $module = Module::find($id);

        if (!$module) {
            return $this->sendError('Module not found');
        }

        $module->delete();

        return $this->sendResponse([], 'Module deleted successfully');
    }
}
