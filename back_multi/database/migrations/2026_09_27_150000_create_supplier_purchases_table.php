<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Achats aupres d'un fournisseur en dehors des arrivages de conteneurs.
 *
 * Jusqu'ici seul un arrivage creait une dette fournisseur : un achat direct de
 * cosmetiques, pneus, textile ou machines a coudre n'etait rattache a aucun
 * compte. Cette table comble ce manque et alimente le compte-devise du
 * fournisseur au meme titre qu'un arrivage.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supplier_purchases', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('supplier_id');
            $table->string('purchase_number', 40)->nullable();

            // Nature de la marchandise, meme vocabulaire que les types clients.
            $table->enum('category', ['TEXTILE', 'COSMETIQUES', 'PNEUS', 'MACHINE_A_COUDRE', 'AUTRE'])
                ->default('AUTRE');
            $table->unsignedBigInteger('product_category_id')->nullable();

            $table->string('designation', 255);
            $table->decimal('quantity', 15, 2)->default(1);
            $table->decimal('unit_price', 18, 2)->default(0);
            $table->decimal('total_amount', 18, 2)->default(0);

            $table->string('currency', 10)->default('GNF');
            $table->decimal('exchange_rate', 18, 4)->default(1);
            $table->decimal('total_amount_gnf', 18, 2)->default(0);

            $table->date('purchase_date');
            $table->string('reference', 100)->nullable();
            $table->text('notes')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'supplier_id']);
            $table->index('purchase_date');

            $table->foreign('supplier_id')->references('id')->on('suppliers')->onDelete('cascade');
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('product_category_id')->references('id')->on('product_categories')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_purchases');
    }
};
