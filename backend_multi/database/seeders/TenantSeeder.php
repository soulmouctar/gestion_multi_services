<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Tenant;
use App\Models\Module;

class TenantSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        // Création des tenants avec de vraies données
        $tenants = [
            [
                'name' => 'Alpha Corporation',
                'email' => 'contact@alpha.com',
                'phone' => '+224 622 123 456',
                'subscription_status' => 'ACTIVE',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Beta Solutions',
                'email' => 'info@beta.com',
                'phone' => '+224 623 789 012',
                'subscription_status' => 'ACTIVE',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Gamma Services',
                'email' => 'hello@gamma.com',
                'phone' => '+224 624 345 678',
                'subscription_status' => 'SUSPENDED',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Delta Technologies',
                'email' => 'admin@delta-tech.com',
                'phone' => '+224 625 456 789',
                'subscription_status' => 'ACTIVE',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Epsilon Group',
                'email' => 'contact@epsilon-group.com',
                'phone' => '+224 626 567 890',
                'subscription_status' => 'ACTIVE',
                'created_at' => now(),
                'updated_at' => now(),
            ]
        ];

        // Insérer les tenants
        foreach ($tenants as $tenantData) {
            $tenant = Tenant::create($tenantData);
            
            // Assigner des modules à chaque tenant
            $this->assignModulesToTenant($tenant);
        }
    }

    private function assignModulesToTenant(Tenant $tenant)
    {
        $modules = Module::all();
        
        // Assigner des modules aléatoires à chaque tenant
        $randomModules = $modules->random(rand(1, 3));
        
        foreach ($randomModules as $module) {
            $tenant->modules()->attach($module->id, [
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
