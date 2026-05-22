<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('container_arrivals', function (Blueprint $table) {
            if (!Schema::hasColumn('container_arrivals', 'bale_quantity')) {
                $table->unsignedInteger('bale_quantity')->nullable()->after('total_quantity');
            }
        });

        if (Schema::hasColumn('container_arrivals', 'bale_quantity')) {
            DB::statement('UPDATE container_arrivals SET bale_quantity = total_quantity WHERE bale_quantity IS NULL');
        }
    }

    public function down(): void
    {
        Schema::table('container_arrivals', function (Blueprint $table) {
            if (Schema::hasColumn('container_arrivals', 'bale_quantity')) {
                $table->dropColumn('bale_quantity');
            }
        });
    }
};
