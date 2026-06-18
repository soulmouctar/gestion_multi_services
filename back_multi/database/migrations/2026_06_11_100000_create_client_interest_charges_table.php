<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_interest_charges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('principal_amount', 18, 2)->default(0);
            $table->decimal('interest_rate', 6, 3)->default(0);
            $table->decimal('amount', 18, 2);
            $table->decimal('paid_amount', 18, 2)->default(0);
            $table->string('currency', 10)->default('GNF');
            $table->date('charge_date');
            $table->enum('status', ['PENDING', 'PARTIAL', 'PAID', 'CANCELLED'])->default('PENDING');
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'client_id']);
            $table->index(['charge_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_interest_charges');
    }
};
