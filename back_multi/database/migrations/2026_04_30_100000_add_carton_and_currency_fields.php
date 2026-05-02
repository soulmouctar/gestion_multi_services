<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Produits : gestion carton/demi-carton/unité ──────────────────────
        Schema::table('products', function (Blueprint $table) {
            $table->integer('units_per_carton')->default(12)->after('stock_quantity')
                  ->comment('Nombre d\'unités par carton');
            $table->decimal('carton_purchase_price', 15, 2)->nullable()->after('purchase_price')
                  ->comment('Prix d\'achat par carton complet');
            $table->decimal('carton_selling_price', 15, 2)->nullable()->after('selling_price')
                  ->comment('Prix de vente par carton complet');
        });

        // ── Factures : support multi-devises ─────────────────────────────────
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('currency', 10)->default('GNF')->after('total_amount');
            $table->decimal('exchange_rate', 12, 4)->default(1)->after('currency')
                  ->comment('Taux de change vers GNF au moment de la vente');
            $table->decimal('total_amount_gnf', 15, 2)->nullable()->after('exchange_rate')
                  ->comment('Montant total converti en GNF');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['currency', 'exchange_rate', 'total_amount_gnf']);
        });
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['units_per_carton', 'carton_purchase_price', 'carton_selling_price']);
        });
    }
};
