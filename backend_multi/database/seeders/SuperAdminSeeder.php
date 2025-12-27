<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class SuperAdminSeeder extends Seeder
{
    public function run()
    {
        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@saas.com',
            'password' => Hash::make('password123'),
            'tenant_id' => null,
        ]);

        $superAdmin->assignRole('SUPER_ADMIN');
    }
}
