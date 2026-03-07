<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
            $table->foreignId('taxi_id')->constrained()->onDelete('cascade');
            $table->foreignId('driver_id')->nullable()->constrained()->onDelete('set null');
            $table->date('expense_date');
            $table->enum('expense_type', [
                'CARBURANT',
                'ENTRETIEN',
                'REPARATION',
                'ASSURANCE',
                'VISITE_TECHNIQUE',
                'AMENDE',
                'LAVAGE',
                'AUTRE'
            ]);
            $table->decimal('amount', 15, 2);
            $table->string('description', 255)->nullable();
            $table->string('receipt_number', 50)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            
            $table->index(['tenant_id', 'expense_date']);
            $table->index(['taxi_id', 'expense_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_expenses');
    }
};
