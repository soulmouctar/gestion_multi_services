<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateContainerPaymentsTable extends Migration
{
    public function up()
    {
        Schema::create('container_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
            $table->foreignId('container_id')->constrained()->onDelete('cascade');
            $table->enum('type', ['SUPPLIER', 'CLIENT']);
            $table->decimal('amount', 15, 2);
            $table->string('currency', 10)->default('GNF');
            $table->string('payment_method', 50);
            $table->date('payment_date');
            $table->string('reference', 100)->nullable();
            $table->text('description')->nullable();
            $table->enum('status', ['PENDING', 'PAID', 'PARTIAL', 'CANCELLED'])->default('PENDING');
            $table->foreignId('supplier_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('client_id')->nullable()->constrained()->onDelete('set null');
            $table->timestamps();
            
            $table->index(['tenant_id', 'type']);
            $table->index(['tenant_id', 'container_id']);
            $table->index(['tenant_id', 'status']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('container_payments');
    }
}
