<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class SuperAdminSeeder extends Seeder
{
    public function run()
    {
        $superAdmin = User::firstOrCreate(
            ['email' => 'superadmin@saas.com'],
            [
                'name' => 'Super Admin',
                'password' => Hash::make('password123'),
                'tenant_id' => null,
            ]
        );

        if (!$superAdmin->hasRole('SUPER_ADMIN')) {
            $superAdmin->assignRole('SUPER_ADMIN');
        }
    }
}
