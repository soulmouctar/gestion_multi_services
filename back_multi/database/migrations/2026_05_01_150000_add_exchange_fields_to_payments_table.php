<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->decimal('exchange_rate', 12, 4)
                ->default(1)
                ->after('currency');
            $table->decimal('amount_gnf', 15, 2)
                ->default(0)
                ->after('exchange_rate');
        });

        DB::table('payments')->update([
            'exchange_rate' => 1,
            'amount_gnf' => DB::raw("CASE WHEN currency IS NULL OR currency = 'GNF' THEN amount ELSE amount END"),
        ]);
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['exchange_rate', 'amount_gnf']);
        });
    }
};
