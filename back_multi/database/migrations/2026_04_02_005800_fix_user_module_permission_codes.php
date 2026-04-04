<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Fix incorrect module codes in user_module_permissions table
        // Map old incorrect codes to correct codes
        $codeMapping = [
            'COMMERCIAL' => 'COMMERCE',
            'CONTAINERS' => 'CONTAINER',
            'RENTAL' => 'IMMOBILIER',
            // FINANCE, TAXI, STATISTICS are already correct
        ];

        foreach ($codeMapping as $oldCode => $newCode) {
            DB::table('user_module_permissions')
                ->where('module_code', $oldCode)
                ->update(['module_code' => $newCode]);
        }

        // Also update module_name to match
        DB::table('user_module_permissions')
            ->where('module_code', 'COMMERCE')
            ->update(['module_name' => 'Module Commerce']);

        DB::table('user_module_permissions')
            ->where('module_code', 'CONTAINER')
            ->update(['module_name' => 'Gestion Conteneurs']);

        DB::table('user_module_permissions')
            ->where('module_code', 'IMMOBILIER')
            ->update(['module_name' => 'Location Immobilière']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reverse the mapping
        $codeMapping = [
            'COMMERCE' => 'COMMERCIAL',
            'CONTAINER' => 'CONTAINERS',
            'IMMOBILIER' => 'RENTAL',
        ];

        foreach ($codeMapping as $newCode => $oldCode) {
            DB::table('user_module_permissions')
                ->where('module_code', $newCode)
                ->update(['module_code' => $oldCode]);
        }
    }
};
