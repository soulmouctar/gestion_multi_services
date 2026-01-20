<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateHousingUnitsTable extends Migration
{
    public function up()
    {
        Schema::create('housing_units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('floor_id')->constrained('floors')->onDelete('cascade');
            $table->foreignId('unit_configuration_id')->nullable()->constrained('unit_configurations')->onDelete('set null');
            $table->decimal('rent_amount', 12, 2)->default(0);
            $table->enum('status', ['LIBRE', 'OCCUPE'])->default('LIBRE');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('housing_units');
    }
}
