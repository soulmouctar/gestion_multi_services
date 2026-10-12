<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Prix tel qu'il a ete saisi a l'arrivage (devise, prix par balle, total, taux).
 *
 * Quand la dette fournisseur est enregistree dans une autre devise que celle
 * du prix (prix en USD, dette en GNF…), seul le montant converti etait garde :
 * le prix d'origine, utile comme reference, etait perdu.
 */
class AddEnteredPriceToContainerArrivals extends Migration
{
    public function up()
    {
        Schema::table('container_arrivals', function (Blueprint $table) {
            if (!Schema::hasColumn('container_arrivals', 'price_currency')) {
                $table->string('price_currency', 10)->nullable()->after('purchase_price_gnf');
                $table->decimal('unit_price', 18, 2)->nullable()->after('price_currency');
                $table->decimal('price_total', 18, 2)->nullable()->after('unit_price');
                $table->decimal('price_rate', 18, 4)->nullable()->after('price_total');
            }
        });
    }

    public function down()
    {
        Schema::table('container_arrivals', function (Blueprint $table) {
            if (Schema::hasColumn('container_arrivals', 'price_currency')) {
                $table->dropColumn(['price_currency', 'unit_price', 'price_total', 'price_rate']);
            }
        });
    }
}
