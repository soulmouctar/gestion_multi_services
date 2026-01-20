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
                'is_active' => true,
                'icon' => 'chart-line',
                'permissions' => ['view', 'create', 'edit', 'delete']
            ],
            [
                'code' => 'CONTAINER',
                'name' => 'Module Conteneurs',
                'description' => 'Gestion des conteneurs et taux d\'intérêt',
                'is_active' => true,
                'icon' => 'layers',
                'permissions' => ['view', 'create', 'edit', 'delete', 'track']
            ],
            [
                'code' => 'IMMOBILIER',
                'name' => 'Module Immobilier',
                'description' => 'Gestion des locations, bâtiments et logements',
                'is_active' => false,
                'icon' => 'home',
                'permissions' => ['view', 'create', 'edit', 'delete', 'manage_contracts']
            ],
            [
                'code' => 'TAXI',
                'name' => 'Module Taxi',
                'description' => 'Gestion des taxis et chauffeurs',
                'is_active' => false,
                'icon' => 'car',
                'permissions' => ['view', 'create', 'edit', 'delete', 'assign_drivers']
            ],
            [
                'code' => 'FINANCE',
                'name' => 'Module Finance',
                'description' => 'Gestion des paiements et devises',
                'is_active' => true,
                'icon' => 'dollar-sign',
                'permissions' => ['view', 'create', 'edit', 'delete', 'approve']
            ],
            [
                'code' => 'STATISTICS',
                'name' => 'Module Statistiques',
                'description' => 'Rapports et analyses statistiques',
                'is_active' => true,
                'icon' => 'graph',
                'permissions' => ['view', 'export']
            ],
        ];

        foreach ($modules as $module) {
            Module::create($module);
        }
    }
}
