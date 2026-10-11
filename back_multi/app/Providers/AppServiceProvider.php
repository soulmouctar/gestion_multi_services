<?php

namespace App\Providers;

use App\Services\AccountBalanceService;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        //
    }

    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot()
    {
        $this->keepCurrencyAccountsInSync();
    }

    /**
     * Toute ecriture qui touche la situation d'un client ou d'un fournisseur
     * (creation, modification, suppression, restauration depuis la corbeille)
     * declenche le recalcul de ses comptes-devises. Aucun ecran ne peut donc
     * laisser un solde desynchronise.
     *
     * Les suppressions en masse par requete (sans evenement Eloquent) appellent
     * AccountBalanceService explicitement.
     */
    private function keepCurrencyAccountsInSync(): void
    {
        $clientSources = [
            \App\Models\Invoice::class,
            \App\Models\Payment::class,
            \App\Models\ContainerSale::class,
            \App\Models\ContainerSalePayment::class,
            \App\Models\ClientAdvance::class,
            \App\Models\ClientInterestCharge::class,
            \App\Models\ProductReturn::class,
        ];
        $supplierSources = [
            \App\Models\ContainerArrival::class,
            \App\Models\SupplierPurchase::class,
            \App\Models\SupplierPayment::class,
        ];

        $register = function (array $classes, string $ownerKey, callable $sync): void {
            foreach ($classes as $class) {
                foreach (['saved', 'deleted', 'restored'] as $event) {
                    Event::listen("eloquent.{$event}: {$class}", function ($model) use ($ownerKey, $sync) {
                        // Le proprietaire d'origine aussi, si l'ecriture a change de tiers
                        $owners = array_unique(array_filter([
                            $model->getAttribute($ownerKey),
                            $model->getOriginal($ownerKey),
                        ]));
                        foreach ($owners as $ownerId) {
                            $sync((int) $ownerId, (int) $model->getAttribute('tenant_id'));
                        }
                    });
                }
            }
        };

        $register($clientSources, 'client_id', [AccountBalanceService::class, 'syncClient']);
        $register($supplierSources, 'supplier_id', [AccountBalanceService::class, 'syncSupplier']);
    }
}
