<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bank_transactions', function (Blueprint $table) {
            if (!Schema::hasColumn('bank_transactions', 'exchange_rate')) {
                $table->decimal('exchange_rate', 15, 4)->default(1)->after('currency');
            }

            if (!Schema::hasColumn('bank_transactions', 'amount_gnf')) {
                $table->decimal('amount_gnf', 15, 2)->nullable()->after('exchange_rate');
            }
        });

        DB::table('bank_transactions')
            ->whereNull('amount_gnf')
            ->update([
                'exchange_rate' => DB::raw('COALESCE(exchange_rate, 1)'),
                'amount_gnf' => DB::raw('amount * COALESCE(exchange_rate, 1)'),
            ]);
    }

    public function down(): void
    {
        Schema::table('bank_transactions', function (Blueprint $table) {
            if (Schema::hasColumn('bank_transactions', 'amount_gnf')) {
                $table->dropColumn('amount_gnf');
            }

            if (Schema::hasColumn('bank_transactions', 'exchange_rate')) {
                $table->dropColumn('exchange_rate');
            }
        });
    }
};
