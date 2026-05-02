<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('client_type', 50)
                ->default('GENERAL')
                ->after('tenant_id');
            $table->index(['tenant_id', 'client_type'], 'clients_tenant_type_idx');
        });

        DB::table('clients')
            ->whereNull('client_type')
            ->update(['client_type' => 'GENERAL']);
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropIndex('clients_tenant_type_idx');
            $table->dropColumn('client_type');
        });
    }
};
