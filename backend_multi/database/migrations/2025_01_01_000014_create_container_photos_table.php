<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateContainerPhotosTable extends Migration
{
    public function up()
    {
        Schema::create('container_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('container_id')->constrained('containers')->onDelete('cascade');
            $table->string('image_path', 255);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('container_photos');
    }
}
