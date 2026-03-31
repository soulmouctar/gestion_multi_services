<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateContainerSalesSystemTables extends Migration
{
    public function up()
    {
        // Table pour les arrivages de conteneurs (prix d'achat fournisseur)
        Schema::create('container_arrivals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
            $table->foreignId('container_id')->constrained()->onDelete('cascade');
            $table->foreignId('supplier_id')->nullable()->constrained()->onDelete('set null');
            $table->date('arrival_date');
            $table->decimal('purchase_price', 15, 2)->comment('Prix d\'achat total du conteneur');
            $table->string('currency', 10)->default('GNF');
            $table->enum('product_type', ['HABITS', 'PNEUS', 'ELECTRONIQUE', 'DIVERS', 'MIXTE'])->default('DIVERS');
            $table->integer('total_quantity')->default(0)->comment('Nombre total de produits');
            $table->integer('remaining_quantity')->default(0)->comment('Quantité restante à vendre');
            $table->text('description')->nullable();
            $table->enum('status', ['EN_COURS', 'VENDU_PARTIEL', 'VENDU_TOTAL', 'CLOTURE'])->default('EN_COURS');
            $table->timestamps();
            
            $table->index(['tenant_id', 'container_id']);
            $table->index(['tenant_id', 'status']);
        });

        // Table pour les ventes de conteneurs aux clients
        Schema::create('container_sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
            $table->foreignId('container_arrival_id')->constrained('container_arrivals')->onDelete('cascade');
            $table->foreignId('client_id')->constrained()->onDelete('cascade');
            $table->enum('sale_type', ['TOTAL', 'PARTIEL', 'DETAIL'])->comment('Type de vente: tout, moitié, détail');
            $table->integer('quantity_sold')->default(0)->comment('Quantité vendue');
            $table->decimal('sale_price', 15, 2)->comment('Prix de vente total');
            $table->string('currency', 10)->default('GNF');
            $table->decimal('amount_paid', 15, 2)->default(0)->comment('Montant déjà payé');
            $table->decimal('remaining_amount', 15, 2)->default(0)->comment('Reste à payer');
            $table->boolean('is_installment', )->default(false)->comment('Paiement échelonné');
            $table->integer('installment_count')->nullable()->comment('Nombre d\'échéances prévues');
            $table->date('sale_date');
            $table->date('due_date')->nullable()->comment('Date limite de paiement');
            $table->text('notes')->nullable();
            $table->enum('status', ['EN_COURS', 'PAYE_PARTIEL', 'PAYE_TOTAL', 'ANNULE'])->default('EN_COURS');
            $table->timestamps();
            
            $table->index(['tenant_id', 'client_id']);
            $table->index(['tenant_id', 'status']);
        });

        // Table pour les versements/paiements des clients
        Schema::create('container_sale_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
            $table->foreignId('container_sale_id')->constrained('container_sales')->onDelete('cascade');
            $table->foreignId('client_id')->constrained()->onDelete('cascade');
            $table->decimal('amount', 15, 2);
            $table->string('currency', 10)->default('GNF');
            $table->string('payment_method', 50)->default('ESPECES');
            $table->date('payment_date');
            $table->string('reference', 100)->nullable();
            $table->text('notes')->nullable();
            $table->enum('payment_type', ['VERSEMENT', 'AVANCE'])->default('VERSEMENT');
            $table->timestamps();
            
            $table->index(['tenant_id', 'client_id']);
            $table->index(['tenant_id', 'container_sale_id']);
        });

        // Table pour les avances clients (pour conteneurs à venir)
        Schema::create('client_advances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
            $table->foreignId('client_id')->constrained()->onDelete('cascade');
            $table->decimal('amount', 15, 2);
            $table->string('currency', 10)->default('GNF');
            $table->string('payment_method', 50)->default('ESPECES');
            $table->date('payment_date');
            $table->string('reference', 100)->nullable();
            $table->text('description')->nullable();
            $table->decimal('used_amount', 15, 2)->default(0)->comment('Montant déjà utilisé');
            $table->decimal('remaining_amount', 15, 2)->default(0)->comment('Montant restant');
            $table->enum('status', ['DISPONIBLE', 'UTILISE_PARTIEL', 'UTILISE_TOTAL'])->default('DISPONIBLE');
            $table->timestamps();
            
            $table->index(['tenant_id', 'client_id']);
            $table->index(['tenant_id', 'status']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('client_advances');
        Schema::dropIfExists('container_sale_payments');
        Schema::dropIfExists('container_sales');
        Schema::dropIfExists('container_arrivals');
    }
}
