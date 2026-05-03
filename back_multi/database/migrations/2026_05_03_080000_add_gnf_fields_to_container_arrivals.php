<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::table('container_arrivals', function (Blueprint $table) {
            $table->decimal('exchange_rate', 15, 4)->nullable()->after('currency')
                  ->comment('Taux de change au jour de l\'arrivage (1 devise = X GNF)');
            $table->decimal('purchase_price_gnf', 15, 2)->nullable()->after('exchange_rate')
                  ->comment('Prix d\'achat converti en GNF');
        });

        // Renseigner purchase_price_gnf pour les arrivages existants en GNF
        DB::statement("
            UPDATE container_arrivals
            SET exchange_rate = 1, purchase_price_gnf = purchase_price
            WHERE currency = 'GNF' AND purchase_price_gnf IS NULL
        ");
    }

    public function down()
    {
        Schema::table('container_arrivals', function (Blueprint $table) {
            $table->dropColumn(['exchange_rate', 'purchase_price_gnf']);
        });
    }
};
