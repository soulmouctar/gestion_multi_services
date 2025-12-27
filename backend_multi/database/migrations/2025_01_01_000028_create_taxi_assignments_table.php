<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateTaxiAssignmentsTable extends Migration
{
    public function up()
    {
        Schema::create('taxi_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('taxi_id')->constrained('taxis')->onDelete('cascade');
            $table->foreignId('driver_id')->constrained('drivers')->onDelete('cascade');
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('taxi_assignments');
    }
}
