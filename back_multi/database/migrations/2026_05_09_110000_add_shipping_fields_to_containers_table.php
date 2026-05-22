<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('containers', function (Blueprint $table) {
            if (!Schema::hasColumn('containers', 'shipping_number')) {
                $table->string('shipping_number', 100)->nullable()->after('container_number');
            }
            if (!Schema::hasColumn('containers', 'bl_number')) {
                $table->string('bl_number', 100)->nullable()->after('shipping_number');
            }
            if (!Schema::hasColumn('containers', 'capacity')) {
                $table->unsignedInteger('capacity')->nullable()->after('bl_number');
            }
            if (!Schema::hasColumn('containers', 'delivery_status')) {
                $table->string('delivery_status', 20)->default('NON_LIVRE')->after('capacity');
            }
            if (!Schema::hasColumn('containers', 'entry_port')) {
                $table->string('entry_port', 100)->nullable()->after('delivery_status');
            }
            if (!Schema::hasColumn('containers', 'entry_date')) {
                $table->date('entry_date')->nullable()->after('entry_port');
            }
            if (!Schema::hasColumn('containers', 'expected_delivery_date')) {
                $table->date('expected_delivery_date')->nullable()->after('entry_date');
            }
        });

        if (Schema::hasColumn('containers', 'capacity')) {
            DB::statement('UPDATE containers SET capacity = COALESCE(capacity_max, capacity_min, 0) WHERE capacity IS NULL');
        }
    }

    public function down(): void
    {
        Schema::table('containers', function (Blueprint $table) {
            foreach (['shipping_number', 'bl_number', 'capacity', 'delivery_status', 'entry_port', 'entry_date', 'expected_delivery_date'] as $column) {
                if (Schema::hasColumn('containers', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
