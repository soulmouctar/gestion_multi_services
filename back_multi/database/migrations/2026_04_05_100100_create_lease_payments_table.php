<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lease_payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('lease_id');
            $table->string('period_month', 7)->comment('YYYY-MM');
            $table->decimal('amount', 15, 2);
            $table->string('currency', 10)->default('GNF');
            $table->date('payment_date');
            $table->string('payment_method', 50)->default('ESPECES');
            $table->string('reference', 100)->nullable();
            $table->enum('status', ['PAID', 'LATE', 'PENDING'])->default('PAID');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('lease_id')->references('id')->on('leases')->onDelete('cascade');
            $table->index(['tenant_id', 'lease_id']);
            $table->index(['tenant_id', 'period_month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lease_payments');
    }
};
