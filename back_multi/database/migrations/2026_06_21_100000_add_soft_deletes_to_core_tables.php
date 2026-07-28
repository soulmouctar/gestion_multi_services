<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Active SoftDeletes sur les entites metier critiques.
 * Une suppression rangera l'element dans la corbeille (deleted_at != null).
 * Restauration possible via le model SoftDeletes::restore().
 */
return new class extends Migration
{
    private array $tables = [
        'products',
        'clients',
        'suppliers',
        'invoices',
        'payments',
        'product_categories',
        'units',
        'personal_expenses',
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
