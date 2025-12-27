<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RolePermissionSeeder extends Seeder
{
    public function run()
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Create permissions
        $permissions = [
            // Tenant permissions
            'tenant.view', 'tenant.create', 'tenant.update', 'tenant.delete',
            // User permissions
            'user.view', 'user.create', 'user.update', 'user.delete',
            // Module permissions
            'module.view', 'module.create', 'module.update', 'module.delete',
            // Subscription permissions
            'subscription.view', 'subscription.create', 'subscription.update', 'subscription.delete',
            // Product permissions
            'product.view', 'product.create', 'product.update', 'product.delete',
            // Client permissions
            'client.view', 'client.create', 'client.update', 'client.delete',
            // Supplier permissions
            'supplier.view', 'supplier.create', 'supplier.update', 'supplier.delete',
            // Invoice permissions
            'invoice.view', 'invoice.create', 'invoice.update', 'invoice.delete',
            // Payment permissions
            'payment.view', 'payment.create', 'payment.update', 'payment.delete',
            // Container permissions
            'container.view', 'container.create', 'container.update', 'container.delete',
            // Location permissions
            'location.view', 'location.create', 'location.update', 'location.delete',
            // Building permissions
            'building.view', 'building.create', 'building.update', 'building.delete',
            // Housing Unit permissions
            'housing_unit.view', 'housing_unit.create', 'housing_unit.update', 'housing_unit.delete',
            // Driver permissions
            'driver.view', 'driver.create', 'driver.update', 'driver.delete',
            // Taxi permissions
            'taxi.view', 'taxi.create', 'taxi.update', 'taxi.delete',
        ];

        foreach ($permissions as $permission) {
            Permission::create(['name' => $permission]);
        }

        // Create roles and assign permissions
        $superAdminRole = Role::create(['name' => 'SUPER_ADMIN']);
        $superAdminRole->givePermissionTo(Permission::all());

        $adminRole = Role::create(['name' => 'ADMIN']);
        $adminRole->givePermissionTo([
            'user.view', 'user.create', 'user.update',
            'product.view', 'product.create', 'product.update', 'product.delete',
            'client.view', 'client.create', 'client.update', 'client.delete',
            'supplier.view', 'supplier.create', 'supplier.update', 'supplier.delete',
            'invoice.view', 'invoice.create', 'invoice.update', 'invoice.delete',
            'payment.view', 'payment.create', 'payment.update', 'payment.delete',
            'container.view', 'container.create', 'container.update', 'container.delete',
            'location.view', 'location.create', 'location.update', 'location.delete',
            'building.view', 'building.create', 'building.update', 'building.delete',
            'housing_unit.view', 'housing_unit.create', 'housing_unit.update', 'housing_unit.delete',
            'driver.view', 'driver.create', 'driver.update', 'driver.delete',
            'taxi.view', 'taxi.create', 'taxi.update', 'taxi.delete',
        ]);

        $userRole = Role::create(['name' => 'USER']);
        $userRole->givePermissionTo([
            'product.view',
            'client.view',
            'supplier.view',
            'invoice.view',
            'payment.view',
            'container.view',
            'location.view',
            'building.view',
            'housing_unit.view',
            'driver.view',
            'taxi.view',
        ]);
    }
}
