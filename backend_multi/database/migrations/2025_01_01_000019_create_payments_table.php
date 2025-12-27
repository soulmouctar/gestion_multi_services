<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreatePaymentsTable extends Migration
{
    public function up()
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->enum('type', ['CLIENT', 'SUPPLIER', 'DEPOT', 'RETRAIT']);
            $table->enum('method', ['ORANGE_MONEY', 'VIREMENT', 'CHEQUE', 'ESPECES']);
            $table->decimal('amount', 12, 2);
            $table->string('currency', 10)->nullable();
            $table->string('proof', 255)->nullable();
            $table->date('payment_date');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('payments');
    }
}
