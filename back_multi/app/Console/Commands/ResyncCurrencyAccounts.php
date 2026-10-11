<?php

namespace App\Console\Commands;

use App\Models\Client;
use App\Models\Supplier;
use App\Services\AccountBalanceService;
use Illuminate\Console\Command;

/**
 * Recalcule tous les comptes-devises clients et fournisseurs a partir des
 * ecritures. A lancer une fois apres le deploiement, pour corriger les soldes
 * laisses faux par l'ancienne tenue par increments ; ensuite les comptes
 * restent a jour automatiquement.
 */
class ResyncCurrencyAccounts extends Command
{
    protected $signature = 'accounts:resync';

    protected $description = 'Recalcule les comptes-devises clients et fournisseurs depuis les ecritures';

    public function handle(): int
    {
        $clients = Client::withTrashed()->get(['id', 'tenant_id']);
        foreach ($clients as $client) {
            AccountBalanceService::syncClient((int) $client->id, (int) $client->tenant_id);
        }

        $suppliers = Supplier::withTrashed()->get(['id', 'tenant_id']);
        foreach ($suppliers as $supplier) {
            AccountBalanceService::syncSupplier((int) $supplier->id, (int) $supplier->tenant_id);
        }

        $this->info("Comptes recalcules : {$clients->count()} client(s), {$suppliers->count()} fournisseur(s).");

        return 0;
    }
}
