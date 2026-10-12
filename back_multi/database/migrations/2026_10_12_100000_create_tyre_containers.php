<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Conteneurs de pneus : prix d'achat, depenses, et rentabilite sur la periode
 * qui va de leur arrivee a celle du conteneur suivant.
 */
class CreateTyreContainers extends Migration
{
    public function up()
    {
        Schema::create('tyre_containers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('supplier_id')->index();
            $table->string('reference', 100);
            $table->date('arrival_date');
            $table->decimal('purchase_price', 18, 2);
            $table->string('currency', 10)->default('GNF');
            $table->decimal('exchange_rate', 14, 4)->default(1);
            $table->string('notes', 1000)->nullable();
            $table->timestamps();
        });

        Schema::create('tyre_container_expenses', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tyre_container_id')->index();
            $table->string('label', 255);
            $table->decimal('amount', 18, 2);
            $table->date('expense_date');
            $table->timestamps();
        });

        // Achats fournisseurs nes d'un conteneur de pneus : sa dette et ses entrees en stock
        Schema::table('supplier_purchases', function (Blueprint $table) {
            $table->unsignedBigInteger('tyre_container_id')->nullable()->index();
        });
    }

    public function down()
    {
        Schema::table('supplier_purchases', function (Blueprint $table) {
            $table->dropColumn('tyre_container_id');
        });
        Schema::dropIfExists('tyre_container_expenses');
        Schema::dropIfExists('tyre_containers');
    }
}
