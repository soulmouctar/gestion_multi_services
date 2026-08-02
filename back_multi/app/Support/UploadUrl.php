<?php

namespace App\Support;

class UploadUrl
{
    public static function make(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        $normalized = self::normalizePath($path);
        $prefix = trim((string) config('app.upload_public_prefix', 'uploads'), '/');

        if ($prefix !== 'uploads' && str_starts_with($normalized, 'uploads/')) {
            $normalized = $prefix . '/' . substr($normalized, strlen('uploads/'));
        }

        $host = rtrim(request()->getSchemeAndHttpHost(), '/');

        return $host . '/' . ltrim($normalized, '/');
    }

    public static function normalizePath(string $path): string
    {
        $normalized = ltrim($path, '/');

        if (str_starts_with($normalized, 'http://') || str_starts_with($normalized, 'https://')) {
            $urlPath = parse_url($normalized, PHP_URL_PATH);
            if (!$urlPath) {
                return $normalized;
            }

            $normalized = ltrim($urlPath, '/');
        }

        if (str_starts_with($normalized, 'public/uploads/')) {
            return $normalized;
        }

        if (str_starts_with($normalized, 'upload/')) {
            return 'uploads/' . substr($normalized, strlen('upload/'));
        }

        if (!str_starts_with($normalized, 'uploads/')) {
            return 'uploads/' . $normalized;
        }

        return $normalized;
    }
}
