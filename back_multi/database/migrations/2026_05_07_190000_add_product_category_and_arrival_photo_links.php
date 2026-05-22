<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddProductCategoryAndArrivalPhotoLinks extends Migration
{
    public function up(): void
    {
        Schema::table('container_arrivals', function (Blueprint $table) {
            if (!Schema::hasColumn('container_arrivals', 'product_category_id')) {
                $table->foreignId('product_category_id')
                    ->nullable()
                    ->after('product_type')
                    ->constrained('product_categories')
                    ->nullOnDelete();
            }
        });

        Schema::table('container_photos', function (Blueprint $table) {
            if (!Schema::hasColumn('container_photos', 'container_arrival_id')) {
                $table->foreignId('container_arrival_id')
                    ->nullable()
                    ->after('container_id')
                    ->constrained('container_arrivals')
                    ->cascadeOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('container_photos', function (Blueprint $table) {
            if (Schema::hasColumn('container_photos', 'container_arrival_id')) {
                $table->dropConstrainedForeignId('container_arrival_id');
            }
        });

        Schema::table('container_arrivals', function (Blueprint $table) {
            if (Schema::hasColumn('container_arrivals', 'product_category_id')) {
                $table->dropConstrainedForeignId('product_category_id');
            }
        });
    }
}
