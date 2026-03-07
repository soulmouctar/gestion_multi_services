<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
            $table->foreignId('taxi_assignment_id')->constrained()->onDelete('cascade');
            $table->foreignId('driver_id')->constrained()->onDelete('cascade');
            $table->foreignId('taxi_id')->constrained()->onDelete('cascade');
            $table->date('payment_date');
            $table->decimal('expected_amount', 15, 2)->default(0);
            $table->decimal('paid_amount', 15, 2)->default(0);
            $table->decimal('balance', 15, 2)->default(0);
            $table->enum('status', ['PAID', 'PARTIAL', 'UNPAID', 'EXCUSED'])->default('UNPAID');
            $table->text('notes')->nullable();
            $table->timestamps();
            
            $table->unique(['taxi_assignment_id', 'payment_date']);
            $table->index(['tenant_id', 'payment_date']);
            $table->index(['driver_id', 'payment_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_payments');
    }
};
