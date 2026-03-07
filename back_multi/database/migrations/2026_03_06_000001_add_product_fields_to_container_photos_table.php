<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddProductFieldsToContainerPhotosTable extends Migration
{
    public function up()
    {
        Schema::table('container_photos', function (Blueprint $table) {
            $table->foreignId('product_id')->nullable()->after('container_id')->constrained('products')->onDelete('set null');
            $table->text('description')->nullable()->after('image_path');
        });
    }

    public function down()
    {
        Schema::table('container_photos', function (Blueprint $table) {
            $table->dropForeign(['product_id']);
            $table->dropColumn(['product_id', 'description']);
        });
    }
}
