<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ajoute logo + adresse sur la table tenants.
 * Le logo est utilise dans tous les PDFs (factures, recus, ledger, rapports).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            if (!Schema::hasColumn('tenants', 'logo')) {
                $table->string('logo')->nullable()->after('phone');
            }
            if (!Schema::hasColumn('tenants', 'address')) {
                $table->string('address')->nullable()->after('phone');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            if (Schema::hasColumn('tenants', 'logo')) $table->dropColumn('logo');
            if (Schema::hasColumn('tenants', 'address')) $table->dropColumn('address');
        });
    }
};
