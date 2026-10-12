<?php

namespace App\Console\Commands;

use App\Support\ImageOptimizer;
use Illuminate\Console\Command;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

class OptimizeUploads extends Command
{
    protected $signature = 'uploads:optimize
        {--apply : Remplace reellement les fichiers (sans cette option, simple estimation)}
        {--min-kb=300 : Ignore les images plus legeres que ce poids}';

    protected $description = 'Allege les photos deja envoyees (1600 px maximum, recompression), sans changer leurs noms';

    public function handle(): int
    {
        $root = public_path('uploads');
        if (!is_dir($root)) {
            $this->warn('Aucun dossier uploads.');
            return self::SUCCESS;
        }

        $apply = (bool) $this->option('apply');
        $minBytes = (int) $this->option('min-kb') * 1024;
        $count = 0;
        $saved = 0;

        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, RecursiveDirectoryIterator::SKIP_DOTS));
        foreach ($files as $file) {
            if (!$file->isFile() || $file->getSize() < $minBytes) {
                continue;
            }
            $before = $file->getSize();
            $gain = ImageOptimizer::shrink($file->getPathname(), !$apply);
            if ($gain > 0) {
                $count++;
                $saved += $gain;
                $this->line(sprintf(
                    '%s : %d Ko → %d Ko',
                    str_replace($root . DIRECTORY_SEPARATOR, '', $file->getPathname()),
                    $before / 1024,
                    ($before - $gain) / 1024
                ));
            }
        }

        $this->info(sprintf(
            '%d photo(s) %s, %.1f Mo %s.',
            $count,
            $apply ? 'allegee(s)' : 'a alleger',
            $saved / 1048576,
            $apply ? 'liberes' : 'a gagner (relancez avec --apply pour appliquer)'
        ));

        return self::SUCCESS;
    }
}
