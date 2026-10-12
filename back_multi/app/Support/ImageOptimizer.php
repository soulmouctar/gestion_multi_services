<?php

namespace App\Support;

/**
 * Allege une image envoyee : ramenee a 1600 px de plus grand cote et recompressee,
 * sans changer ni son nom ni son format (les chemins enregistres restent valides).
 *
 * Une photo de telephone pese plusieurs Mo pour un affichage de quelques centaines
 * de pixels : sans cela, chaque liste avec photos telecharge des dizaines de Mo.
 */
class ImageOptimizer
{
    public const MAX_SIDE = 1600;
    private const JPEG_QUALITY = 82;

    /**
     * Allege le fichier sur place. Retourne le nombre d'octets gagnes
     * (0 si le fichier n'est pas une image traitable ou ne peut pas etre reduit).
     * Avec $dryRun, calcule le gain sans toucher au fichier.
     */
    public static function shrink(string $path, bool $dryRun = false): int
    {
        if (!extension_loaded('gd') || !is_file($path) || !is_writable($path)) {
            return 0;
        }

        $info = @getimagesize($path);
        if (!$info) {
            return 0;
        }
        [$width, $height, $type] = $info;
        if (!in_array($type, [IMAGETYPE_JPEG, IMAGETYPE_PNG], true) || $width < 1 || $height < 1) {
            return 0;
        }
        // Decoder une image demande ~5 octets par pixel : on laisse les geantes plutot que d'epuiser la memoire
        if ($width * $height > 40_000_000) {
            return 0;
        }

        $source = $type === IMAGETYPE_JPEG ? @imagecreatefromjpeg($path) : @imagecreatefrompng($path);
        if (!$source) {
            return 0;
        }

        // Un JPEG de telephone porte son sens de lecture dans ses metadonnees, perdues a la recompression
        if ($type === IMAGETYPE_JPEG) {
            $source = self::applyOrientation($source, $path);
            $width = imagesx($source);
            $height = imagesy($source);
        }

        $ratio = min(1, self::MAX_SIDE / max($width, $height));
        $newWidth = max(1, (int) round($width * $ratio));
        $newHeight = max(1, (int) round($height * $ratio));

        $target = imagecreatetruecolor($newWidth, $newHeight);
        if ($type === IMAGETYPE_PNG) {
            imagealphablending($target, false);
            imagesavealpha($target, true);
        }
        imagecopyresampled($target, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
        imagedestroy($source);

        $temp = $path . '.opt';
        $written = $type === IMAGETYPE_JPEG
            ? imagejpeg($target, $temp, self::JPEG_QUALITY)
            : imagepng($target, $temp, 9);
        imagedestroy($target);

        $before = filesize($path);
        $after = $written ? filesize($temp) : false;
        // On ne remplace que si le gain est reel
        if (!$after || $after >= $before * 0.9) {
            @unlink($temp);
            return 0;
        }
        if ($dryRun) {
            @unlink($temp);
            return $before - $after;
        }

        return rename($temp, $path) ? $before - $after : 0;
    }

    private static function applyOrientation($image, string $path)
    {
        if (!function_exists('exif_read_data')) {
            return $image;
        }
        $orientation = (int) (@exif_read_data($path)['Orientation'] ?? 1);
        $angle = [3 => 180, 6 => -90, 8 => 90][$orientation] ?? 0;
        if (!$angle) {
            return $image;
        }
        $rotated = imagerotate($image, $angle, 0);
        if (!$rotated) {
            return $image;
        }
        imagedestroy($image);
        return $rotated;
    }
}
