<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Comptes-devises par fournisseur, symetriques a client_currency_accounts.
 *
 * Le sens est inverse de celui des clients : ici c'est NOUS qui devons.
 *  - current_balance > 0 : nous devons cette somme au fournisseur
 *  - current_balance < 0 : nous avons paye d'avance (avoir en notre faveur)
 *
 * total_debit  = achats (arrivages, marchandises) portes au compte
 * total_credit = versements effectues au fournisseur
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supplier_currency_accounts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('supplier_id');
            $table->string('currency', 10);
            $table->boolean('is_primary')->default(false);
            $table->decimal('current_balance', 18, 2)->default(0);
            $table->decimal('total_debit', 18, 2)->default(0);
            $table->decimal('total_credit', 18, 2)->default(0);
            $table->string('label')->nullable();
            $table->timestamps();

            $table->unique(['supplier_id', 'currency'], 'unique_supplier_currency');
            $table->index('tenant_id');

            $table->foreign('supplier_id')
                ->references('id')->on('suppliers')
                ->onDelete('cascade');
            $table->foreign('tenant_id')
                ->references('id')->on('tenants')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_currency_accounts');
    }
};
