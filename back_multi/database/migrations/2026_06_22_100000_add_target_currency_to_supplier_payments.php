<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('supplier_payments', function (Blueprint $table) {
            if (!Schema::hasColumn('supplier_payments', 'target_currency')) {
                $table->string('target_currency', 10)->nullable()->after('currency');
            }
            if (!Schema::hasColumn('supplier_payments', 'converted_amount')) {
                $table->decimal('converted_amount', 18, 2)->nullable()->after('amount_gnf');
            }
            if (!Schema::hasColumn('supplier_payments', 'conversion_rate')) {
                $table->decimal('conversion_rate', 18, 6)->nullable()->after('converted_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('supplier_payments', function (Blueprint $table) {
            foreach (['conversion_rate', 'converted_amount', 'target_currency'] as $column) {
                if (Schema::hasColumn('supplier_payments', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
