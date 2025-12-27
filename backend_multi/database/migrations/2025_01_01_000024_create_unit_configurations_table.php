<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateUnitConfigurationsTable extends Migration
{
    public function up()
    {
        Schema::create('unit_configurations', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->integer('bedrooms')->default(0);
            $table->integer('living_rooms')->default(0);
            $table->integer('bathrooms')->default(0);
            $table->boolean('has_terrace')->default(false);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('unit_configurations');
    }
}
