<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('email', 150)->nullable()->after('phone2');
            $table->string('photo', 255)->nullable()->after('email');
            $table->string('address', 255)->nullable()->after('photo');
            $table->text('notes')->nullable()->after('address');
        });

        Schema::table('suppliers', function (Blueprint $table) {
            $table->string('email', 150)->nullable()->after('name');
            $table->string('phone1', 50)->nullable()->after('email');
            $table->string('phone2', 50)->nullable()->after('phone1');
            $table->string('photo', 255)->nullable()->after('phone2');
            $table->string('address', 255)->nullable()->after('photo');
            $table->text('notes')->nullable()->after('address');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('supplier_id')->nullable()->after('client_id')
                  ->constrained('suppliers')->onDelete('set null');
            $table->index(['tenant_id', 'supplier_id'], 'idx_tenant_supplier');
        });
    }

    public function down()
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex('idx_tenant_supplier');
            $table->dropForeign(['supplier_id']);
            $table->dropColumn('supplier_id');
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn(['email', 'photo', 'address', 'notes']);
        });

        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn(['email', 'phone1', 'phone2', 'photo', 'address', 'notes']);
        });
    }
};
