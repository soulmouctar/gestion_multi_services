<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Consolide les types de clients en 4 catégories métier finales :
 *   TEXTILE, PNEUS, COSMETIQUES, MACHINE_A_COUDRE
 *
 * Mappings :
 *   GENERAL         -> TEXTILE   (cas le plus fréquent en pratique)
 *   CONTAINER_PAGNE -> TEXTILE   (les conteneurs pagne sont du textile)
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('clients')->where('client_type', 'GENERAL')->update(['client_type' => 'TEXTILE']);
        DB::table('clients')->where('client_type', 'CONTAINER_PAGNE')->update(['client_type' => 'TEXTILE']);
    }

    public function down(): void
    {
        // Pas de rollback fiable : on ne peut pas redistinguer GENERAL de CONTAINER_PAGNE.
    }
};
