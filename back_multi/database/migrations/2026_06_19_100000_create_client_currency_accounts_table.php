<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Comptes-devises par client : chaque client peut avoir un compte GNF (principal),
 * USD, EUR, etc. Les versements peuvent etre dirigees vers un compte specifique.
 *
 * - current_balance > 0 : le client nous doit cette somme dans cette devise
 * - current_balance < 0 : avance / credit en faveur du client
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_currency_accounts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('client_id');
            $table->string('currency', 10); // GNF, USD, EUR, etc.
            $table->boolean('is_primary')->default(false); // compte principal (GNF par defaut)
            $table->decimal('current_balance', 18, 2)->default(0);
            $table->decimal('total_debit', 18, 2)->default(0);
            $table->decimal('total_credit', 18, 2)->default(0);
            $table->string('label')->nullable(); // libelle libre, ex. "Compte USD Aïcha"
            $table->timestamps();

            $table->unique(['client_id', 'currency'], 'unique_client_currency');
            $table->index('tenant_id');

            $table->foreign('client_id')
                ->references('id')->on('clients')
                ->onDelete('cascade');
            $table->foreign('tenant_id')
                ->references('id')->on('tenants')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_currency_accounts');
    }
};
