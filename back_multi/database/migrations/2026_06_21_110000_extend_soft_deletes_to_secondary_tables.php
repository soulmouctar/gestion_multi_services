<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Etend SoftDeletes aux entites metier secondaires :
 * conteneurs, immobilier, taxi, banque.
 */
return new class extends Migration
{
    private array $tables = [
        'containers',
        'container_arrivals',
        'container_sales',
        'bank_accounts',
        'bank_transactions',
        'buildings',
        'floors',
        'housing_units',
        'leases',
        'locations',
        'drivers',
        'taxis',
        'vehicle_expenses',
        'daily_payments',
    ];

    public function up(): void
    {
        foreach ($this->tables as $table) {
            if (Schema::hasTable($table) && !Schema::hasColumn($table, 'deleted_at')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->softDeletes();
                });
            }
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'deleted_at')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->dropSoftDeletes();
                });
            }
        }
    }
};
