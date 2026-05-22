<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

class AddUsersModuleToModulesTable extends Migration
{
    public function up()
    {
        DB::table('modules')->updateOrInsert(
            ['code' => 'USERS'],
            [
                'name' => 'Utilisateurs',
                'description' => 'Gestion des utilisateurs du tenant et des accès',
                'is_active' => true,
                'icon' => 'cil-people',
                'permissions' => json_encode(['view', 'create', 'edit', 'delete']),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }

    public function down()
    {
        DB::table('modules')->where('code', 'USERS')->delete();
    }
}
