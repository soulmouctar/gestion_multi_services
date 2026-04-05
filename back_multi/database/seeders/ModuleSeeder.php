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
                'name' => 'Gestion Commerciale',
                'description' => 'Gestion des produits, clients, fournisseurs et factures',
                'is_active' => true,
                'icon' => 'cil-cart',
                'permissions' => ['view', 'create', 'edit', 'delete']
            ],
            [
                'code' => 'CLIENTS_SUPPLIERS',
                'name' => 'Clients & Fournisseurs',
                'description' => 'Gestion des clients et fournisseurs',
                'is_active' => true,
                'icon' => 'cil-people',
                'permissions' => ['view', 'create', 'edit', 'delete']
            ],
            [
                'code' => 'PRODUCTS_STOCK',
                'name' => 'Produits & Stock',
                'description' => 'Gestion des produits et inventaire',
                'is_active' => true,
                'icon' => 'cil-box',
                'permissions' => ['view', 'create', 'edit', 'delete', 'manage_inventory']
            ],
            [
                'code' => 'CONTAINER',
                'name' => 'Gestion Conteneurs',
                'description' => 'Gestion des conteneurs et taux d\'intérêt',
                'is_active' => true,
                'icon' => 'cil-truck',
                'permissions' => ['view', 'create', 'edit', 'delete', 'track']
            ],
            [
                'code' => 'RENTAL',
                'name' => 'Location Immobilière',
                'description' => 'Gestion des locations, bâtiments et logements',
                'is_active' => true,
                'icon' => 'cil-home',
                'permissions' => ['view', 'create', 'edit', 'delete', 'manage_contracts']
            ],
            [
                'code' => 'TAXI',
                'name' => 'Gestion Taxi',
                'description' => 'Gestion des taxis et chauffeurs',
                'is_active' => true,
                'icon' => 'cil-car-alt',
                'permissions' => ['view', 'create', 'edit', 'delete', 'assign_drivers']
            ],
            [
                'code' => 'FINANCE',
                'name' => 'Gestion Financière',
                'description' => 'Gestion des paiements, devises et rapports financiers',
                'is_active' => true,
                'icon' => 'cil-dollar',
                'permissions' => ['view', 'create', 'edit', 'delete', 'approve', 'export']
            ],
            [
                'code' => 'STATISTICS',
                'name' => 'Statistiques',
                'description' => 'Rapports et analyses statistiques',
                'is_active' => true,
                'icon' => 'cil-chart-pie',
                'permissions' => ['view', 'export']
            ],
            [
                'code' => 'EXPENSES',
                'name' => 'Dépenses Personnelles',
                'description' => 'Suivi des dépenses personnelles par catégorie',
                'is_active' => true,
                'icon' => 'cil-wallet',
                'permissions' => ['view', 'create', 'edit', 'delete']
            ],
        ];

        foreach ($modules as $module) {
            Module::updateOrCreate(
                ['code' => $module['code']],
                $module
            );
        }
    }
}
