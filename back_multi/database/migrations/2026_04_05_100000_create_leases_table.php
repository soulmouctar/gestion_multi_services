<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leases', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('housing_unit_id');
            $table->string('renter_name', 150);
            $table->string('renter_phone', 50)->nullable();
            $table->string('renter_email', 150)->nullable();
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->decimal('monthly_rent', 15, 2)->default(0);
            $table->decimal('deposit_amount', 15, 2)->default(0);
            $table->string('currency', 10)->default('GNF');
            $table->tinyInteger('payment_day')->default(1)->comment('Day of month rent is due (1-28)');
            $table->enum('status', ['PENDING', 'ACTIVE', 'EXPIRED', 'TERMINATED'])->default('ACTIVE');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('housing_unit_id')->references('id')->on('housing_units')->onDelete('cascade');
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'housing_unit_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leases');
    }
};
