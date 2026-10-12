<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stock avarie tenu a part du stock sain, journal des ajustements de stock,
 * ventes prelevees sur le stock avarie, et conteneurs par famille (pneus, cosmetique).
 */
class AddDamagedStock extends Migration
{
    public function up()
    {
        Schema::table('products', function (Blueprint $table) {
            $table->integer('damaged_quantity')->default(0)->after('stock_quantity');
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->boolean('from_damaged')->default(false)->after('is_sample');
        });

        Schema::table('tyre_containers', function (Blueprint $table) {
            $table->string('family', 20)->default('pneus')->after('tenant_id')->index();
        });

        Schema::create('stock_adjustments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('product_id')->index();
            $table->unsignedBigInteger('user_id')->nullable();
            // AVARIE : sain → avarie. PERTE : sorti du stock. REMISE : avarie → sain. INVENTAIRE : comptage.
            $table->string('type', 20);
            $table->integer('stock_delta')->default(0);
            $table->integer('damaged_delta')->default(0);
            $table->string('reason', 500)->nullable();
            $table->date('adjustment_date');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('stock_adjustments');
        Schema::table('tyre_containers', fn (Blueprint $table) => $table->dropColumn('family'));
        Schema::table('invoice_items', fn (Blueprint $table) => $table->dropColumn('from_damaged'));
        Schema::table('products', fn (Blueprint $table) => $table->dropColumn('damaged_quantity'));
    }
}
