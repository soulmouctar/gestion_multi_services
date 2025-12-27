<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Module;

class ModuleSeeder extends Seeder
{
    public function run()
    {
        $modules = [
            [
                'code' => 'COMMERCE',
                'name' => 'Module Commerce',
                'description' => 'Gestion des produits, clients, fournisseurs et factures',
            ],
            [
                'code' => 'CONTAINER',
                'name' => 'Module Conteneurs',
                'description' => 'Gestion des conteneurs et taux d\'intérêt',
            ],
            [
                'code' => 'IMMOBILIER',
                'name' => 'Module Immobilier',
                'description' => 'Gestion des locations, bâtiments et logements',
            ],
            [
                'code' => 'TAXI',
                'name' => 'Module Taxi',
                'description' => 'Gestion des taxis et chauffeurs',
            ],
            [
                'code' => 'FINANCE',
                'name' => 'Module Finance',
                'description' => 'Gestion des paiements et devises',
            ],
        ];

        foreach ($modules as $module) {
            Module::create($module);
        }
    }
}
