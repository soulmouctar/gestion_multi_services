<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->string('category', 100)->nullable()->after('name');
        });

        Schema::create('supplier_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->foreignId('supplier_id')->constrained('suppliers')->onDelete('cascade');
            $table->decimal('amount', 15, 2);
            $table->string('currency', 10)->default('GNF');
            $table->decimal('exchange_rate', 15, 4)->nullable();
            $table->decimal('amount_gnf', 15, 2)->nullable();
            $table->string('payment_method', 50)->default('ESPECES');
            $table->date('payment_date');
            $table->string('reference', 100)->nullable();
            $table->text('description')->nullable();
            $table->string('status', 20)->default('COMPLETED');
            $table->timestamps();

            $table->index(['tenant_id', 'supplier_id']);
            $table->index('payment_date');
        });
    }

    public function down()
    {
        Schema::dropIfExists('supplier_payments');

        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn('category');
        });
    }
};
