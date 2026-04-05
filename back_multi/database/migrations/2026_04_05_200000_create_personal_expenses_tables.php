<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Catégories de dépenses personnelles
        Schema::create('personal_expense_categories', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('name', 100);
            $table->string('color', 20)->default('#6c757d');
            $table->string('icon', 50)->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
        });

        // Dépenses personnelles
        Schema::create('personal_expenses', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('category_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->decimal('amount', 15, 2);
            $table->string('currency', 10)->default('GNF');
            $table->date('expense_date');
            $table->string('payment_method', 50)->default('ESPECES');
            $table->string('reference', 100)->nullable();
            $table->enum('status', ['PAID', 'PENDING', 'CANCELLED'])->default('PAID');
            $table->boolean('is_recurring')->default(false);
            $table->string('recurrence_period', 20)->nullable(); // MONTHLY, WEEKLY, YEARLY
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('category_id')->references('id')->on('personal_expense_categories')->onDelete('set null');
            $table->index(['tenant_id', 'expense_date']);
            $table->index(['tenant_id', 'category_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('personal_expenses');
        Schema::dropIfExists('personal_expense_categories');
    }
};
