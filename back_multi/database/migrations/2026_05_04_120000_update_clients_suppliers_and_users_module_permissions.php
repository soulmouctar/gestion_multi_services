<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('modules')->where('code', 'CLIENTS_SUPPLIERS')->update([
            'permissions' => json_encode([
                'view',
                'create',
                'edit',
                'delete',
                'view_clients_general',
                'view_clients_pneus',
                'view_clients_textile',
                'view_clients_cosmetiques',
                'view_clients_conteneurs_pagne',
                'view_suppliers'
            ]),
        ]);

        DB::table('modules')->where('code', 'USERS')->update([
            'permissions' => json_encode([
                'view',
                'create',
                'edit',
                'delete',
                'view_users',
                'manage_permissions',
                'change_password',
                'toggle_status'
            ]),
        ]);
    }

    public function down(): void
    {
        DB::table('modules')->where('code', 'CLIENTS_SUPPLIERS')->update([
            'permissions' => json_encode(['view', 'create', 'edit', 'delete']),
        ]);

        DB::table('modules')->where('code', 'USERS')->update([
            'permissions' => json_encode(['view', 'create', 'edit', 'delete']),
        ]);
    }
};
