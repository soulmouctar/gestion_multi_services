<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class BaseController extends Controller
{
    public function sendResponse($result, $message = '', $code = 200): JsonResponse
    {
        $response = [
            'success' => true,
            'data'    => $result,
            'message' => $message,
        ];

        return response()->json($response, $code);
    }

    public function sendError($error, $errorMessages = [], $code = 404): JsonResponse
    {
        $response = [
            'success' => false,
            'message' => $error,
        ];

        if (!empty($errorMessages)) {
            $response['errors'] = $errorMessages;
        }

        return response()->json($response, $code);
    }

    protected function storeUploadedFile($file, string $subfolder): string
    {
        $dir = public_path('uploads/' . $subfolder);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $filename = \Illuminate\Support\Str::random(40) . '.' . $file->getClientOriginalExtension();
        $file->move($dir, $filename);
        return 'uploads/' . $subfolder . '/' . $filename;
    }

    protected function deleteUploadedFile(?string $path): void
    {
        if (!$path) return;
        $normalized = ltrim($path, '/');
        if (!str_starts_with($normalized, 'uploads/')) {
            $normalized = 'uploads/' . $normalized;
        }
        $full = public_path($normalized);
        if (file_exists($full)) {
            unlink($full);
        }
    }
}
