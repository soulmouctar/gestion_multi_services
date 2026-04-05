<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\UserModulePermissionService;
use Illuminate\Console\Command;

class SyncAdminModulePermissions extends Command
{
    protected $signature   = 'permissions:sync-admins {--force : Réinitialiser même si des permissions existent déjà}';
    protected $description = 'Accorde tous les modules actifs du tenant aux utilisateurs ADMIN qui n\'en ont pas encore.';

    public function __construct(private readonly UserModulePermissionService $service)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $force = $this->option('force');

        $admins = User::whereHas('roles', fn ($q) => $q->where('name', 'ADMIN'))
            ->whereNotNull('tenant_id')
            ->with('roles')
            ->get();

        if ($admins->isEmpty()) {
            $this->info('Aucun utilisateur ADMIN avec un tenant trouvé.');
            return 0;
        }

        $this->info("Traitement de {$admins->count()} administrateur(s)...");
        $bar = $this->output->createProgressBar($admins->count());
        $bar->start();

        foreach ($admins as $admin) {
            $this->service->grantAllTenantModules($admin);
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info('Synchronisation terminée.');

        return 0;
    }
}
