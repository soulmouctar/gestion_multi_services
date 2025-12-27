<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateContainersTable extends Migration
{
    public function up()
    {
        Schema::create('containers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->string('container_number', 50);
            $table->integer('capacity_min')->nullable();
            $table->integer('capacity_max')->nullable();
            $table->decimal('interest_rate', 5, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('containers');
    }
}
