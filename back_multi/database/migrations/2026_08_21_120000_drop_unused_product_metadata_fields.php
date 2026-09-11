<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            foreach (['notes', 'supplier_info', 'dimensions', 'weight'] as $column) {
                if (Schema::hasColumn('products', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'weight')) {
                $table->decimal('weight', 8, 2)->nullable()->after('barcode');
            }
            if (!Schema::hasColumn('products', 'dimensions')) {
                $table->string('dimensions', 100)->nullable()->after('weight');
            }
            if (!Schema::hasColumn('products', 'supplier_info')) {
                $table->text('supplier_info')->nullable()->after('dimensions');
            }
            if (!Schema::hasColumn('products', 'notes')) {
                $table->text('notes')->nullable()->after('supplier_info');
            }
        });
    }
};
