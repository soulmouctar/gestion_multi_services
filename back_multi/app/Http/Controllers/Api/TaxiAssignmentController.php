<?php

namespace App\Http\Controllers\Api;

use App\Models\TaxiAssignment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TaxiAssignmentController extends BaseController
{
    public function index(Request $request)
    {
        $query = TaxiAssignment::with('taxi', 'driver');

        if ($request->has('taxi_id')) {
            $query->where('taxi_id', $request->taxi_id);
        }

        if ($request->has('driver_id')) {
            $query->where('driver_id', $request->driver_id);
        }

        $assignments = $query->paginate(15);
        return $this->sendResponse($assignments, 'Taxi assignments retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'taxi_id' => 'required|exists:taxis,id',
            'driver_id' => 'required|exists:drivers,id',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $assignment = TaxiAssignment::create($request->all());

        return $this->sendResponse($assignment->load('taxi', 'driver'), 'Taxi assignment created successfully', 201);
    }

    public function show($id)
    {
        $assignment = TaxiAssignment::with('taxi', 'driver')->find($id);

        if (!$assignment) {
            return $this->sendError('Taxi assignment not found');
        }

        return $this->sendResponse($assignment, 'Taxi assignment retrieved successfully');
    }

    public function update(Request $request, $id)
    {
        $assignment = TaxiAssignment::find($id);

        if (!$assignment) {
            return $this->sendError('Taxi assignment not found');
        }

        $validator = Validator::make($request->all(), [
            'taxi_id' => 'sometimes|exists:taxis,id',
            'driver_id' => 'sometimes|exists:drivers,id',
            'start_date' => 'sometimes|date',
            'end_date' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error', $validator->errors()->toArray(), 422);
        }

        $assignment->update($request->all());

        return $this->sendResponse($assignment->load('taxi', 'driver'), 'Taxi assignment updated successfully');
    }

    public function destroy($id)
    {
        $assignment = TaxiAssignment::find($id);

        if (!$assignment) {
            return $this->sendError('Taxi assignment not found');
        }

        $assignment->delete();

        return $this->sendResponse([], 'Taxi assignment deleted successfully');
    }
}
