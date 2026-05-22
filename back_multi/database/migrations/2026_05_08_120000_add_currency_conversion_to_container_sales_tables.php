<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('container_sales', function (Blueprint $table) {
            if (!Schema::hasColumn('container_sales', 'exchange_rate')) {
                $table->decimal('exchange_rate', 15, 4)->default(1)->after('currency');
            }
            if (!Schema::hasColumn('container_sales', 'sale_price_gnf')) {
                $table->decimal('sale_price_gnf', 15, 2)->nullable()->after('exchange_rate');
            }
            if (!Schema::hasColumn('container_sales', 'amount_paid_gnf')) {
                $table->decimal('amount_paid_gnf', 15, 2)->default(0)->after('amount_paid');
            }
            if (!Schema::hasColumn('container_sales', 'remaining_amount_gnf')) {
                $table->decimal('remaining_amount_gnf', 15, 2)->nullable()->after('remaining_amount');
            }
        });

        Schema::table('container_sale_payments', function (Blueprint $table) {
            if (!Schema::hasColumn('container_sale_payments', 'exchange_rate')) {
                $table->decimal('exchange_rate', 15, 4)->default(1)->after('currency');
            }
            if (!Schema::hasColumn('container_sale_payments', 'amount_gnf')) {
                $table->decimal('amount_gnf', 15, 2)->nullable()->after('amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('container_sale_payments', function (Blueprint $table) {
            if (Schema::hasColumn('container_sale_payments', 'amount_gnf')) {
                $table->dropColumn('amount_gnf');
            }
            if (Schema::hasColumn('container_sale_payments', 'exchange_rate')) {
                $table->dropColumn('exchange_rate');
            }
        });

        Schema::table('container_sales', function (Blueprint $table) {
            if (Schema::hasColumn('container_sales', 'remaining_amount_gnf')) {
                $table->dropColumn('remaining_amount_gnf');
            }
            if (Schema::hasColumn('container_sales', 'amount_paid_gnf')) {
                $table->dropColumn('amount_paid_gnf');
            }
            if (Schema::hasColumn('container_sales', 'sale_price_gnf')) {
                $table->dropColumn('sale_price_gnf');
            }
            if (Schema::hasColumn('container_sales', 'exchange_rate')) {
                $table->dropColumn('exchange_rate');
            }
        });
    }
};
