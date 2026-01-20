<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateTaxisTable extends Migration
{
    public function up()
    {
        Schema::create('taxis', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->string('plate_number', 50);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('taxis');
    }
}
