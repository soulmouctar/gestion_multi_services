<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Supplier;
use App\Models\Tenant;
use App\Models\Unit;
use Illuminate\Database\Seeder;

/**
 * Donnees de demonstration : pour chaque tenant existant, cree des
 * categories / unites / clients / fournisseurs / produits realistes
 * type T.B.SALL (textile / cosmetiques / pneus).
 *
 * Idempotent : utilise firstOrCreate pour ne rien doubler.
 */
class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $tenants = Tenant::all();
        if ($tenants->isEmpty()) {
            $this->command->warn('Aucun tenant. Lance TenantSeeder d\'abord.');
            return;
        }

        foreach ($tenants as $tenant) {
            $this->seedForTenant($tenant);
        }
    }

    private function seedForTenant(Tenant $tenant): void
    {
        // ── Unites de mesure (globales) ──
        $unitPiece  = Unit::firstOrCreate(['name' => 'Pièce'],  ['conversion_value' => 1]);
        $unitCarton = Unit::firstOrCreate(['name' => 'Carton'], ['conversion_value' => 12]);

        // ── Categories (globales) ──
        $catTextile = ProductCategory::firstOrCreate(['name' => 'Textile']);
        $catCosmet  = ProductCategory::firstOrCreate(['name' => 'Cosmétiques']);
        $catPneus   = ProductCategory::firstOrCreate(['name' => 'Pneus']);

        // ── Fournisseurs ──
        $supAicha = Supplier::firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Aïcha Bangoura'],
            ['phone1' => '+224 622 000 001', 'address' => 'Madina, Conakry', 'category' => 'TEXTILE', 'currency' => 'GNF']
        );
        $supHadja = Supplier::firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Hadja Diaraye'],
            ['phone1' => '+224 622 000 002', 'address' => 'Marché Niger', 'category' => 'TEXTILE', 'currency' => 'GNF']
        );
        Supplier::firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Virender Singh'],
            ['phone1' => '+224 622 000 003', 'address' => 'Kaloum', 'category' => 'COSMETIQUES', 'currency' => 'USD']
        );

        // ── Produits ──
        Product::firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Phoenix Aïcha'],
            [
                'sku' => 'TX-PHX-AICHA-T' . $tenant->id,
                'description' => 'Pagne Phoenix de la balle Aïcha',
                'product_category_id' => $catTextile->id,
                'unit_id' => $unitCarton->id,
                'purchase_price' => 4500000,
                'selling_price' => 5000000,
                'carton_purchase_price' => 54000000,
                'carton_selling_price' => 60000000,
                'units_per_carton' => 12,
                'stock_quantity' => 25,
                'low_stock_threshold' => 5,
                'status' => 'ACTIVE',
            ]
        );

        Product::firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Phoenix Hadja Diaraye'],
            [
                'sku' => 'TX-PHX-HADJA-T' . $tenant->id,
                'description' => 'Pagne Phoenix de la balle Hadja',
                'product_category_id' => $catTextile->id,
                'unit_id' => $unitCarton->id,
                'purchase_price' => 4700000,
                'selling_price' => 5130000,
                'carton_purchase_price' => 56000000,
                'carton_selling_price' => 61500000,
                'units_per_carton' => 12,
                'stock_quantity' => 18,
                'low_stock_threshold' => 5,
                'status' => 'ACTIVE',
            ]
        );

        Product::firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Parfum NIVEA'],
            [
                'sku' => 'CO-NIV-T' . $tenant->id,
                'description' => 'Parfum NIVEA 100ml',
                'product_category_id' => $catCosmet->id,
                'unit_id' => $unitPiece->id,
                'purchase_price' => 30000,
                'selling_price' => 35000,
                'carton_purchase_price' => 720000,
                'carton_selling_price' => 840000,
                'units_per_carton' => 24,
                'stock_quantity' => 120,
                'low_stock_threshold' => 20,
                'status' => 'ACTIVE',
            ]
        );

        Product::firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Pneu Michelin 175/65 R14'],
            [
                'sku' => 'PN-MIC-175-T' . $tenant->id,
                'description' => 'Pneu Michelin Energy XM2',
                'product_category_id' => $catPneus->id,
                'unit_id' => $unitPiece->id,
                'purchase_price' => 450000,
                'selling_price' => 550000,
                'stock_quantity' => 32,
                'low_stock_threshold' => 8,
                'status' => 'ACTIVE',
            ]
        );

        Product::firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Machine à coudre Singer'],
            [
                'sku' => 'MC-SGR-T' . $tenant->id,
                'description' => 'Machine à coudre Singer 8280',
                'product_category_id' => $catTextile->id,
                'unit_id' => $unitPiece->id,
                'purchase_price' => 1500000,
                'selling_price' => 1800000,
                'stock_quantity' => 7,
                'low_stock_threshold' => 2,
                'status' => 'ACTIVE',
            ]
        );

        // ── Clients de demo (style T.B.SALL) ──
        $clients = [
            ['El Mamadou Bah',       'TEXTILE',         '+224 622 100 001'],
            ['Tanti Mami',           'TEXTILE',         '+224 622 100 002'],
            ['Boubacar',             'TEXTILE',         '+224 622 100 003'],
            ['Alhassane Kann',       'TEXTILE',         '+224 622 100 004'],
            ['Aïcha Cosmétique',     'COSMETIQUES',     '+224 622 100 005'],
            ['Mamadou Pneus',        'PNEUS',           '+224 622 100 006'],
            ['Atelier Diallo',       'MACHINE_A_COUDRE','+224 622 100 007'],
        ];
        foreach ($clients as [$name, $type, $phone]) {
            Client::firstOrCreate(
                ['tenant_id' => $tenant->id, 'name' => $name],
                ['client_type' => $type, 'phone1' => $phone, 'address' => 'Conakry']
            );
        }
    }
}
