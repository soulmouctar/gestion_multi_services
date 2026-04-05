<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateBankingTables extends Migration
{
    public function up()
    {
        Schema::create('bank_accounts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('bank_name', 100);
            $table->string('account_number', 50);
            $table->string('account_name', 200);
            $table->enum('account_type', ['COURANT', 'EPARGNE', 'DEPOT_A_TERME'])->default('COURANT');
            $table->string('currency', 10)->default('GNF');
            $table->decimal('opening_balance', 15, 2)->default(0);
            $table->decimal('current_balance', 15, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->text('description')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'is_active']);
        });

        Schema::create('bank_transactions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('bank_account_id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->enum('transaction_type', ['DEPOT', 'RETRAIT', 'REMISE_CHEQUE', 'VIREMENT_ENTRANT', 'VIREMENT_SORTANT']);
            $table->decimal('amount', 15, 2);
            $table->string('currency', 10)->default('GNF');
            $table->date('transaction_date');
            $table->string('reference', 100)->nullable();
            $table->text('description')->nullable();
            $table->string('proof_file', 500)->nullable();
            $table->enum('proof_type', ['BORDEREAU', 'CHEQUE', 'RECU', 'AUTRE'])->nullable();
            $table->enum('status', ['PENDING', 'COMPLETED', 'CANCELLED'])->default('COMPLETED');
            $table->decimal('balance_after', 15, 2)->nullable();
            $table->timestamps();
            $table->foreign('bank_account_id')->references('id')->on('bank_accounts')->onDelete('cascade');
            $table->index(['tenant_id', 'bank_account_id', 'transaction_date'], 'btx_tenant_account_date_idx');
        });
    }

    public function down()
    {
        Schema::dropIfExists('bank_transactions');
        Schema::dropIfExists('bank_accounts');
    }
}
